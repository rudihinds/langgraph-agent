/**
 * Test suite for error handling and resilience wrappers
 */

import { StateGraph, Annotation } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { z } from "zod";

import {
  withErrorHandling,
  createRetryingLLM,
  createNodeErrorHandler,
  createRetryingNode,
  withNodeResilience,
} from "../error-handlers.js";
import { ErrorCategory, createErrorEvent } from "../error-classification.js";

// Mock BaseChatModel implementation for testing
class MockChatModel extends BaseChatModel {
  failCount: number;
  failType: string;
  callCount: number;

  constructor(failCount: number = 0, failType: string = "generic") {
    super({});
    this.failCount = failCount;
    this.failType = failType;
    this.callCount = 0;
  }

  _llmType(): string {
    return "mock-llm";
  }

  async _generate(_messages: BaseMessage[]): Promise<any> {
    throw new Error("Not implemented");
  }

  async invoke(messages: BaseMessage[]): Promise<BaseMessage> {
    this.callCount++;

    if (this.callCount <= this.failCount) {
      switch (this.failType) {
        case "rate-limit":
          throw new Error("Rate limit exceeded");
        case "context-window":
          throw new Error("Context length exceeded");
        case "unavailable":
          throw new Error("Service unavailable");
        default:
          throw new Error("Failed for testing");
      }
    }

    return new AIMessage({ content: "Mock response" });
  }
}

