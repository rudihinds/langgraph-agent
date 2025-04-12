/**
 * Example demonstrating advanced node-level error handling in LangGraph
 *
 * This example shows how to use the node-error-handler.ts utilities to create
 * resilient LangGraph agents with specialized error handling for different node types.
 *
 * Part of Task #14.7: Implement Core Error Handling Infrastructure
 */

import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import {
  StateGraph,
  Annotation,
  messagesStateReducer,
  END,
} from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";

import {
  createAdvancedNodeErrorHandler,
  createCriticalNodeErrorHandler,
  createLLMNodeErrorHandler,
  NodeErrorHandlerOptions,
} from "../../lib/llm/node-error-handler.js";
import {
  ErrorCategory,
  ErrorStateAnnotation,
} from "../../lib/llm/error-classification.js";

// Define graph state with error tracking
const StateDefinition = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  // Use error tracking capability
  errors: ErrorStateAnnotation.errors,
  lastError: ErrorStateAnnotation.lastError,
  // Add custom state for tracking
  processingStage: Annotation<string>({
    reducer: (current, value) => value || current,
    default: () => "initial",
  }),
  retryCount: Annotation<number>({
    reducer: (current = 0, value) =>
      typeof value === "number" ? value : current + 1,
    default: () => 0,
  }),
  degradedMode: Annotation<boolean>({
    reducer: (current = false, value) =>
      value !== undefined ? value : current,
    default: () => false,
  }),
});

// Define a simple mock LLM client that can simulate different errors
class MockLLMClient {
  private errorMode: string | null = null;

  setErrorMode(mode: string | null) {
    this.errorMode = mode;
    return this;
  }

