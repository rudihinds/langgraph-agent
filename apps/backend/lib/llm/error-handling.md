# Error Handling & Resilience in LangGraph Agents

This document provides an overview of the error handling and resilience system for LangGraph agents in the Proposal Agent project.

## Overview

The error handling system provides a robust framework for:

1. **Classifying errors** that occur during LLM interactions and agent execution
2. **Implementing retry mechanisms** with exponential backoff for transient errors
3. **Graceful degradation** when facing context window limitations
4. **Monitoring and logging** to track performance and error rates
5. **User-friendly error messages** to maintain a good user experience

## Core Components

### 1. Error Classification

Located in `error-classification.ts`, this module categorizes errors into specific types:

```typescript
export enum ErrorCategory {
  LLM_UNAVAILABLE = "llm_unavailable",
  CONTEXT_WINDOW_EXCEEDED = "context_window_exceeded",
  RATE_LIMIT_EXCEEDED = "rate_limit_exceeded",
  TOOL_EXECUTION_ERROR = "tool_execution_error",
  INVALID_RESPONSE_FORMAT = "invalid_response_format",
  CHECKPOINT_ERROR = "checkpoint_error",
  LLM_SUMMARIZATION_ERROR = "llm_summarization_error",
  CONTEXT_WINDOW_ERROR = "context_window_error", 
  TOKEN_CALCULATION_ERROR = "token_calculation_error",
  UNKNOWN = "unknown",
}
```

The classification system allows for precise handling of different error types.

### 2. Error Handling Wrappers

The `error-handlers.ts` module provides utility functions for adding error handling to LangGraph components:

- `withErrorHandling`: Wraps a StateGraph to handle errors during compilation and execution
- `createRetryingLLM`: Adds retry capabilities to LLM clients
- `createNodeErrorHandler`: Creates an error handler for graph nodes
- `createRetryingNode`: Adds retry logic to node functions

### 3. Context Window Management

The `context-window-manager.ts` implements intelligent handling of token limits:

- Dynamically summarizes conversations when they exceed token thresholds
- Implements progressive truncation when necessary
- Tracks token usage to optimize context usage
- Gracefully handles context window errors

### 4. Monitoring & Logging

The `monitoring.ts` module provides a structured system for:

- Logging errors and performance metrics
- Tracking latency, token usage, and error rates
- Providing statistical analysis of system performance
- Supporting debugging and optimization

## Integration Into Agents

Error handling is integrated at multiple levels in the agent system:

### 1. LLM Client Level

The LLM clients use the `createRetryingLLM` wrapper to automatically retry on transient errors like rate limits and service unavailability.

### 2. Node Level

Each node in an agent workflow can be wrapped with:
- `createNodeErrorHandler` to capture and process errors
- `createRetryingNode` to automatically retry on recoverable errors

### 3. Graph Level

At the graph level, `withErrorHandling` ensures proper error annotation and handling during graph execution.

### 4. Conditional Edges

Error handling paths can be implemented using conditional edges:

```typescript
builder.addConditionalEdges(
  "generateResponse",
  (state) => {
    if (state.lastError) {
      if (state.lastError.category === ErrorCategory.CONTEXT_WINDOW_ERROR) {
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
```

## Error State Management

Errors are tracked in state using the `ErrorStateAnnotation`:

```typescript
export const ErrorStateAnnotation = Annotation.Root({
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
});
```

## Retry Logic

The system determines whether to retry based on error category and retry count:

```typescript
export function shouldRetry(
  error: ErrorEvent,
  currentRetries: number,
  maxRetries: number = 3
): boolean {
  // Don't retry if we've hit the maximum
  if (currentRetries >= maxRetries || error.fatal) {
    return false;
  }

  // Always retry these types of errors
  if (
    error.category === ErrorCategory.LLM_UNAVAILABLE ||
    error.category === ErrorCategory.RATE_LIMIT_EXCEEDED
  ) {
    return true;
  }

  // Don't retry context window errors
  if (
    error.category === ErrorCategory.CONTEXT_WINDOW_EXCEEDED ||
    error.category === ErrorCategory.CONTEXT_WINDOW_ERROR
  ) {
    return false;
  }

  // Retry other errors once
  return currentRetries < 1;
}
```

Retry attempts use exponential backoff:

```typescript
export function calculateBackoff(
  retryCount: number,
  baseDelayMs: number = 1000,
  maxDelayMs: number = 30000
): number {
  // Exponential backoff: baseDelay * 2^retryCount with jitter
  const delay = baseDelayMs * Math.pow(2, retryCount);
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);
  return Math.min(delay + jitter, maxDelayMs);
}
```

## Usage Examples

### Basic Error Handling in an Agent Node

```typescript
// Define node function
const generateText = async (state) => {
  // ... implementation ...
};

// Add node with error handling
builder.addNode(
  "generateText",
  createRetryingNode(generateText, "generateText", { maxRetries: 2 })
);
```

### Handling Context Window Errors

```typescript
// Use Context Window Manager
const contextManager = ContextWindowManager.getInstance();

// Prepare messages considering token limits
const { messages, wasSummarized } = await contextManager.prepareMessages(
  conversationHistory,
  "gpt-4"
);

// Use prepared messages in LLM call
const result = await llm.completion({
  model: "gpt-4",
  messages
});
```

### Monitoring Performance

```typescript
// Get monitor instance
const monitor = LLMMonitor.getInstance();

// Track an operation
const endTracking = monitor.trackOperation("generateProposal", "claude-3-7-sonnet", 500);

try {
  // Perform operation
  const result = await llm.completion(/* ... */);
  // End tracking with success
  endTracking(result.completionTokens);
  return result;
} catch (error) {
  // End tracking with error
  endTracking(0, error);
  throw error;
}
```

## Best Practices

1. **Always classify errors** using the appropriate category for precise handling
2. **Use retries judiciously** - not all errors should be retried
3. **Implement graceful degradation paths** for context window limitations
4. **Set appropriate timeouts** for LLM calls to prevent hanging operations
5. **Monitor error rates and performance** to identify patterns and issues
6. **Provide user-friendly error messages** to maintain good UX
7. **Test error scenarios** with mocked failures to ensure robust handling

## Implementation Status

- ✅ Error classification system
- ✅ Retry mechanisms with exponential backoff
- ✅ Context window management
- ✅ Error handling wrappers for LangGraph
- ✅ Monitoring and logging utilities
- ✅ Integration examples
- ✅ Comprehensive test suite

## Future Improvements

- Implement centralized error tracking/reporting service
- Add circuit breakers for cascading failure prevention
- Develop model-specific error handling strategies
- Create visualizations for error patterns and performance metrics
- Implement adaptive retry policies based on historical performance