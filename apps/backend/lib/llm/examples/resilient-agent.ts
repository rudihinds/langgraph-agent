/**
 * Example: Error-Resilient LangGraph Agent
 *
 * Demonstrates the use of error handling utilities with LangGraph.
 * Part of Task #14: Error Handling and Resilience System
 */

import { StateGraph } from "@langchain/langgraph";
import { ChatAnthropic, AnthropicMessage } from "@langchain/anthropic";
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  BaseMessage,
} from "@langchain/core/messages";
import {
  MemorySaver,
  Annotation,
  messagesStateReducer,
} from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { z } from "zod";

// Import our error handling utilities
import {
  createRetryingLLM,
  createNodeErrorHandler,
  withNodeResilience,
} from "../error-handlers.js";
import {
  ErrorStateAnnotation,
  ErrorEvent,
  ErrorCategory,
  createErrorResponseMessage,
} from "../error-classification.js";
import {
  truncateMessages,
  progressiveTruncation,
  TruncationLevel,
} from "../message-truncation.js";

// Define the combined state annotation with error tracking
const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  errors: Annotation<ErrorEvent[]>({
    reducer: (curr: ErrorEvent[] = [], value: ErrorEvent[] = []) => [
      ...curr,
      ...value,
    ],
    default: () => [],
  }),
  lastError: Annotation<ErrorEvent | undefined>({
    reducer: (_, value) => value,
    default: () => undefined,
  }),
  recoveryAttempts: Annotation<number>({
    reducer: (curr = 0, value) =>
      typeof value === "number" ? value : curr + 1,
    default: () => 0,
  }),
  contextTruncationLevel: Annotation<TruncationLevel>({
    reducer: (_, value) => value,
    default: () => TruncationLevel.NONE,
  }),
});

// Define a tool that might occasionally fail
const weatherTool = tool(
  async ({ city }) => {
    // Simulate random failures
    if (Math.random() < 0.2) {
      throw new Error("Weather service is temporarily unavailable");
    }

    // Simulate rate limit failures occasionally
    if (Math.random() < 0.1) {
      throw new Error("Rate limit exceeded for weather service");
    }

    // Default success case
    return `Weather in ${city}: Sunny, 72°F`;
  },
  {
    name: "weather",
    description: "Get the current weather for a location",
    schema: z.object({
      city: z.string().describe("The city to get the weather for"),
    }),
  }
);

// Create a resilient agent that handles errors gracefully
async function createResilientAgent() {
  // Create base LLM
  const baseLLM = new ChatAnthropic({
    model: "claude-3-sonnet-20240229",
    temperature: 0,
  });

  // Create retrying LLM with error handling
  const resilientLLM = createRetryingLLM(baseLLM, 3);

  // Create tool node with error handling
  const tools = [weatherTool];
  const baseToolNode = new ToolNode(tools);

  // Bind tools to the LLM
  const toolEnabledLLM = resilientLLM.bindTools(tools);

  // Define the agent node with error handling
  async function callModel(state: typeof AgentStateAnnotation.State) {
    try {
      const messages = state.messages;

      // Apply message truncation if needed
      let truncatedMessages = messages;
      let truncationLevel =
        state.contextTruncationLevel || TruncationLevel.NONE;

      // If we've had context window errors before, be proactive about truncation
      if (state.lastError?.category === ErrorCategory.CONTEXT_WINDOW_EXCEEDED) {
        // Move to a more aggressive truncation level
        const nextLevel = getNextTruncationLevel(truncationLevel);
        const result = progressiveTruncation(messages, 100000, nextLevel);
        truncatedMessages = result.messages;
        truncationLevel = result.level;

        console.log(
          `Applied ${truncationLevel} message truncation, reduced from ${messages.length} to ${truncatedMessages.length} messages`
        );
      }

      // Call the LLM with the possibly truncated messages
      const response = await toolEnabledLLM.invoke(truncatedMessages);

      // Return truncation level if it changed
      if (truncationLevel !== state.contextTruncationLevel) {
        return {
          messages: [response],
          contextTruncationLevel: truncationLevel,
        };
      }

      return { messages: [response] };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("Error in agent node:", err);

      // For demo purposes, we'll create a hardcoded response
      const errorMessage = new AIMessage({
        content: `I encountered an error: ${err.message}. Let me try again with a different approach.`,
      });

      return { messages: [errorMessage] };
    }
  }

  // Add error handling to the agent node
  const agentNode = withNodeResilience(
    "agent",
    3, // max retries
    async (state, error) => {
      // This is our fallback behavior if all retries fail
      console.error("All retries failed for agent node:", error);

      // Create a user-friendly error message
      const errorMessage = new AIMessage({
        content:
          "I'm having some trouble processing your request right now. Could you try rephrasing or asking something else?",
      });

      return { messages: [errorMessage] };
    }
  )(callModel);

  // Create a wrapper for the tool node with error handling
  const toolNode = withNodeResilience(
    "tools",
    2, // max retries
    async (state, error) => {
      // Fallback behavior for tool execution errors
      console.error("All retries failed for tool node:", error);

      // Create a message about the tool failure
      const errorMessage = new AIMessage({
        content:
          "I tried to look up some information, but the service seems to be unavailable. Let me try a different approach.",
      });

      return { messages: [errorMessage] };
    }
  )(baseToolNode.invoke);

  // Define routing logic
  function shouldContinue(state: typeof AgentStateAnnotation.State) {
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1] as AIMessage;

    // Route to tools if the LLM makes a tool call
    if (lastMessage.tool_calls?.length) {
      return "tools";
    }

    // Otherwise, end the conversation
    return "__end__";
  }

  // Create the graph
  const workflow = new StateGraph(AgentStateAnnotation)
    .addNode("agent", agentNode)
    .addNode("tools", toolNode)
    .addEdge("__start__", "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent");

  // Initialize memory
  const checkpointer = new MemorySaver();

  // Compile the graph
  const agent = workflow.compile({ checkpointer });

  return agent;
}

// Helper function to get the next truncation level
function getNextTruncationLevel(
  currentLevel: TruncationLevel
): TruncationLevel {
  switch (currentLevel) {
    case TruncationLevel.NONE:
      return TruncationLevel.LIGHT;
    case TruncationLevel.LIGHT:
      return TruncationLevel.MODERATE;
    case TruncationLevel.MODERATE:
      return TruncationLevel.AGGRESSIVE;
    case TruncationLevel.AGGRESSIVE:
    case TruncationLevel.EXTREME:
      return TruncationLevel.EXTREME;
    default:
      return TruncationLevel.MODERATE;
  }
}

// Example usage of the resilient agent
async function main() {
  try {
    const agent = await createResilientAgent();

    const initialMessage = new HumanMessage(
      "What's the weather like in San Francisco?"
    );
    console.log("Human:", initialMessage.content);

    // Invoke the agent
    const result = await agent.invoke({ messages: [initialMessage] });

    // Log the conversation
    for (const message of result.messages.slice(1)) {
      if (message.type === "ai") {
        console.log("AI:", message.content);
      } else if (message.type === "human") {
        console.log("Human:", message.content);
      }
    }

    // Log any errors that occurred
    if (result.errors && result.errors.length > 0) {
      console.log("\nErrors encountered during execution:");
      for (const error of result.errors) {
        console.log(`- ${error.category}: ${error.message}`);
      }
    }
  } catch (error) {
    console.error("Fatal error:", error);
  }
}

// Run the example if this script is executed directly
if (typeof require !== "undefined" && require.main === module) {
  main().catch(console.error);
}

export { createResilientAgent };
