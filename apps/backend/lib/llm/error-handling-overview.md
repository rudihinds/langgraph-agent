# Error Handling and Resilience System

## Overview

The error handling and resilience system provides a comprehensive framework for managing errors in LangGraph agents. It ensures robustness through error classification, retry mechanisms, context window management, graceful degradation, and monitoring.

## Key Components

### Error Classification (`error-classification.ts`)

Categorizes errors into specific types:
- Rate limit errors
- Context window errors
- LLM unavailable errors
- Tool execution errors
- Invalid response format errors
- Checkpoint errors
- Unknown errors

```typescript
// Example usage
import { classifyError } from '../lib/llm/error-classification';

try {
  // LLM operation
} catch (error) {
  const errorType = classifyError(error);
  // Handle based on error type
}
```

### Error Handlers (`error-handlers.ts`)

Provides utilities for handling errors at different levels:

**Graph Level**:
```typescript
import { withErrorHandling } from '../lib/llm/error-handlers';

// Wrap your StateGraph with error handling
const graph = withErrorHandling(new StateGraph({
  channels: { ...channels },
  nodes: { ...nodes },
}));
```

**LLM Level**:
```typescript
import { createRetryingLLM } from '../lib/llm/error-handlers';

// Create an LLM client with retry capabilities
const llmWithRetry = createRetryingLLM(llmClient, {
  maxRetries: 3,
  backoffFactor: 2,
});
```

**Node Level**:
```typescript
import { createRetryingNode } from '../lib/llm/error-handlers';

// Wrap a node function with retry logic
const nodeWithRetry = createRetryingNode(nodeFunction, {
  maxRetries: 2,
  shouldRetry: (error) => error.name === 'RateLimitError',
});
```

### Context Window Management (`context-window-manager.ts`)

Prevents token limit errors through:
- Token count estimation
- Message truncation
- Conversation summarization

```typescript
import { ContextWindowManager } from '../lib/llm/context-window-manager';

// Initialize singleton
const contextManager = ContextWindowManager.getInstance({
  summarizationModel: 'gpt-3.5-turbo',
  maxTokensBeforeSummarization: 6000,
});

// Ensure messages fit within context window
const fittedMessages = await contextManager.ensureMessagesWithinContextWindow(messages, modelName);
```

### Message Truncation (`message-truncation.ts`)

Provides utilities for truncating message history:
- Different truncation strategies (start, end, middle)
- Token count estimation
- Preservation of critical messages

```typescript
import { truncateMessages, TruncationLevel } from '../lib/llm/message-truncation';

// Truncate messages to fit within token limit
const truncatedMessages = truncateMessages(messages, {
  maxTokens: 4000,
  preserveSystemMessages: true,
  truncationLevel: TruncationLevel.AGGRESSIVE,
});
```

### Monitoring (`monitoring.ts`)

Tracks performance metrics and errors:
- Response times
- Error rates
- Token usage
- Retry attempts

```typescript
import { MonitoringService } from '../lib/llm/monitoring';

// Track LLM call metrics
MonitoringService.trackLLMCall({
  model: 'gpt-4',
  startTime: performance.now(),
  endTime: performance.now() + 1200,
  tokensUsed: 350,
  success: true,
});

// Track errors
MonitoringService.trackError({
  errorType: 'RateLimitError',
  component: 'ResearchAgent',
  message: 'Rate limit exceeded',
});
```

## Integration Examples

See complete examples in:
- `apps/backend/agents/examples/error-handling-example.ts` - Standalone example
- `apps/backend/agents/examples/integrated-error-handling.ts` - Integration with proposal agent

## Testing

Comprehensive tests are available in the `__tests__` directory:
- `error-classification.test.ts` - Tests for error categorization
- `error-handlers.test.ts` - Tests for error handling utilities
- `context-window-manager.test.ts` - Tests for context window management
- `message-truncation.test.ts` - Tests for message truncation strategies
- `monitoring.test.ts` - Tests for monitoring functionality
- `error-handling-integration.test.ts` - End-to-end integration tests

## Best Practices

1. **Always classify errors** to provide appropriate handling
2. **Use retries with backoff** for transient errors
3. **Implement graceful degradation** for critical functionality
4. **Monitor error rates** to identify systemic issues
5. **Test error paths** as thoroughly as success paths
6. **Use context window management** proactively to prevent token limit errors
7. **Provide user-friendly error messages** that suggest potential solutions