describe("Error Handling Utilities", () => {
  describe("withErrorHandling", () => {
    test("should successfully compile valid graph", () => {
      // Create a simple graph
      const TestState = Annotation.Root({
        count: Annotation<number>({ default: () => 0 }),
      });

      const graph = new StateGraph(TestState)
        .addNode("increment", (state) => ({ count: state.count + 1 }))
        .addEdge("__start__", "increment")
        .addEdge("increment", "__end__");

      // Wrap with error handling
      const compileWithErrorHandling = withErrorHandling(graph);

      // Should compile without error
      const compiled = compileWithErrorHandling();
      expect(compiled).toBeDefined();
    });

    test("should handle compilation errors", () => {
      // Create a broken graph (missing edge from start)
      const TestState = Annotation.Root({
        value: Annotation<string>({ default: () => "" }),
      });

      const brokenGraph = new StateGraph(TestState).addNode(
        "test",
        (state) => ({ value: state.value + "!" })
      );

      // Should throw a more helpful error
      const compileWithErrorHandling = withErrorHandling(brokenGraph);

      expect(() => compileWithErrorHandling()).toThrow(
        /LangGraph compilation failed/
      );
    });

    test("should call onError callback when provided", () => {
      // Create a broken graph
      const TestState = Annotation.Root({
        value: Annotation<string>({ default: () => "" }),
      });

      const brokenGraph = new StateGraph(TestState).addNode(
        "test",
        (state) => ({ value: state.value + "!" })
      );

      // Create a spy for the error callback
      const errorSpy = jest.fn();

      // Should call the error callback
      const compileWithErrorHandling = withErrorHandling(brokenGraph, errorSpy);

      try {
        compileWithErrorHandling();
      } catch (error) {
        // Expected to throw
      }

      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe("createRetryingLLM", () => {
    test("should retry on temporary failures", async () => {
      // LLM that fails first 2 times, then succeeds
      const llm = new MockChatModel(2, "unavailable");
      const retryingLLM = createRetryingLLM(llm, 3);

      const result = await retryingLLM.invoke([new HumanMessage("test")]);

      expect(result.content).toBe("Mock response");
      expect(llm.callCount).toBe(3); // Initial attempt + 2 retries
    });

    test("should retry on rate limit errors", async () => {
      // LLM that fails with rate limit error once, then succeeds
      const llm = new MockChatModel(1, "rate-limit");
      const retryingLLM = createRetryingLLM(llm, 3);

      const result = await retryingLLM.invoke([new HumanMessage("test")]);

      expect(result.content).toBe("Mock response");
      expect(llm.callCount).toBe(2); // Initial attempt + 1 retry
    });

    test("should throw error after max retries", async () => {
      // LLM that always fails with unavailability
      const llm = new MockChatModel(10, "unavailable");
      const retryingLLM = createRetryingLLM(llm, 2);

      await expect(
        retryingLLM.invoke([new HumanMessage("test")])
      ).rejects.toThrow(/Failed after 3 attempts/);
      expect(llm.callCount).toBe(3); // Initial attempt + 2 retries
    });

    test("should not retry on context window errors", async () => {
      // LLM that fails with context window error
      const llm = new MockChatModel(1, "context-window");
      const retryingLLM = createRetryingLLM(llm, 3);

      await expect(
        retryingLLM.invoke([new HumanMessage("test")])
      ).rejects.toThrow();
      expect(llm.callCount).toBe(1); // Only the initial attempt, no retries
    });
  });

  describe("createNodeErrorHandler", () => {
    test("should handle errors in node function", async () => {
      // Create a node function that sometimes throws
      const nodeFunc = jest
        .fn<Promise<{ value: string }>, [{ count: number }]>()
        .mockImplementationOnce(() => {
          throw new Error("Test error");
        })
        .mockResolvedValueOnce({ value: "success" });

      // Create error handler
      const withErrorHandler = createNodeErrorHandler("test-node");
      const safeNodeFunc = withErrorHandler(nodeFunc);

      // First call should not throw but pass the error info
      await expect(safeNodeFunc({ count: 1 })).rejects.toThrow("Test error");

      // Second call should return normally
      const result = await safeNodeFunc({ count: 2 });
      expect(result.value).toBe("success");
    });

    test("should use fallback behavior when provided", async () => {
      // Create a node function that always throws
      const nodeFunc = jest
        .fn<Promise<{ value: string }>, [{ count: number }]>()
        .mockImplementation(() => {
          throw new Error("Test error");
        });

      // Create fallback behavior
      const fallback = jest
        .fn<Promise<{ value: string }>, [{ count: number }, Error]>()
        .mockResolvedValue({ value: "fallback" });

      // Create error handler with fallback
      const withErrorHandler = createNodeErrorHandler("test-node", fallback);
      const safeNodeFunc = withErrorHandler(nodeFunc);

      // Call should use fallback and not throw
      const result = await safeNodeFunc({ count: 1 });

      expect(result.value).toBe("fallback");
      expect(fallback).toHaveBeenCalled();
    });

    test("should handle errors in the fallback", async () => {
      // Create a node function that throws
      const nodeFunc = jest
        .fn<Promise<{ value: string }>, [{ count: number }]>()
        .mockImplementation(() => {
          throw new Error("Primary error");
        });

      // Create fallback that also throws
      const fallback = jest
        .fn<Promise<{ value: string }>, [{ count: number }, Error]>()
        .mockImplementation(() => {
          throw new Error("Fallback error");
        });

      // Create error handler with fallback
      const withErrorHandler = createNodeErrorHandler("test-node", fallback);
      const safeNodeFunc = withErrorHandler(nodeFunc);

      // Call should still throw the original error
      await expect(safeNodeFunc({ count: 1 })).rejects.toThrow("Primary error");
      expect(fallback).toHaveBeenCalled();
    });

    test("should handle context window exceeded error specially", async () => {
      // Create a node function that throws a context window error
      const nodeFunc = jest
        .fn<
          Promise<{ messages: BaseMessage[] }>,
          [{ messages: BaseMessage[] }]
        >()
        .mockImplementation(() => {
          const error = new Error("Context length exceeded");
          throw error;
        });

      // Create error handler
      const withErrorHandler = createNodeErrorHandler<
        { messages: BaseMessage[] },
        { messages: BaseMessage[] }
      >("test-node");
      const safeNodeFunc = withErrorHandler(nodeFunc);

      // Initial state with messages
      const state = {
        messages: [new HumanMessage("test")],
      };

      try {
        // Call should throw
        await safeNodeFunc(state);
        fail("Should have thrown");
      } catch (error) {
        // Expected to throw
        expect((error as Error).message).toContain("Context length exceeded");
      }
    });
  });

  describe("createRetryingNode", () => {
    test("should retry on temporary failures", async () => {
      // Create a node function that fails twice then succeeds
      const nodeFunc = jest
        .fn<Promise<{ value: string }>, [{ count: number }]>()
        .mockRejectedValueOnce(new Error("Service unavailable"))
        .mockRejectedValueOnce(new Error("Service unavailable"))
        .mockResolvedValueOnce({ value: "success" });

      // Create retry wrapper
      const withRetries = createRetryingNode("test-node", 3);
      const retryingFunc = withRetries(nodeFunc);

      // Call should succeed after retries
      const result = await retryingFunc({ count: 1 });

      expect(result.value).toBe("success");
      expect(nodeFunc).toHaveBeenCalledTimes(3);
    });

    test("should give up after max retries", async () => {
      // Create a node function that always fails
      const nodeFunc = jest
        .fn<Promise<{ value: string }>, [{ count: number }]>()
        .mockRejectedValue(new Error("Service unavailable"));

      // Create retry wrapper with 2 max retries
      const withRetries = createRetryingNode("test-node", 2);
      const retryingFunc = withRetries(nodeFunc);

      // Call should fail after max retries
      await expect(retryingFunc({ count: 1 })).rejects.toThrow(
        "Service unavailable"
      );
      expect(nodeFunc).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    test("should not retry errors that should not be retried", async () => {
      // Create a node function that fails with non-retriable error
      const nodeFunc = jest
        .fn<Promise<{ value: string }>, [{ count: number }]>()
        .mockRejectedValue(new Error("Context length exceeded"));

      // Create retry wrapper
      const withRetries = createRetryingNode("test-node", 3);
      const retryingFunc = withRetries(nodeFunc);

      // Call should fail immediately without retry
      await expect(retryingFunc({ count: 1 })).rejects.toThrow(
        "Context length exceeded"
      );
      expect(nodeFunc).toHaveBeenCalledTimes(1); // Only the initial attempt
    });
  });

  describe("withNodeResilience", () => {
    test("should combine retry and error handling", async () => {
      // Create a node function that fails once then succeeds
      const nodeFunc = jest
        .fn<Promise<{ value: string }>, [{ count: number }]>()
        .mockRejectedValueOnce(new Error("Service unavailable"))
        .mockResolvedValueOnce({ value: "success" });

      // Create combined wrapper
      const withResilience = withNodeResilience("test-node", 3);
      const resilientFunc = withResilience(nodeFunc);

      // Call should succeed after retry
      const result = await resilientFunc({ count: 1 });

      expect(result.value).toBe("success");
      expect(nodeFunc).toHaveBeenCalledTimes(2);
    });

    test("should use fallback after max retries", async () => {
      // Create a node function that always fails
      const nodeFunc = jest
        .fn<Promise<{ value: string }>, [{ count: number }]>()
        .mockRejectedValue(new Error("Service unavailable"));

      // Create fallback
      const fallback = jest
        .fn<Promise<{ value: string }>, [{ count: number }, Error]>()
        .mockResolvedValue({ value: "fallback" });

      // Create combined wrapper with fallback
      const withResilience = withNodeResilience("test-node", 2, fallback);
      const resilientFunc = withResilience(nodeFunc);

      // Call should use fallback after max retries
      const result = await resilientFunc({ count: 1 });

      expect(result.value).toBe("fallback");
      expect(nodeFunc).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(fallback).toHaveBeenCalled();
    });

    test("should handle errors in the fallback", async () => {
      // Create a node function that always fails
      const nodeFunc = jest
        .fn<Promise<{ value: string }>, [{ count: number }]>()
        .mockRejectedValue(new Error("Primary error"));

      // Create fallback that also fails
      const fallback = jest
        .fn<Promise<{ value: string }>, [{ count: number }, Error]>()
        .mockRejectedValue(new Error("Fallback error"));

      // Create combined wrapper with failing fallback
      const withResilience = withNodeResilience("test-node", 1, fallback);
      const resilientFunc = withResilience(nodeFunc);

      // Call should fail with original error
      await expect(resilientFunc({ count: 1 })).rejects.toThrow(
        "Primary error"
      );
      expect(nodeFunc).toHaveBeenCalledTimes(2); // Initial + 1 retry
      expect(fallback).toHaveBeenCalled();
    });
  });
});
