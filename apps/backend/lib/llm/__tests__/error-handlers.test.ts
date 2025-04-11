/**
 * Test suite for error handling utilities
 *
 * Part of Task #14.4: Implement Base Error Classification and Retry Mechanisms
 */

import { StateGraph, END } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { Runnable, RunnableConfig } from "@langchain/core/runnables";

import {
  withErrorHandling,
  createRetryingLLM,
  createNodeErrorHandler,
  createRetryingNode,
} from "../error-handlers.js";
import {
  ErrorCategory,
  ErrorEvent,
  ErrorStateAnnotation,
  createErrorEvent,
} from "../error-classification.js";
import {
  LLMClient,
  LLMCompletionOptions,
  LLMCompletionResponse,
} from "../types.js";

// Mock dependencies
jest.mock("@langchain/langgraph", () => {
  const originalModule = jest.requireActual("@langchain/langgraph");
  return {
    ...originalModule,
    StateGraph: jest.fn().mockImplementation(() => ({
      addNode: jest.fn().mockReturnThis(),
      addEdge: jest.fn().mockReturnThis(),
      setEntryPoint: jest.fn().mockReturnThis(),
      setFinishPoint: jest.fn().mockReturnThis(),
      getSchema: jest.fn().mockReturnValue({
        rootType: { annotations: {} },
      }),
      compile: jest.fn().mockReturnValue({
        invoke: jest.fn().mockImplementation(async (state) => {
          return state;
        }),
      }),
    })),
    END: "END_STATE",
  };
});