  async invoke(messages: BaseMessage[]): Promise<AIMessage> {
    // Simulate different error types based on mode
    if (this.errorMode === "rate_limit") {
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    if (this.errorMode === "context_window") {
      throw new Error(
        "This model's maximum context length is 4097 tokens. Please reduce the prompt."
      );
    }

    if (this.errorMode === "service_unavailable") {
      throw new Error(
        "Service temporarily unavailable. Please try again later."
      );
    }

    if (this.errorMode === "invalid_response") {
      throw new Error("Failed to parse model response: invalid JSON format");
    }

    if (this.errorMode === "random_fail") {
      // Randomly fail 50% of the time
      if (Math.random() < 0.5) {
        throw new Error("Random transient error occurred.");
      }
    }

    // Normal successful response
    return new AIMessage({
      content: "This is a successful response from the LLM.",
    });
  }
}

// Create our mock LLM
const mockLLM = new MockLLMClient();

// Define node functions with appropriate error handlers

// 1. LLM Node with specialized LLM error handling
const processWithLLM = async (state: typeof StateDefinition.State) => {
  console.log("Executing LLM processing node...");

  // Simulate LLM call
  const messages = state.messages;
  const response = await mockLLM.invoke(messages);

  return {
    messages: [response],
    processingStage: "llm_complete",
  };
};

// Apply LLM-specific error handler
const llmNodeOptions: NodeErrorHandlerOptions<typeof StateDefinition.State> = {
  nodeName: "processWithLLM",
  maxRetries: 3,
  // Custom fallback for LLM errors
  fallback: async (state, error) => {
    return {
      messages: [
        new AIMessage({
          content:
            "I apologize, but I'm having trouble generating a response. " +
            "Let me try a simpler approach.",
          additional_kwargs: {
            error_info: {
              message: error.message,
            },
          },
        }),
      ],
      processingStage: "llm_fallback_used",
      degradedMode: true,
    };
  },
};

const processWithLLMWithErrorHandling =
  createLLMNodeErrorHandler(llmNodeOptions)(processWithLLM);

// 2. Critical node that must succeed for the workflow to continue
const criticalProcessing = async (state: typeof StateDefinition.State) => {
  console.log("Executing critical processing node...");

  // Simulate some critical operation that might fail
  if (state.degradedMode) {
    throw new Error("Critical processing failed in degraded mode");
  }

  // Simulate successful processing
  return {
    processingStage: "critical_complete",
  };
};

// Apply critical error handler with more retries
const criticalNodeErrorHandler = createCriticalNodeErrorHandler<
  typeof StateDefinition.State
>({
  nodeName: "criticalProcessing",
  maxRetries: 5,
  // After several errors, this logs severe error and continues in degraded mode
  onError: async (state, error, attempt) => {
    console.warn(`Critical error (attempt ${attempt}): ${error.message}`);
  },
});

const criticalProcessingWithErrorHandling =
  criticalNodeErrorHandler(criticalProcessing);

// 3. Regular processing node with standard error handling
const regularProcessing = async (state: typeof StateDefinition.State) => {
  console.log("Executing regular processing node...");

  // Simulate regular processing
  return {
    processingStage: "regular_complete",
  };
};

// Apply standard error handler
const regularNodeOptions: NodeErrorHandlerOptions<
  typeof StateDefinition.State
> = {
  nodeName: "regularProcessing",
  maxRetries: 2,
  // Don't propagate errors from this non-critical node
  propagateErrors: false,
};

const regularProcessingWithErrorHandling =
  createAdvancedNodeErrorHandler(regularNodeOptions)(regularProcessing);

// Conditional routing function
const routeByProcessingStage = (state: typeof StateDefinition.State) => {
  // Check if we're in degraded mode
  if (state.degradedMode) {
    return "degraded_path";
  }

  // Route based on processing stage
  switch (state.processingStage) {
    case "initial":
      return "process_llm";
    case "llm_complete":
      return "critical_processing";
    case "critical_complete":
      return "regular_processing";
    case "regular_complete":
    case "llm_fallback_used":
      return END;
    default:
      return "process_llm";
  }
};

// Define the degraded path node for graceful degradation
const degradedProcessing = async (state: typeof StateDefinition.State) => {
  console.log("Executing degraded processing path...");

  return {
    messages: [
      ...state.messages,
      new AIMessage({
        content:
          "I'm operating with limited capabilities due to some technical issues. " +
          "I've completed the basic processing, but some advanced features were skipped.",
      }),
    ],
    processingStage: "degraded_complete",
  };
};

// Create and configure the graph
const workflow = new StateGraph(StateDefinition)
  .addNode("process_llm", processWithLLMWithErrorHandling)
  .addNode("critical_processing", criticalProcessingWithErrorHandling)
  .addNode("regular_processing", regularProcessingWithErrorHandling)
  .addNode("degraded_path", degradedProcessing)
  .addConditionalEdges("__start__", routeByProcessingStage)
  .addConditionalEdges("process_llm", routeByProcessingStage)
  .addConditionalEdges("critical_processing", routeByProcessingStage)
  .addConditionalEdges("regular_processing", routeByProcessingStage)
  .addEdge("degraded_path", END);

// Compile the graph
const app = workflow.compile();

// Example usage functions to demonstrate different error scenarios
async function demonstrateSuccessfulExecution() {
  console.log("\n--- Demonstrating Successful Execution ---");

  // Reset error mode
  mockLLM.setErrorMode(null);

  const result = await app.invoke({
    messages: [new HumanMessage("Hello! Please process this request.")],
  });

  console.log("Final state:", {
    processingStage: result.processingStage,
    errorCount: result.errors?.length || 0,
    degradedMode: result.degradedMode,
    messageCount: result.messages.length,
  });

  return result;
}

async function demonstrateLLMErrorHandling() {
  console.log("\n--- Demonstrating LLM Error Handling ---");

  // Set error mode to simulate rate limiting
  mockLLM.setErrorMode("rate_limit");

  const result = await app.invoke({
    messages: [new HumanMessage("This will trigger rate limit errors.")],
  });

  console.log("Final state:", {
    processingStage: result.processingStage,
    errorCount: result.errors?.length || 0,
    degradedMode: result.degradedMode,
    messageCount: result.messages.length,
  });

  return result;
}

async function demonstrateContextWindowHandling() {
  console.log("\n--- Demonstrating Context Window Error Handling ---");

  // Set error mode to simulate context window exceeded
  mockLLM.setErrorMode("context_window");

  const result = await app.invoke({
    messages: [new HumanMessage("This will trigger context window errors.")],
  });

  console.log("Final state:", {
    processingStage: result.processingStage,
    errorCount: result.errors?.length || 0,
    degradedMode: result.degradedMode,
    messageCount: result.messages.length,
  });

  return result;
}

async function demonstrateTransientErrorRecovery() {
  console.log("\n--- Demonstrating Transient Error Recovery ---");

  // Set error mode to randomly fail (should eventually succeed with retries)
  mockLLM.setErrorMode("random_fail");

  const result = await app.invoke({
    messages: [
      new HumanMessage(
        "This might trigger random failures that should recover."
      ),
    ],
  });

  console.log("Final state:", {
    processingStage: result.processingStage,
    errorCount: result.errors?.length || 0,
    degradedMode: result.degradedMode,
    messageCount: result.messages.length,
  });

  return result;
}

// Run all demonstrations
async function runAllDemonstrations() {
  try {
    await demonstrateSuccessfulExecution();
    await demonstrateLLMErrorHandling();
    await demonstrateContextWindowHandling();
    await demonstrateTransientErrorRecovery();

    console.log("\nAll demonstrations completed!");
  } catch (error) {
    console.error("Error running demonstrations:", error);
  }
}

// Run the examples when this file is executed directly
if (
  typeof process !== "undefined" &&
  process.argv[1].includes("node-error-handling-example")
) {
  runAllDemonstrations().catch(console.error);
}

// Export for testing or importing elsewhere
export {
  workflow,
  app,
  mockLLM,
  demonstrateSuccessfulExecution,
  demonstrateLLMErrorHandling,
  demonstrateContextWindowHandling,
  demonstrateTransientErrorRecovery,
};
