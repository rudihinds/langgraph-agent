/**
 * Test suite for error classification and retry logic
 *
 * Part of Task #14.4: Implement Base Error Classification and Retry Mechanisms
 */

import {
  ErrorCategory,
  classifyError,
  createErrorEvent,
  addErrorToState,
  shouldRetry,
  calculateBackoff,
  createErrorResponseMessage,
  ErrorState,
} from "../error-classification.js";

describe("Error Classification System", () => {
  describe("classifyError", () => {
    test("should classify rate limit errors", () => {
      expect(classifyError(new Error("Rate limit exceeded"))).toBe(
        ErrorCategory.RATE_LIMIT_EXCEEDED
      );
      expect(classifyError(new Error("429 Too Many Requests: ratelimit"))).toBe(
        ErrorCategory.RATE_LIMIT_EXCEEDED
      );
    });

    test("should classify context window errors", () => {
      expect(classifyError(new Error("Maximum context length exceeded"))).toBe(
        ErrorCategory.CONTEXT_WINDOW_EXCEEDED
      );
      expect(
        classifyError(
          new Error("This model's maximum context length is 16385 tokens")
        )
      ).toBe(ErrorCategory.CONTEXT_WINDOW_EXCEEDED);
      expect(
        classifyError(
          new Error("Input is too long, maximum token limit is 32768")
        )
      ).toBe(ErrorCategory.CONTEXT_WINDOW_EXCEEDED);
    });

    test("should classify LLM unavailable errors", () => {
      expect(
        classifyError(new Error("Service unavailable, try again later"))
      ).toBe(ErrorCategory.LLM_UNAVAILABLE);
      expect(classifyError(new Error("500 Internal Server Error"))).toBe(
        ErrorCategory.LLM_UNAVAILABLE
      );
      expect(
        classifyError(new Error("Request timed out after 30 seconds"))
      ).toBe(ErrorCategory.LLM_UNAVAILABLE);
      expect(classifyError(new Error("Connection reset by peer"))).toBe(
        ErrorCategory.LLM_UNAVAILABLE
      );
    });

    test("should classify tool execution errors", () => {
      expect(classifyError(new Error("Tool execution failed"))).toBe(
        ErrorCategory.TOOL_EXECUTION_ERROR
      );
      expect(
        classifyError(new Error("The weather tool encountered an error"))
      ).toBe(ErrorCategory.TOOL_EXECUTION_ERROR);
    });

    test("should classify invalid response format errors", () => {
      expect(classifyError(new Error("Invalid JSON format in response"))).toBe(
        ErrorCategory.INVALID_RESPONSE_FORMAT
      );
      expect(classifyError(new Error("Failed to parse the model output"))).toBe(
        ErrorCategory.INVALID_RESPONSE_FORMAT
      );
      expect(
        classifyError(
          new Error("Response format does not match expected schema")
        )
      ).toBe(ErrorCategory.INVALID_RESPONSE_FORMAT);
    });

    test("should classify checkpoint errors", () => {
      expect(classifyError(new Error("Failed to load checkpoint"))).toBe(
        ErrorCategory.CHECKPOINT_ERROR
      );
      expect(
        classifyError(new Error("Error saving state to persistent storage"))
      ).toBe(ErrorCategory.CHECKPOINT_ERROR);
    });

    test("should classify summarization errors", () => {
      expect(classifyError(new Error("Summarization failed"))).toBe(
        ErrorCategory.LLM_SUMMARIZATION_ERROR
      );
      expect(
        classifyError(new Error("Error generating summary for conversation"))
      ).toBe(ErrorCategory.LLM_SUMMARIZATION_ERROR);
      expect(
        classifyError(new Error("Summary too long for available context"))
      ).toBe(ErrorCategory.LLM_SUMMARIZATION_ERROR);
    });

    test("should classify context window management errors", () => {
      expect(classifyError(new Error("Context window error"))).toBe(
        ErrorCategory.CONTEXT_WINDOW_ERROR
      );
      expect(
        classifyError(new Error("Failed to fit messages within window size"))
      ).toBe(ErrorCategory.CONTEXT_WINDOW_ERROR);
      expect(
        classifyError(new Error("Error managing maximum tokens for the model"))
      ).toBe(ErrorCategory.CONTEXT_WINDOW_ERROR);
    });

    test("should classify token calculation errors", () => {
      expect(classifyError(new Error("Token calculation failed"))).toBe(
        ErrorCategory.TOKEN_CALCULATION_ERROR
      );
      expect(
        classifyError(new Error("Error estimating tokens for message"))
      ).toBe(ErrorCategory.TOKEN_CALCULATION_ERROR);
      expect(classifyError(new Error("Invalid token count result"))).toBe(
        ErrorCategory.TOKEN_CALCULATION_ERROR
      );
    });

    test("should classify unknown errors", () => {
      expect(classifyError(new Error("Some completely random error"))).toBe(
        ErrorCategory.UNKNOWN
      );
      expect(classifyError(new Error(""))).toBe(ErrorCategory.UNKNOWN);
    });
  });

  describe("createErrorEvent", () => {
    test("should create error event with Error object", () => {
      const error = new Error("Test error");
      const event = createErrorEvent(error, "testNode", 2, true);

      expect(event.message).toBe("Test error");
      expect(event.category).toBe(ErrorCategory.UNKNOWN);
      expect(event.node).toBe("testNode");
      expect(event.retryCount).toBe(2);
      expect(event.fatal).toBe(true);
      expect(typeof event.timestamp).toBe("string");
    });

    test("should create error event with params object", () => {
      const error = new Error("Test error");
      const event = createErrorEvent({
        category: ErrorCategory.CONTEXT_WINDOW_ERROR,
        error,
        nodeName: "testNode",
        source: "testFunction",
        modelId: "gpt-4",
        retryCount: 3,
        fatal: true,
      });

      expect(event.message).toBe("Test error");
      expect(event.category).toBe(ErrorCategory.CONTEXT_WINDOW_ERROR);
      expect(event.node).toBe("testNode");
      expect(event.source).toBe("testFunction");
      expect(event.modelId).toBe("gpt-4");
      expect(event.retryCount).toBe(3);
      expect(event.fatal).toBe(true);
    });

    test("should use default values when not specified", () => {
      const error = new Error("Test error");
      const event = createErrorEvent(error);

      expect(event.message).toBe("Test error");
      expect(event.fatal).toBe(false);
      expect(event.node).toBeUndefined();
      expect(event.retryCount).toBeUndefined();
    });
  });

  describe("addErrorToState", () => {
    test("should add error to existing state", () => {
      const state = {
        errors: [
          {
            timestamp: "2023-01-01T00:00:00.000Z",
            category: ErrorCategory.UNKNOWN,
            message: "Previous error",
          },
        ],
        otherProperty: "value",
      };

      const error = new Error("New error");
      const result = addErrorToState(state, error, "testNode");

      expect(result.errors.length).toBe(2);
      expect(result.errors[0].message).toBe("Previous error");
      expect(result.errors[1].message).toBe("New error");
      expect(result.lastError.message).toBe("New error");
      expect(result.lastError.node).toBe("testNode");
    });

    test("should initialize errors array if not present", () => {
      const state = {
        otherProperty: "value",
      };

      const error = new Error("New error");
      const result = addErrorToState(state, error);

      expect(result.errors.length).toBe(1);
      expect(result.errors[0].message).toBe("New error");
      expect(result.lastError.message).toBe("New error");
    });
  });

  describe("shouldRetry", () => {
    test("should not retry if max retries reached", () => {
      const error = {
        timestamp: new Date().toISOString(),
        category: ErrorCategory.RATE_LIMIT_EXCEEDED,
        message: "Rate limit exceeded",
      };

      expect(shouldRetry(error, 3, 3)).toBe(false);
      expect(shouldRetry(error, 4, 3)).toBe(false);
    });

    test("should not retry if error is fatal", () => {
      const error = {
        timestamp: new Date().toISOString(),
        category: ErrorCategory.LLM_UNAVAILABLE,
        message: "Service unavailable",
        fatal: true,
      };

      expect(shouldRetry(error, 0, 3)).toBe(false);
    });

    test("should always retry unavailable and rate limit errors", () => {
      expect(
        shouldRetry(
          {
            timestamp: new Date().toISOString(),
            category: ErrorCategory.LLM_UNAVAILABLE,
            message: "Service unavailable",
          },
          0,
          3
        )
      ).toBe(true);

      expect(
        shouldRetry(
          {
            timestamp: new Date().toISOString(),
            category: ErrorCategory.RATE_LIMIT_EXCEEDED,
            message: "Rate limit exceeded",
          },
          1,
          3
        )
      ).toBe(true);
    });

    test("should not retry context window errors by default", () => {
      expect(
        shouldRetry(
          {
            timestamp: new Date().toISOString(),
            category: ErrorCategory.CONTEXT_WINDOW_EXCEEDED,
            message: "Context window exceeded",
          },
          0,
          3
        )
      ).toBe(false);

      expect(
        shouldRetry(
          {
            timestamp: new Date().toISOString(),
            category: ErrorCategory.CONTEXT_WINDOW_ERROR,
            message: "Context window error",
          },
          0,
          3
        )
      ).toBe(false);
    });

    test("should retry token calculation and summarization errors once", () => {
      // First attempt should retry
      expect(
        shouldRetry(
          {
            timestamp: new Date().toISOString(),
            category: ErrorCategory.TOKEN_CALCULATION_ERROR,
            message: "Token calculation failed",
          },
          0,
          3
        )
      ).toBe(true);

      // Second attempt should not retry
      expect(
        shouldRetry(
          {
            timestamp: new Date().toISOString(),
            category: ErrorCategory.TOKEN_CALCULATION_ERROR,
            message: "Token calculation failed",
          },
          1,
          3
        )
      ).toBe(false);

      // First attempt should retry
      expect(
        shouldRetry(
          {
            timestamp: new Date().toISOString(),
            category: ErrorCategory.LLM_SUMMARIZATION_ERROR,
            message: "Summarization failed",
          },
          0,
          3
        )
      ).toBe(true);

      // Second attempt should not retry
      expect(
        shouldRetry(
          {
            timestamp: new Date().toISOString(),
            category: ErrorCategory.LLM_SUMMARIZATION_ERROR,
            message: "Summarization failed",
          },
          1,
          3
        )
      ).toBe(false);
    });

    test("should retry unknown errors once by default", () => {
      expect(
        shouldRetry(
          {
            timestamp: new Date().toISOString(),
            category: ErrorCategory.UNKNOWN,
            message: "Unknown error",
          },
          0,
          3
        )
      ).toBe(true);

      expect(
        shouldRetry(
          {
            timestamp: new Date().toISOString(),
            category: ErrorCategory.UNKNOWN,
            message: "Unknown error",
          },
          1,
          3
        )
      ).toBe(false);
    });
  });

  describe("calculateBackoff", () => {
    test("should calculate exponential backoff with jitter", () => {
      // First retry (0-based index)
      const firstRetry = calculateBackoff(0, 1000, 30000);
      expect(firstRetry).toBeGreaterThanOrEqual(800); // 1000 * 2^0 with max 20% jitter
      expect(firstRetry).toBeLessThanOrEqual(1200);

      // Second retry
      const secondRetry = calculateBackoff(1, 1000, 30000);
      expect(secondRetry).toBeGreaterThanOrEqual(1600); // 1000 * 2^1 with max 20% jitter
      expect(secondRetry).toBeLessThanOrEqual(2400);

      // Third retry
      const thirdRetry = calculateBackoff(2, 1000, 30000);
      expect(thirdRetry).toBeGreaterThanOrEqual(3200); // 1000 * 2^2 with max 20% jitter
      expect(thirdRetry).toBeLessThanOrEqual(4800);
    });

    test("should respect maximum delay", () => {
      // Very high retry count would exceed max
      const highRetry = calculateBackoff(10, 1000, 5000);
      expect(highRetry).toBeLessThanOrEqual(5000);
    });
  });

  describe("createErrorResponseMessage", () => {
    test("should create appropriate messages for different error categories", () => {
      const categories = Object.values(ErrorCategory);

      for (const category of categories) {
        const error = {
          timestamp: new Date().toISOString(),
          category: category as ErrorCategory,
          message: "Test error",
        };

        const message = createErrorResponseMessage(error);

        expect(message.content).toContain("I encountered an error");
        // Each error category should have custom text
        expect(message.content.length).toBeGreaterThan(50);
      }
    });

    test("should handle context window errors with appropriate message", () => {
      const error = {
        timestamp: new Date().toISOString(),
        category: ErrorCategory.CONTEXT_WINDOW_ERROR,
        message: "Context window error",
      };

      const message = createErrorResponseMessage(error);
      expect(message.content).toContain("conversation has become too long");
    });
  });
});
