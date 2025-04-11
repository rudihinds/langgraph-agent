# LangGraph Error Handling Integration Guide

This document explains how to integrate the comprehensive error handling system into your LangGraph agents.

## Overview

Our error handling system provides several key components:

1. **Error Classification**: Categorizes errors into specific types 
2. **Retry Mechanisms**: Automatically retries transient errors
3. **Context Window Management**: Handles token limits gracefully
4. **Monitoring**: Tracks performance metrics and errors
5. **Graceful Degradation**: Recovers from errors with user-friendly messages

## Integration Steps

### 1. Update State Definition

First, extend your state with error handling properties:

```typescript
// Add to your state annotation
const YourStateAnnotation = Annotation.Root({
  // ... your existing state properties
  
  // Error tracking - collection of all errors encountered
  errors: Annotation.Array({
    default: () => [],
  }),

  // Last error - the most recent error for easy access
  lastError: Annotation.Any({
    default: () => undefined,
  }),

  // Recovery attempts counter for tracking retry efforts
  recoveryAttempts: Annotation.Number({
    default: () => 0,
  }),
});
```

### 2. Use Retry-Enabled LLMs

Replace direct LLM instantiation with retry-wrapped versions:

```typescript
import { createRetryingLLM } from "../../lib/llm/error-handlers.js";

// Instead of:
// const model = new ChatOpenAI({ modelName: "gpt-4o" });

// Use:
const model = createRetryingLLM(
  new ChatOpenAI({ modelName: "gpt-4o" }),
  3 // max retries
);
```

### 3. Enable Context Window Management

Use the context window manager to prevent token limit errors:

```typescript
import { ContextWindowManager } from "../../lib/llm/context-window-manager.js";

// Initialize 
const contextManager = ContextWindowManager.getInstance({
  summarizationModel: "gpt-4o",
  debug: process.env.NODE_ENV === "development",
});

// In your node function:
const { messages: preparedMessages } = await contextManager.prepareMessages(
  [...messages, userMessage],
  "gpt-4o" // model name
);

// Use the prepared messages
const response = await model.invoke(preparedMessages);
```

### 4. Apply Performance Monitoring

Track LLM performance and errors:

```typescript
import { LLMMonitor } from "../../lib/llm/monitoring.js";

// Initialize 
const monitor = LLMMonitor.getInstance();

// In your node function:
const tracker = monitor.trackOperation("nodeName", "gpt-4o");

try {
  // LLM call
  const response = await model.invoke(messages);
  
  // Track success
  tracker(undefined);
  
  return { /* result */ };
} catch (error) {
  // Track error
  tracker(undefined, error);
  throw error;
}
```

### 5. Add Error Handling Nodes

Create specialized error handling nodes:

```typescript
// Handle context window errors
async function handleContextWindowError(state: YourState): Promise<Partial<YourState>> {
  console.warn("Handling context window error:", state.lastError);
  
  return {
    messages: [
      ...state.messages,
      new AIMessage("Our conversation is getting quite long. Let me summarize what we've discussed.")
    ],
    // Reset recovery attempts
    recoveryAttempts: 0
  };
}

// Handle catastrophic errors
async function handleCatastrophicError(state: YourState): Promise<Partial<YourState>> {
  console.error("Handling catastrophic error:", state.lastError);
  
  return {
    messages: [
      ...state.messages,
      new AIMessage("I encountered a technical issue. Please try again or rephrase your request.")
    ]
  };
}
```

### 6. Wrap Node Functions

Protect your node functions with retry wrappers:

```typescript
import { createRetryingNode } from "../../lib/llm/error-handlers.js";

const graph = new StateGraph(YourStateAnnotation)
  .addNode("yourNode", createRetryingNode("yourNode", 2)(yourNodeFunction))
  // ... other nodes
```

### 7. Add Conditional Error Edges

Set up conditional edges to route errors to the appropriate handler:

```typescript
import { ErrorCategory } from "../../lib/llm/error-classification.js";

graph.addConditionalEdges(
  "yourNode",
  (state: YourState) => {
    if (state.lastError) {
      if (
        state.lastError.category === ErrorCategory.CONTEXT_WINDOW_ERROR ||
        state.lastError.category === ErrorCategory.CONTEXT_WINDOW_EXCEEDED
      ) {
        return "handleContextWindowError";
      }
      return "handleCatastrophicError";
    }
    return "nextNode"; // normal flow
  },
  {
    handleContextWindowError: "handleContextWindowError",
    handleCatastrophicError: "handleCatastrophicError",
    nextNode: "nextNode",
  }
);
```

### 8. Wrap the Graph

Apply the error handling wrapper to the entire graph:

```typescript
import { withErrorHandling } from "../../lib/llm/error-handlers.js";

// Compile and return the graph with error handling wrapper
const compiledGraph = withErrorHandling(graph)();
```

## Complete Example

For a complete example of integration, see:
- `apps/backend/agents/examples/integrated-error-handling.ts` - Full implementation example
- `apps/backend/agents/__tests__/error-handling-integration.test.ts` - Integration tests

## Error Categories

The system recognizes these error categories:
- `RATE_LIMIT_EXCEEDED`: Rate limits from the LLM provider
- `CONTEXT_WINDOW_EXCEEDED`: Token limits exceeded 
- `LLM_UNAVAILABLE`: The LLM service is down
- `TOOL_EXECUTION_ERROR`: Failures in tool executions
- `INVALID_RESPONSE_FORMAT`: LLM returned an unexpected format
- `CHECKPOINT_ERROR`: Issues with state checkpointing
- `LLM_SUMMARIZATION_ERROR`: Failures during conversation summarization
- `CONTEXT_WINDOW_ERROR`: Token calculation errors
- `TOKEN_CALCULATION_ERROR`: Issues with token counting
- `UNKNOWN`: Other unclassified errors

## Best Practices

1. **Test with large inputs** to verify context window management
2. **Monitor error rates** in production
3. **Add specialized handlers** for your agent's specific needs 
4. **Use checkpoint verification** to validate state after recovery
5. **Provide user-friendly error messages** in all error handlers
6. **Log all errors** for later analysis
7. **Implement circuit breakers** for external services
8. **Add timeouts** for long-running operations

By following these integration steps, your LangGraph agents will be more resilient to errors, providing a better user experience even when things go wrong.