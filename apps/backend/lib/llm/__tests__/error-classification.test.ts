import {
  ErrorCategory,
  classifyError,
  createErrorEvent,
  addErrorToState,
  shouldRetry,
  calculateBackoff,
  ErrorEventSchema,
} from "../error-classification";

describe("Error Classification", () => {
  describe("classifyError", () => {
    it("should classify rate limit errors", () => {
      expect(classifyError("rate limit exceeded")).toBe(
        ErrorCategory.RATE_LIMIT_ERROR
      );
      expect(classifyError("ratelimit reached")).toBe(
        ErrorCategory.RATE_LIMIT_ERROR
      );
      expect(classifyError("too many requests")).toBe(
        ErrorCategory.RATE_LIMIT_ERROR
      );
      expect(classifyError("429 error")).toBe(ErrorCategory.RATE_LIMIT_ERROR);
      expect(classifyError("quota exceeded")).toBe(
        ErrorCategory.RATE_LIMIT_ERROR
      );
      expect(classifyError(new Error("rate limit exceeded"))).toBe(
        ErrorCategory.RATE_LIMIT_ERROR
      );
    });

    it("should classify context window errors", () => {
      expect(classifyError("context window exceeded")).toBe(
        ErrorCategory.CONTEXT_WINDOW_ERROR
      );
      expect(classifyError("token limit reached")).toBe(
        ErrorCategory.CONTEXT_WINDOW_ERROR
      );
      expect(classifyError("maximum context length exceeded")).toBe(
        ErrorCategory.CONTEXT_WINDOW_ERROR
      );
      expect(classifyError("maximum token length")).toBe(
        ErrorCategory.CONTEXT_WINDOW_ERROR
      );
      expect(classifyError("maximum tokens reached")).toBe(
        ErrorCategory.CONTEXT_WINDOW_ERROR
      );
      expect(classifyError("too many tokens")).toBe(
        ErrorCategory.CONTEXT_WINDOW_ERROR
      );
      expect(classifyError(new Error("context window exceeded"))).toBe(
        ErrorCategory.CONTEXT_WINDOW_ERROR
      );
    });

    it("should classify LLM unavailable errors", () => {
      expect(classifyError("service unavailable")).toBe(
        ErrorCategory.LLM_UNAVAILABLE_ERROR
      );
      expect(classifyError("temporarily unavailable")).toBe(
        ErrorCategory.LLM_UNAVAILABLE_ERROR
      );
      expect(classifyError("server error")).toBe(
        ErrorCategory.LLM_UNAVAILABLE_ERROR
      );
      expect(classifyError("500 internal error")).toBe(
        ErrorCategory.LLM_UNAVAILABLE_ERROR
      );
      expect(classifyError("503 service unavailable")).toBe(
        ErrorCategory.LLM_UNAVAILABLE_ERROR
      );
      expect(classifyError("connection error")).toBe(
        ErrorCategory.LLM_UNAVAILABLE_ERROR
      );
      expect(classifyError("timeout occurred")).toBe(
        ErrorCategory.LLM_UNAVAILABLE_ERROR
      );
      expect(classifyError(new Error("service unavailable"))).toBe(
        ErrorCategory.LLM_UNAVAILABLE_ERROR
      );
    });

    it("should classify tool execution errors", () => {
      expect(classifyError("tool execution failed")).toBe(
        ErrorCategory.TOOL_EXECUTION_ERROR
      );
      expect(classifyError("tool error occurred")).toBe(
        ErrorCategory.TOOL_EXECUTION_ERROR
      );
      expect(classifyError("failed to execute tool")).toBe(
        ErrorCategory.TOOL_EXECUTION_ERROR
      );
      expect(classifyError(new Error("tool execution failed"))).toBe(
        ErrorCategory.TOOL_EXECUTION_ERROR
      );
    });

    it("should classify invalid response format errors", () => {
      expect(classifyError("invalid format")).toBe(
        ErrorCategory.INVALID_RESPONSE_FORMAT
      );
      expect(classifyError("parsing error")).toBe(
        ErrorCategory.INVALID_RESPONSE_FORMAT
      );
      expect(classifyError("malformed response")).toBe(
        ErrorCategory.INVALID_RESPONSE_FORMAT
      );
      expect(classifyError("failed to parse")).toBe(
        ErrorCategory.INVALID_RESPONSE_FORMAT
      );
      expect(classifyError("invalid JSON")).toBe(
        ErrorCategory.INVALID_RESPONSE_FORMAT
      );
      expect(classifyError(new Error("invalid format"))).toBe(
        ErrorCategory.INVALID_RESPONSE_FORMAT
      );
    });

    it("should classify checkpoint errors", () => {
      expect(classifyError("checkpoint error")).toBe(
        ErrorCategory.CHECKPOINT_ERROR
      );
      expect(classifyError("failed to save checkpoint")).toBe(
        ErrorCategory.CHECKPOINT_ERROR
      );
      expect(classifyError("failed to load checkpoint")).toBe(
        ErrorCategory.CHECKPOINT_ERROR
      );
      expect(classifyError("checkpoint corrupted")).toBe(
        ErrorCategory.CHECKPOINT_ERROR
      );
      expect(classifyError(new Error("checkpoint error"))).toBe(
        ErrorCategory.CHECKPOINT_ERROR
      );
    });

    it("should classify unknown errors", () => {
      expect(classifyError("some random error")).toBe(
        ErrorCategory.UNKNOWN_ERROR
      );
      expect(classifyError("unexpected issue")).toBe(
        ErrorCategory.UNKNOWN_ERROR
      );
      expect(classifyError(new Error("some random error"))).toBe(
        ErrorCategory.UNKNOWN_ERROR
      );
    });
  });

  describe("createErrorEvent", () => {
    it("should create an error event from a string", () => {
      const event = createErrorEvent("rate limit exceeded", "test-node");
      expect(event.category).toBe(ErrorCategory.RATE_LIMIT_ERROR);
      expect(event.message).toBe("rate limit exceeded");
      expect(event.nodeId).toBe("test-node");
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.error).toBeUndefined();
    });

    it("should create an error event from an Error object", () => {
      const error = new Error("context window exceeded");
      const event = createErrorEvent(error, "test-node");
      expect(event.category).toBe(ErrorCategory.CONTEXT_WINDOW_ERROR);
      expect(event.message).toBe("context window exceeded");
      expect(event.nodeId).toBe("test-node");
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.error).toBe(error);
    });

    it("should include retry information if provided", () => {
      const retry = {
        count: 1,
        maxRetries: 3,
        shouldRetry: true,
        backoffMs: 2000,
      };
      const event = createErrorEvent("rate limit exceeded", "test-node", retry);
      expect(event.retry).toEqual(retry);
    });
  });

  describe("addErrorToState", () => {
    it("should add an error to empty state", () => {
      const state = {};
      const error = createErrorEvent("rate limit exceeded");
      const newState = addErrorToState(state, error);
      expect(newState.errors).toEqual([error]);
    });

    it("should add an error to state with existing errors", () => {
      const existingError = createErrorEvent("context window exceeded");
      const state = { errors: [existingError] };
      const newError = createErrorEvent("rate limit exceeded");
      const newState = addErrorToState(state, newError);
      expect(newState.errors).toEqual([existingError, newError]);
    });

    it("should not mutate the original state", () => {
      const state = {};
      const error = createErrorEvent("rate limit exceeded");
      addErrorToState(state, error);
      expect(state).toEqual({});
    });
  });

  describe("shouldRetry", () => {
    it("should return false if retry count exceeds max retries", () => {
      expect(shouldRetry(ErrorCategory.RATE_LIMIT_ERROR, 3, 3)).toBe(false);
      expect(shouldRetry(ErrorCategory.RATE_LIMIT_ERROR, 4, 3)).toBe(false);
    });

    it("should return true for retriable error categories", () => {
      expect(shouldRetry(ErrorCategory.RATE_LIMIT_ERROR, 0, 3)).toBe(true);
      expect(shouldRetry(ErrorCategory.LLM_UNAVAILABLE_ERROR, 1, 3)).toBe(true);
      expect(shouldRetry(ErrorCategory.TOOL_EXECUTION_ERROR, 2, 3)).toBe(true);
    });

    it("should return false for non-retriable error categories", () => {
      expect(shouldRetry(ErrorCategory.CONTEXT_WINDOW_ERROR, 0, 3)).toBe(false);
      expect(shouldRetry(ErrorCategory.INVALID_RESPONSE_FORMAT, 1, 3)).toBe(
        false
      );
      expect(shouldRetry(ErrorCategory.CHECKPOINT_ERROR, 0, 3)).toBe(false);
      expect(shouldRetry(ErrorCategory.UNKNOWN_ERROR, 0, 3)).toBe(false);
      expect(shouldRetry(ErrorCategory.LLM_SUMMARIZATION_ERROR, 0, 3)).toBe(
        false
      );
    });
  });

  describe("calculateBackoff", () => {
    it("should calculate exponential backoff", () => {
      expect(calculateBackoff(0, 1000, 60000, false)).toBe(1000);
      expect(calculateBackoff(1, 1000, 60000, false)).toBe(2000);
      expect(calculateBackoff(2, 1000, 60000, false)).toBe(4000);
      expect(calculateBackoff(3, 1000, 60000, false)).toBe(8000);
    });

    it("should not exceed max delay", () => {
      expect(calculateBackoff(10, 1000, 10000, false)).toBe(10000);
    });

    it("should add jitter when enabled", () => {
      // Mock Math.random to return 0.5 for predictable testing
      const originalRandom = Math.random;
      Math.random = vi.fn().mockReturnValue(0.5);

      expect(calculateBackoff(1, 1000, 60000, true)).toBe(2500); // 2000 + (0.5 * 0.5 * 2000)

      // Restore original Math.random
      Math.random = originalRandom;
    });
  });

  describe("ErrorEventSchema", () => {
    it("should validate a valid error event", () => {
      const event = {
        category: ErrorCategory.RATE_LIMIT_ERROR,
        message: "rate limit exceeded",
        timestamp: new Date(),
        nodeId: "test-node",
        retry: {
          count: 1,
          maxRetries: 3,
          shouldRetry: true,
          backoffMs: 2000,
        },
      };

      const result = ErrorEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it("should reject an invalid error event", () => {
      const event = {
        category: "INVALID_CATEGORY",
        message: "rate limit exceeded",
      };

      const result = ErrorEventSchema.safeParse(event);
      expect(result.success).toBe(false);
    });
  });
});
