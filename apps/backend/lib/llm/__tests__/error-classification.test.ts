/**
 * Test suite for error classification utilities
 */

import {
  ErrorCategory,
  classifyError,
  createErrorEvent,
  addErrorToState,
  shouldRetry,
  calculateBackoff,
  createErrorResponseMessage,
} from "../error-classification.js";

describe("Error Classification System", () => {
  describe("classifyError", () => {
    test("should classify rate limit errors", () => {
      expect(classifyError(new Error("Rate limit exceeded"))).toBe(
        ErrorCategory.RATE_LIMIT_EXCEEDED
      );
      expect(classifyError(new Error("Too many requests: rate limit"))).toBe(
        ErrorCategory.RATE_LIMIT_EXCEEDED
      );
      expect(classifyError(new Error("ratelimit reached for API"))).toBe(
        ErrorCategory.RATE_LIMIT_EXCEEDED
      );
    });

    test("should classify context window errors", () => {
      expect(classifyError(new Error("Context length exceeded"))).toBe(
        ErrorCategory.CONTEXT_WINDOW_EXCEEDED
      );
      expect(
        classifyError(
          new Error("This input exceeds the maximum context length")
        )
      ).toBe(ErrorCategory.CONTEXT_WINDOW_EXCEEDED);
      expect(classifyError(new Error("Input is too long"))).toBe(
        ErrorCategory.CONTEXT_WINDOW_EXCEEDED
      );
      expect(classifyError(new Error("Token limit exceeded"))).toBe(
        ErrorCategory.CONTEXT_WINDOW_EXCEEDED
      );
    });

    test("should classify LLM unavailable errors", () => {
      expect(classifyError(new Error("Service unavailable"))).toBe(
        ErrorCategory.LLM_UNAVAILABLE
      );
      expect(classifyError(new Error("Internal server error"))).toBe(
        ErrorCategory.LLM_UNAVAILABLE
      );
      expect(classifyError(new Error("Connection timeout"))).toBe(
        ErrorCategory.LLM_UNAVAILABLE
      );
      expect(classifyError(new Error("Network connection error"))).toBe(
        ErrorCategory.LLM_UNAVAILABLE
      );
    });

    test("should classify tool execution errors", () => {
      expect(classifyError(new Error("Tool execution failed"))).toBe(
        ErrorCategory.TOOL_EXECUTION_ERROR
      );
      expect(
        classifyError(new Error("Error in tool: database connection"))
      ).toBe(ErrorCategory.TOOL_EXECUTION_ERROR);
    });

    test("should classify invalid response format errors", () => {
      expect(classifyError(new Error("Invalid response format"))).toBe(
        ErrorCategory.INVALID_RESPONSE_FORMAT
      );
      expect(classifyError(new Error("Failed to parse JSON response"))).toBe(
        ErrorCategory.INVALID_RESPONSE_FORMAT
      );
      expect(classifyError(new Error("Invalid format from LLM"))).toBe(
        ErrorCategory.INVALID_RESPONSE_FORMAT
      );
    });

    test("should classify checkpoint errors", () => {
      expect(classifyError(new Error("Checkpoint could not be saved"))).toBe(
        ErrorCategory.CHECKPOINT_ERROR
      );
      expect(classifyError(new Error("State could not be restored"))).toBe(
        ErrorCategory.CHECKPOINT_ERROR
      );
    });

    test("should classify unknown errors", () => {
      expect(classifyError(new Error("Some random error"))).toBe(
        ErrorCategory.UNKNOWN
      );
      expect(classifyError(new Error(""))).toBe(ErrorCategory.UNKNOWN);
    });
  });

  describe("createErrorEvent", () => {
    test("should create a basic error event", () => {
      const error = new Error("Test error");
      const event = createErrorEvent(error);

      expect(event.message).toBe("Test error");
      expect(event.category).toBe(ErrorCategory.UNKNOWN);
      expect(event.timestamp).toBeDefined();
      expect(event.fatal).toBe(false);
      expect(event.node).toBeUndefined();
      expect(event.retryCount).toBeUndefined();
    });

    test("should include node name when provided", () => {
      const error = new Error("Test error");
      const event = createErrorEvent(error, "test-node");

      expect(event.message).toBe("Test error");
      expect(event.node).toBe("test-node");
    });

    test("should include retry count when provided", () => {
      const error = new Error("Test error");
      const event = createErrorEvent(error, "test-node", 2);

      expect(event.message).toBe("Test error");
      expect(event.node).toBe("test-node");
      expect(event.retryCount).toBe(2);
    });

    test("should include fatal flag when provided", () => {
      const error = new Error("Test error");
      const event = createErrorEvent(error, "test-node", 2, true);

      expect(event.message).toBe("Test error");
      expect(event.fatal).toBe(true);
    });

    test("should categorize error correctly", () => {
      const error = new Error("Rate limit exceeded");
      const event = createErrorEvent(error);

      expect(event.category).toBe(ErrorCategory.RATE_LIMIT_EXCEEDED);
    });
  });

  describe("addErrorToState", () => {
    test("should add error to empty state", () => {
      const state = {};
      const error = new Error("Test error");
      const result = addErrorToState(state, error);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Test error");
      expect(result.lastError).toBeDefined();
      expect(result.lastError.message).toBe("Test error");
    });

    test("should add error to state with existing errors", () => {
      const existingError = createErrorEvent(new Error("Existing error"));
      const state = {
        errors: [existingError],
      };
      const error = new Error("New error");
      const result = addErrorToState(state, error);

      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].message).toBe("Existing error");
      expect(result.errors[1].message).toBe("New error");
      expect(result.lastError.message).toBe("New error");
    });

    test("should include node name when provided", () => {
      const state = {};
      const error = new Error("Test error");
      const result = addErrorToState(state, error, "test-node");

      expect(result.errors[0].node).toBe("test-node");
      expect(result.lastError.node).toBe("test-node");
    });
  });

  describe("shouldRetry", () => {
    test("should not retry if at max retries", () => {
      const event = createErrorEvent(new Error("Test error"));
      expect(shouldRetry(event, 3, 3)).toBe(false);
      expect(shouldRetry(event, 4, 3)).toBe(false);
    });

    test("should not retry if error is marked fatal", () => {
      const event = createErrorEvent(
        new Error("Rate limit exceeded"),
        "test-node",
        1,
        true
      );
      expect(shouldRetry(event, 1, 3)).toBe(false);
    });

    test("should retry LLM unavailable errors", () => {
      const event = createErrorEvent(new Error("Service unavailable"));
      expect(shouldRetry(event, 0, 3)).toBe(true);
      expect(shouldRetry(event, 2, 3)).toBe(true);
    });

    test("should retry rate limit errors", () => {
      const event = createErrorEvent(new Error("Rate limit exceeded"));
      expect(shouldRetry(event, 0, 3)).toBe(true);
      expect(shouldRetry(event, 2, 3)).toBe(true);
    });

    test("should not retry context window errors by default", () => {
      const event = createErrorEvent(new Error("Context length exceeded"));
      expect(shouldRetry(event, 0, 3)).toBe(false);
    });

    test("should retry tool errors only once", () => {
      const event = createErrorEvent(new Error("Tool execution failed"));
      expect(shouldRetry(event, 0, 3)).toBe(true);
      expect(shouldRetry(event, 1, 3)).toBe(false);
    });

    test("should retry unknown errors only once", () => {
      const event = createErrorEvent(new Error("Unknown error"));
      expect(shouldRetry(event, 0, 3)).toBe(true);
      expect(shouldRetry(event, 1, 3)).toBe(false);
    });
  });

  describe("calculateBackoff", () => {
    test("should use exponential backoff", () => {
      // Calculate multiple values to check the pattern
      const backoff0 = calculateBackoff(0, 100, 1000);
      const backoff1 = calculateBackoff(1, 100, 1000);
      const backoff2 = calculateBackoff(2, 100, 1000);

      // The initial backoff should be near baseDelay (100ms)
      expect(backoff0).toBeGreaterThanOrEqual(80);
      expect(backoff0).toBeLessThanOrEqual(120);

      // Second retry should be near 2^1 * baseDelay (200ms)
      expect(backoff1).toBeGreaterThanOrEqual(160);
      expect(backoff1).toBeLessThanOrEqual(240);

      // Third retry should be near 2^2 * baseDelay (400ms)
      expect(backoff2).toBeGreaterThanOrEqual(320);
      expect(backoff2).toBeLessThanOrEqual(480);
    });

    test("should respect maximum delay", () => {
      // Try a retry count that would exceed the max
      const backoff = calculateBackoff(10, 100, 1000);

      // Should be capped at the max (1000ms)
      expect(backoff).toBeLessThanOrEqual(1000);
    });

    test("should apply jitter", () => {
      // Call multiple times with the same params to test jitter
      const values = Array.from({ length: 5 }, () =>
        calculateBackoff(1, 100, 1000)
      );

      // Check that at least some values are different (jitter applied)
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBeGreaterThan(1);
    });
  });

  describe("createErrorResponseMessage", () => {
    test("should create appropriate message for LLM unavailable", () => {
      const event = createErrorEvent(new Error("Service unavailable"));
      const message = createErrorResponseMessage(event);

      expect(message.content).toContain("temporarily unavailable");
    });

    test("should create appropriate message for context window exceeded", () => {
      const event = createErrorEvent(new Error("Context length exceeded"));
      const message = createErrorResponseMessage(event);

      expect(message.content).toContain("conversation has become too long");
    });

    test("should create appropriate message for rate limit exceeded", () => {
      const event = createErrorEvent(new Error("Rate limit exceeded"));
      const message = createErrorResponseMessage(event);

      expect(message.content).toContain("reached the usage limit");
    });

    test("should create appropriate message for tool execution error", () => {
      const event = createErrorEvent(new Error("Tool execution failed"));
      const message = createErrorResponseMessage(event);

      expect(message.content).toContain("trouble executing a tool");
    });

    test("should create appropriate message for invalid format", () => {
      const event = createErrorEvent(new Error("Invalid format"));
      const message = createErrorResponseMessage(event);

      expect(message.content).toContain("problem formatting my response");
    });

    test("should create generic message for unknown errors", () => {
      const event = createErrorEvent(new Error("Something weird"));
      const message = createErrorResponseMessage(event);

      expect(message.content).toContain("Something unexpected happened");
    });
  });
});
