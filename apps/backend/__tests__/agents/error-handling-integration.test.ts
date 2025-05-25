/**
 * Integration test for error handling in LangGraph
 */

import { test, expect, describe, beforeEach, vi } from "vitest";
import {
  createErrorEvent,
  ErrorCategory,
} from "../../lib/llm/error-classification";
import { LLMMonitor } from "../../lib/llm/monitoring";
import {
  createRetryingLLM,
  createRetryingNode,
} from "../../lib/llm/error-handlers";
import { ChatOpenAI } from "@langchain/openai";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { StateGraph } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";

// Mock the ChatOpenAI class
vi.mock("@langchain/openai", () => {
  return {
    ChatOpenAI: vi.fn().mockImplementation(() => {
      return {
        invoke: vi.fn(),
      };
    }),
  };
});

// Create a simple state type for testing
const TestStateAnnotation = Annotation.Root({
  messages: Annotation.Array({
    default: () => [],
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

type TestState = typeof TestStateAnnotation.State;

describe("Error Handling Integration", () => {
  let mockLLM: ChatOpenAI;
  let monitor: LLMMonitor;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Get mocked LLM
    mockLLM = new ChatOpenAI({});

    // Reset monitor
    monitor = LLMMonitor.getInstance();
    monitor.resetStats();
  });

  test("retryingLLM should retry on transient errors", async () => {
    // Setup mock behavior to fail twice then succeed
    (mockLLM.invoke as any)
      .mockRejectedValueOnce(new Error("Rate limit exceeded"))
      .mockRejectedValueOnce(new Error("Rate limit exceeded"))
      .mockResolvedValueOnce(new AIMessage("Success after retries"));

    // Create retrying LLM
    const retryingLLM = createRetryingLLM(mockLLM, 3);

    // Call the LLM
    const result = await retryingLLM.invoke([
      new SystemMessage("You are a helpful assistant"),
      new HumanMessage("Hello"),
    ]);

    // Verify retries occurred
    expect(mockLLM.invoke).toHaveBeenCalledTimes(3);
    expect(result.content).toBe("Success after retries");

    // Check monitoring stats
    const stats = monitor.getErrorStats();
    expect(stats.totalErrors).toBeGreaterThan(0);
  });

  test("retryingNode should handle errors with conditional edges", async () => {
    // Create a simple node function that can fail
    const testNode = async (state: TestState): Promise<Partial<TestState>> => {
      if (state.recoveryAttempts > 0) {
        // Succeed after first attempt
        return {
          messages: [...state.messages, new AIMessage("Success after retry")],
        };
      }

      // Fail on first attempt
      throw new Error("Context window exceeded");
    };

    // Create error handling node
    const handleError = async (
      state: TestState
    ): Promise<Partial<TestState>> => {
      return {
        messages: [...state.messages, new AIMessage("Error handled")],
        recoveryAttempts: (state.recoveryAttempts || 0) + 1,
      };
    };

    // Create wrapped node
    const wrappedNode = createRetryingNode("testNode", 1)(testNode);

    // Create graph
    const graph = new StateGraph(TestStateAnnotation)
      .addNode("test", wrappedNode)
      .addNode("handleError", handleError);

    // Set entry point
    graph.setEntryPoint("test");

    // Add conditional edge for error handling
    graph.addConditionalEdges(
      "test",
      (state: TestState) => {
        if (state.lastError) {
          if (
            state.lastError.category === ErrorCategory.CONTEXT_WINDOW_EXCEEDED
          ) {
            return "handleError";
          }
        }
        return "test";
      },
      {
        handleError: "handleError",
        test: "test",
      }
    );

    // Add edge back from error handler
    graph.addEdge("handleError", "test");

    // Compile graph
    const compiledGraph = graph.compile();

    // Run graph
    const result = await compiledGraph.invoke({
      messages: [new HumanMessage("Test message")],
      recoveryAttempts: 0,
    });

    // Verify error was handled
    expect(result.messages).toHaveLength(3); // Initial + error handling + success
    expect(result.messages[1].content).toBe("Error handled");
    expect(result.messages[2].content).toBe("Success after retry");
    expect(result.recoveryAttempts).toBe(1);
  });

  test("monitoring should track errors and metrics", async () => {
    // Reset stats
    monitor.resetStats();

    // Log some test metrics and errors
    monitor.logMetric("llm_latency", 250, "gpt-4o", "test");
    monitor.logError(new Error("Test error"), "test", "gpt-4o");

    // Get stats
    const errorStats = monitor.getErrorStats();
    const metricStats = monitor.getMetricStats();

    // Verify stats were tracked
    expect(errorStats.totalErrors).toBe(1);
    expect(metricStats.totalMetrics).toBeGreaterThan(0);
  });
});