describe("Error Handling Utilities", () => {
  describe("withErrorHandling", () => {
    it("should add error handling to StateGraph", async () => {
      // Create a basic graph with error annotation
      const baseGraph = new StateGraph({
        channels: {
          errors: ErrorStateAnnotation,
        },
      });

      // Mock graph behavior
      const mockInvoke = jest.fn().mockResolvedValue({
        result: "success",
        errors: [],
      });

      const compiledGraph = {
        invoke: mockInvoke,
      };
      (baseGraph.compile as jest.Mock).mockReturnValue(compiledGraph);

      // Apply error handling
      const graphWithErrorHandling = withErrorHandling(baseGraph);

      // Invoke the graph
      const initialState = { input: "test input", errors: [] };
      await graphWithErrorHandling.invoke(initialState);

      // Verify that the original graph was invoked
      expect(mockInvoke).toHaveBeenCalledWith(initialState);
    });

    it("should handle schema extraction errors gracefully", async () => {
      // Create a graph that will throw an error during schema extraction
      const baseGraph = new StateGraph({});
      (baseGraph.getSchema as jest.Mock).mockImplementation(() => {
        throw new Error("Schema extraction failed");
      });

      // Apply error handling
      const graphWithErrorHandling = withErrorHandling(baseGraph);

      // Invoke the graph - should not throw
      const initialState = { input: "test input" };
      const result = await graphWithErrorHandling.invoke(initialState);

      // Should add error information to the result
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].message).toContain("Schema extraction failed");
    });
  });

  describe("createRetryingLLM", () => {
    // Mock LLM client
    let mockLLMClient: jest.Mocked<LLMClient>;
    let mockCompletion: jest.Mock;

    beforeEach(() => {
      mockCompletion = jest.fn();
      mockLLMClient = {
        supportedModels: [],
        completion: mockCompletion,
        streamCompletion: jest.fn(),
        estimateTokens: jest.fn(),
      };
    });

    it("should return successful completion on first try", async () => {
      // Mock successful completion
      const successResponse: LLMCompletionResponse = {
        content: "Successful response",
        metadata: {
          model: "test-model",
          totalTokens: 10,
          promptTokens: 5,
          completionTokens: 5,
          timeTakenMs: 100,
          cost: 0.001,
        },
      };
      mockCompletion.mockResolvedValueOnce(successResponse);

      // Create retrying LLM
      const retryingLLM = createRetryingLLM(mockLLMClient);

      // Call with options
      const options: LLMCompletionOptions = {
        model: "test-model",
        messages: [{ role: "user", content: "test prompt" }],
      };

      const result = await retryingLLM(options);

      // Should return successful response without retrying
      expect(result).toBe(successResponse);
      expect(mockCompletion).toHaveBeenCalledTimes(1);
    });

    it("should retry on retryable error and succeed", async () => {
      // Mock failure then success
      mockCompletion
        .mockRejectedValueOnce(new Error("Service unavailable"))
        .mockResolvedValueOnce({
          content: "Successful after retry",
          metadata: {
            model: "test-model",
            totalTokens: 10,
            promptTokens: 5,
            completionTokens: 5,
            timeTakenMs: 100,
            cost: 0.001,
          },
        });

      // Create retrying LLM with custom config
      const retryingLLM = createRetryingLLM(mockLLMClient, {
        maxRetries: 3,
        initialBackoffMs: 10, // Small for faster tests
      });

      // Call with options
      const options: LLMCompletionOptions = {
        model: "test-model",
        messages: [{ role: "user", content: "test prompt" }],
      };

      const result = await retryingLLM(options);

      // Should retry and succeed
      expect(result.content).toBe("Successful after retry");
      expect(mockCompletion).toHaveBeenCalledTimes(2);
    });

    it("should not retry on non-retryable errors", async () => {
      // Mock context window error (non-retryable)
      mockCompletion.mockRejectedValueOnce(
        new Error("Maximum context length exceeded")
      );

      // Create retrying LLM
      const retryingLLM = createRetryingLLM(mockLLMClient);

      // Call with options
      const options: LLMCompletionOptions = {
        model: "test-model",
        messages: [{ role: "user", content: "test prompt" }],
      };

      // Should throw without retrying
      await expect(retryingLLM(options)).rejects.toThrow(
        "Maximum context length exceeded"
      );
      expect(mockCompletion).toHaveBeenCalledTimes(1);
    });

    it("should stop retrying after max retries reached", async () => {
      // Mock repeated failures
      mockCompletion
        .mockRejectedValueOnce(new Error("Rate limit exceeded"))
        .mockRejectedValueOnce(new Error("Rate limit exceeded"))
        .mockRejectedValueOnce(new Error("Rate limit exceeded"));

      // Create retrying LLM with low max retries
      const retryingLLM = createRetryingLLM(mockLLMClient, {
        maxRetries: 2,
        initialBackoffMs: 10, // Small for faster tests
      });

      // Call with options
      const options: LLMCompletionOptions = {
        model: "test-model",
        messages: [{ role: "user", content: "test prompt" }],
      };

      // Should throw after max retries
      await expect(retryingLLM(options)).rejects.toThrow("Rate limit exceeded");
      expect(mockCompletion).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it("should pass an onError callback when provided", async () => {
      // Mock failure then success
      mockCompletion
        .mockRejectedValueOnce(new Error("Service unavailable"))
        .mockResolvedValueOnce({
          content: "Successful after retry",
          metadata: {
            model: "test-model",
            totalTokens: 10,
            promptTokens: 5,
            completionTokens: 5,
            timeTakenMs: 100,
            cost: 0.001,
          },
        });

      // Create error tracking callback
      const onErrorMock = jest.fn();

      // Create retrying LLM
      const retryingLLM = createRetryingLLM(mockLLMClient, {
        maxRetries: 3,
        initialBackoffMs: 10,
        onError: onErrorMock,
      });

      // Call with options
      const options: LLMCompletionOptions = {
        model: "test-model",
        messages: [{ role: "user", content: "test prompt" }],
      };

      await retryingLLM(options);

      // Should call onError callback
      expect(onErrorMock).toHaveBeenCalledTimes(1);
      expect(onErrorMock.mock.calls[0][0].category).toBe(
        ErrorCategory.LLM_UNAVAILABLE
      );
      expect(onErrorMock.mock.calls[0][0].retryCount).toBe(0);
    });
  });

  describe("createNodeErrorHandler", () => {
    it("should pass through function results when no errors occur", async () => {
      // Test node function that succeeds
      const nodeFunction = jest.fn().mockResolvedValue({ result: "success" });

      // Create error handler
      const handledFunction = createNodeErrorHandler(nodeFunction, "testNode");

      // Call function
      const result = await handledFunction({ input: "test" });

      // Should return original result
      expect(result).toEqual({ result: "success" });
      expect(nodeFunction).toHaveBeenCalledWith({ input: "test" });
    });

    it("should add error information to state when error occurs", async () => {
      // Test node function that fails
      const nodeFunction = jest.fn().mockRejectedValue(new Error("Node error"));

      // Create error handler
      const handledFunction = createNodeErrorHandler(nodeFunction, "testNode");

      // Call function
      const result = await handledFunction({ input: "test" });

      // Should add error information
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].message).toBe("Node error");
      expect(result.errors[0].node).toBe("testNode");
      expect(result.lastError).toBeDefined();
      expect(result.lastError.message).toBe("Node error");
    });

    it("should append new errors to existing errors array", async () => {
      // Existing error
      const existingError = createErrorEvent(
        new Error("Existing error"),
        "previousNode"
      );

      // Test node function that fails
      const nodeFunction = jest.fn().mockRejectedValue(new Error("New error"));

      // Create error handler
      const handledFunction = createNodeErrorHandler(nodeFunction, "testNode");

      // Call function with existing errors
      const result = await handledFunction({
        input: "test",
        errors: [existingError],
      });

      // Should add new error while preserving existing
      expect(result.errors.length).toBe(2);
      expect(result.errors[0].message).toBe("Existing error");
      expect(result.errors[1].message).toBe("New error");
      expect(result.lastError.message).toBe("New error");
    });
  });

  describe("createRetryingNode", () => {
    it("should not retry if node function succeeds", async () => {
      // Successful node function
      const nodeFunction = jest.fn().mockResolvedValue({ result: "success" });

      // Create retrying node
      const retryingNode = createRetryingNode(nodeFunction, "testNode");

      // Call function
      const result = await retryingNode({ input: "test" });

      // Should return success without retrying
      expect(result).toEqual({ result: "success" });
      expect(nodeFunction).toHaveBeenCalledTimes(1);
    });

    it("should retry on retryable errors", async () => {
      // Node function that fails with retryable error then succeeds
      const nodeFunction = jest
        .fn()
        .mockRejectedValueOnce(new Error("Service unavailable"))
        .mockResolvedValueOnce({ result: "success after retry" });

      // Create retrying node
      const retryingNode = createRetryingNode(nodeFunction, "testNode", {
        maxRetries: 2,
        initialBackoffMs: 10, // Small for faster tests
      });

      // Call function
      const result = await retryingNode({ input: "test" });

      // Should retry and succeed
      expect(result).toEqual({ result: "success after retry" });
      expect(nodeFunction).toHaveBeenCalledTimes(2);
    });

    it("should not retry on non-retryable errors", async () => {
      // Node function that fails with non-retryable error
      const nodeFunction = jest
        .fn()
        .mockRejectedValueOnce(new Error("Context window exceeded"));

      // Create retrying node
      const retryingNode = createRetryingNode(nodeFunction, "testNode");

      // Call function
      const result = await retryingNode({ input: "test" });

      // Should not retry, but add error information to state
      expect(nodeFunction).toHaveBeenCalledTimes(1);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].category).toBe(
        ErrorCategory.CONTEXT_WINDOW_EXCEEDED
      );
    });

    it("should stop retrying after max retries reached", async () => {
      // Node function that repeatedly fails with retryable error
      const nodeFunction = jest
        .fn()
        .mockRejectedValueOnce(new Error("Rate limit exceeded"))
        .mockRejectedValueOnce(new Error("Rate limit exceeded"))
        .mockRejectedValueOnce(new Error("Rate limit exceeded"));

      // Create retrying node with 2 max retries
      const retryingNode = createRetryingNode(nodeFunction, "testNode", {
        maxRetries: 2,
        initialBackoffMs: 10, // Small for faster tests
      });

      // Call function
      const result = await retryingNode({ input: "test" });

      // Should retry max times then return error state
      expect(nodeFunction).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].category).toBe(ErrorCategory.RATE_LIMIT_EXCEEDED);
      expect(result.errors[0].retryCount).toBe(2);
    });

    it("should track retry count correctly", async () => {
      // Node function that fails twice with retryable error then succeeds
      const nodeFunction = jest
        .fn()
        .mockRejectedValueOnce(new Error("Service unavailable"))
        .mockRejectedValueOnce(new Error("Service unavailable"))
        .mockResolvedValueOnce({ result: "success after retries" });

      // Create retrying node
      const retryingNode = createRetryingNode(nodeFunction, "testNode", {
        maxRetries: 3,
        initialBackoffMs: 10, // Small for faster tests
      });

      // Call function
      const result = await retryingNode({ input: "test" });

      // Should retry twice then succeed with recovery attempt count = 2
      expect(result).toEqual({
        result: "success after retries",
        recoveryAttempts: 2,
      });
      expect(nodeFunction).toHaveBeenCalledTimes(3);
    });

    it("should maintain error history when retrying", async () => {
      // Existing error
      const existingError = createErrorEvent(
        new Error("Previous error"),
        "previousNode"
      );

      // Node function that fails with retryable error then succeeds
      const nodeFunction = jest
        .fn()
        .mockRejectedValueOnce(new Error("Service unavailable"))
        .mockResolvedValueOnce({ result: "success after retry" });

      // Create retrying node
      const retryingNode = createRetryingNode(nodeFunction, "testNode", {
        maxRetries: 2,
        initialBackoffMs: 10, // Small for faster tests
      });

      // Call function with existing error
      const result = await retryingNode({
        input: "test",
        errors: [existingError],
      });

      // Should return success with recovery count and maintain error history
      expect(result.result).toBe("success after retry");
      expect(result.recoveryAttempts).toBe(1);
      expect(result.errors.length).toBe(2); // Previous error + temporary retry error
      expect(result.errors[0].message).toBe("Previous error");
      expect(result.errors[1].message).toBe("Service unavailable");
    });
  });
});
