/**
 * Example of integrating error handling into a LangGraph workflow
 * 
 * Part of Task #14.4: Implement Base Error Classification and Retry Mechanisms
 */

import { StateGraph, END } from "@langchain/langgraph";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { Runnable } from "@langchain/core/runnables";

import {
  withErrorHandling,
  createNodeErrorHandler,
  createRetryingNode,
} from "../../lib/llm/error-handlers.js";
import {
  ErrorCategory,
  ErrorStateAnnotation,
  createErrorEvent,
  createErrorResponseMessage,
} from "../../lib/llm/error-classification.js";
import { ContextWindowManager } from "../../lib/llm/context-window-manager.js";
import { LLMFactory } from "../../lib/llm/llm-factory.js";

/**
 * State definition for our example agent
 */
interface AgentState {
  messages: Array<HumanMessage | AIMessage>;
  context?: string;
  query?: string;
  results?: any[];
  errors?: any[];
  lastError?: any;
  recoveryAttempts?: number;
}

/**
 * Simple agent that processes a query and returns a response
 */
export function createErrorHandlingAgent(): Runnable {
  // Initialize the LLM factory and get a client
  const llmFactory = LLMFactory.getInstance();
  const llmClient = llmFactory.getClientForModel("claude-3-7-sonnet");
  
  // Initialize context window manager
  const contextManager = ContextWindowManager.getInstance({
    summarizationModel: "claude-3-7-sonnet",
    debug: process.env.NODE_ENV === "development",
  });

  // Define node function to prepare context
  const prepareContext = async (state: AgentState): Promise<AgentState> => {
    console.log("Preparing context...");
    const { query } = state;
    
    if (!query) {
      throw new Error("No query provided");
    }
    
    return {
      ...state,
      context: `The user asked: ${query}`,
    };
  };

  // Define node function to generate a response
  const generateResponse = async (state: AgentState): Promise<AgentState> => {
    console.log("Generating response...");
    const { context, messages } = state;
    
    // Use context window manager to prepare messages
    const { messages: preparedMessages } = await contextManager.prepareMessages(
      [
        { role: "system", content: "You are a helpful assistant." },
        ...messages,
      ],
      "claude-3-7-sonnet"
    );

    // Generate response using LLM
    const response = await llmClient.completion({
      model: "claude-3-7-sonnet",
      messages: [
        ...preparedMessages,
        { role: "user", content: `Consider this context: ${context}` },
      ],
    });

    return {
      ...state,
      messages: [
        ...messages,
        new AIMessage({ content: response.content }),
      ],
    };
  };

  // Define a fallback node function for catastrophic errors
  const handleCatastrophicError = async (state: AgentState): Promise<AgentState> => {
    console.error("Handling catastrophic error:", state.lastError);
    
    // Create a user-friendly error message
    const errorMessage = createErrorResponseMessage(state.lastError);
    
    return {
      ...state,
      messages: [...state.messages, errorMessage],
    };
  };

  // Define a graceful degradation node for token/context window errors
  const handleContextWindowError = async (state: AgentState): Promise<AgentState> => {
    console.warn("Handling context window error:", state.lastError);
    
    // Create a simplified message history with just essential messages
    const essentialMessages = state.messages.slice(-2); // Keep only the most recent messages
    
    // Try again with reduced context
    try {
      const response = await llmClient.completion({
        model: "claude-3-7-sonnet",
        messages: [
          { role: "system", content: "You are a helpful assistant. Due to context limitations, we're working with reduced conversation history." },
          ...essentialMessages,
        ],
      });
      
      return {
        ...state,
        messages: [...state.messages, new AIMessage({ content: response.content })],
      };
    } catch (error) {
      // If still failing, return a friendly error message
      return {
        ...state,
        messages: [
          ...state.messages,
          new AIMessage({ content: "I'm having trouble processing our conversation due to its length. Let's start a new thread or try a simpler question." }),
        ],
      };
    }
  };

  // Create the graph with error handling
  const builder = new StateGraph<AgentState>({
    channels: {
      errors: ErrorStateAnnotation
    }
  });

  // Add nodes with error handling wrappers
  builder.addNode(
    "prepareContext",
    createRetryingNode(prepareContext, "prepareContext", { maxRetries: 1 })
  );
  
  builder.addNode(
    "generateResponse",
    createRetryingNode(generateResponse, "generateResponse", { maxRetries: 2 })
  );
  
  builder.addNode("handleCatastrophicError", handleCatastrophicError);
  builder.addNode("handleContextWindowError", handleContextWindowError);

  // Define the main flow
  builder.setEntryPoint("prepareContext");
  builder.addEdge("prepareContext", "generateResponse");
  builder.addEdge("generateResponse", END);

  // Define error handling edges
  builder.addConditionalEdges(
    "prepareContext",
    (state) => {
      // Check if there's an error and its category
      if (state.lastError) {
        if (
          state.lastError.category === ErrorCategory.CONTEXT_WINDOW_ERROR ||
          state.lastError.category === ErrorCategory.CONTEXT_WINDOW_EXCEEDED
        ) {
          return "handleContextWindowError";
        }
        return "handleCatastrophicError";
      }
      return "generateResponse";
    },
    {
      handleContextWindowError: "handleContextWindowError",
      handleCatastrophicError: "handleCatastrophicError",
      generateResponse: "generateResponse",
    }
  );
  
  builder.addConditionalEdges(
    "generateResponse",
    (state) => {
      // Check if there's an error and its category
      if (state.lastError) {
        if (
          state.lastError.category === ErrorCategory.CONTEXT_WINDOW_ERROR ||
          state.lastError.category === ErrorCategory.CONTEXT_WINDOW_EXCEEDED
        ) {
          return "handleContextWindowError";
        }
        return "handleCatastrophicError";
      }
      return END;
    },
    {
      handleContextWindowError: "handleContextWindowError",
      handleCatastrophicError: "handleCatastrophicError",
      [END]: END,
    }
  );
  
  // Error handlers should end the flow
  builder.addEdge("handleContextWindowError", END);
  builder.addEdge("handleCatastrophicError", END);

  // Compile and add error handling wrapper
  const graph = withErrorHandling(builder);
  return graph.compile();
}

/**
 * Example usage of the error handling agent
 */
async function runExample() {
  const agent = createErrorHandlingAgent();
  
  const result = await agent.invoke({
    messages: [],
    query: "Tell me about error handling in LangGraph",
  });
  
  console.log("Final messages:", result.messages);
  
  // Check if any errors occurred
  if (result.errors && result.errors.length > 0) {
    console.log("Errors encountered:", result.errors);
  }
}

// Only run directly if this file is executed directly
if (require.main === module) {
  runExample().catch(console.error);
}