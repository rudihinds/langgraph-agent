/**
 * Example of integrating error handling into a LangGraph workflow
 * 
 * Simplified version of the example for easy understanding and integration
 */

import { StateGraph, END } from "@langchain/langgraph";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Runnable } from "@langchain/core/runnables";
import { Annotation } from "@langchain/langgraph";

import {
  withErrorHandling,
  createNodeErrorHandler,
  createRetryingNode,
} from "../../lib/llm/error-handlers.js";
import {
  ErrorCategory,
  createErrorEvent,
} from "../../lib/llm/error-classification.js";
import { ContextWindowManager } from "../../lib/llm/context-window-manager.js";
import { LLMMonitor, MetricType } from "../../lib/llm/monitoring.js";
import { ChatOpenAI } from "@langchain/openai";

/**
 * State definition for our integrated agent
 */
const AgentStateAnnotation = Annotation.Root({
  messages: Annotation.Array({
    default: () => [],
  }),
  context: Annotation.String({
    default: () => "",
  }),
  query: Annotation.String({
    default: () => "",
  }),
  errors: Annotation.Array({
    default: () => [],
  }),
  lastError: Annotation.Any({
    default: () => undefined,
  }),
  recoveryAttempts: Annotation.Number({
    default: () => 0,
  }),
});

type AgentState = typeof AgentStateAnnotation.State;

/**
 * Create an agent with integrated error handling
 */
export function createIntegratedErrorHandlingAgent(): Runnable {
  // Initialize LLM
  const llmClient = new ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0.5,
  });
  
  // Initialize error-handling LLM
  const errorHandlingLLM = createRetryingLLM(llmClient, 3);
  
  // Initialize context window manager
  const contextManager = ContextWindowManager.getInstance({
    summarizationModel: "gpt-4o",
    debug: process.env.NODE_ENV === "development",
  });

  // Initialize monitoring
  const monitor = LLMMonitor.getInstance();

  // Define node function to prepare context
  const prepareContext = async (state: AgentState): Promise<Partial<AgentState>> => {
    console.log("Preparing context...");
    const { query } = state;
    
    const tracker = monitor.trackOperation("prepareContext", "agent-prep");
    
    try {
      if (!query) {
        throw new Error("No query provided");
      }
      
      tracker(undefined); // Success
      
      return {
        context: `The user asked: ${query}`,
      };
    } catch (error) {
      // Track error
      tracker(undefined, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  };

  // Define node function to generate a response
  const generateResponse = async (state: AgentState): Promise<Partial<AgentState>> => {
    console.log("Generating response...");
    const { context, messages } = state;
    
    const tracker = monitor.trackOperation("generateResponse", "gpt-4o");
    
    try {
      // Prepare system message and input
      const sysMessage = new SystemMessage("You are a helpful assistant.");
      const userMsg = new HumanMessage(`Consider this context: ${context}`);
      
      // Generate response using LLM
      const response = await errorHandlingLLM.invoke([
        sysMessage,
        ...messages,
        userMsg
      ]);
      
      // Track success
      tracker(undefined);
      
      return {
        messages: [
          ...messages,
          new AIMessage({ content: response.content }),
        ],
      };
    } catch (error) {
      // Track error
      tracker(undefined, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  };

  // Define a fallback node function for catastrophic errors
  const handleCatastrophicError = async (state: AgentState): Promise<Partial<AgentState>> => {
    console.error("Handling catastrophic error:", state.lastError);
    
    return {
      messages: [
        ...state.messages, 
        new AIMessage("I encountered a technical issue. Please try again or rephrase your request.")
      ],
    };
  };

  // Define a graceful degradation node for token/context window errors
  const handleContextWindowError = async (state: AgentState): Promise<Partial<AgentState>> => {
    console.warn("Handling context window error:", state.lastError);
    
    return {
      messages: [
        ...state.messages,
        new AIMessage("Our conversation is getting quite long. Let me summarize and continue."),
      ],
      // Reset recovery attempts for the next try
      recoveryAttempts: 0
    };
  };

  // Create the graph with error handling
  const builder = new StateGraph(AgentStateAnnotation);

  // Add nodes with error handling wrappers
  builder.addNode(
    "prepareContext",
    createRetryingNode("prepareContext", 1)(prepareContext)
  );
  
  builder.addNode(
    "generateResponse",
    createRetryingNode("generateResponse", 2)(generateResponse)
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

  // Compile and return the graph with error handling wrapper
  const compiledGraph = withErrorHandling(builder)();
  return compiledGraph;
}

/**
 * Example usage of the integrated error handling agent
 */
export async function runExample() {
  const agent = createIntegratedErrorHandlingAgent();
  
  // Initialize the monitor
  const monitor = LLMMonitor.getInstance({
    debug: true,
    logErrors: true,
    logMetrics: true
  });
  
  try {
    const result = await agent.invoke({
      messages: [],
      query: "Tell me about error handling in LangGraph",
    });
    
    console.log("Final messages:", result.messages);
    
    // Print stats
    console.log("Error stats:", monitor.getErrorStats());
    console.log("Metric stats:", monitor.getMetricStats());
  } catch (error) {
    console.error("Error running example:", error);
  }
}

// Run example if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runExample().catch(console.error);
}