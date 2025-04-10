# Context Window Manager

## Overview

The Context Window Manager is a utility for managing conversation context within LLM token limits. It handles dynamic message summarization, token counting, and context truncation to ensure messages fit within a model's context window while preserving important conversation context.

## Features

- **Context window management**: Automatically handles fitting messages within token limits
- **Conversation summarization**: Creates concise summaries of older messages when conversations exceed thresholds
- **Token counting with caching**: Efficient token usage tracking with performance optimization
- **Intelligent preservation**: Ensures system messages and recent conversation are maintained
- **Runtime configuration**: Customizable behavior through various options

## Architecture

The `ContextWindowManager` uses a singleton pattern to ensure a consistent instance is shared throughout the application. Key components include:

- **Token calculator**: Estimates token usage with caching for efficiency
- **Summarization engine**: Uses an LLM to create conversation summaries
- **Message preparation**: Combines summarization and truncation as needed
- **Token cache**: Optimizes performance by storing token counts for repeated content

## Usage

```typescript
// Get the shared instance with custom options
const manager = ContextWindowManager.getInstance({
  summarizationModel: "claude-3-7-sonnet",
  maxTokensBeforeSummarization: 4000,
  summarizationRatio: 0.6,
  debug: true
});

// Prepare messages for a model
const { messages, wasSummarized, totalTokens } = await manager.prepareMessages(
  conversationHistory, 
  "gpt-4o"
);

// Use prepared messages in your LLM call
const completion = await llmClient.completion({
  model: "gpt-4o",
  messages
});
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `summarizationModel` | string | "claude-3-7-sonnet" | Model to use for generating summaries |
| `reservedTokens` | number | 1000 | Tokens reserved for model responses |
| `maxTokensBeforeSummarization` | number | 6000 | Token threshold that triggers summarization |
| `summarizationRatio` | number | 0.5 | Portion of messages to summarize (0.5 = oldest 50%) |
| `debug` | boolean | false | Enable debug logging for token calculations |

## How It Works

### Message Preparation Process

1. **Calculate tokens**: Determine total tokens in the conversation
2. **Compare to limits**: Check if messages fit within available context window
3. **Process based on thresholds**:
   - If below context window limit: Return as-is
   - If above context window but below summarization threshold: Truncate oldest messages
   - If above summarization threshold: Summarize older portion of conversation
4. **Verify final size**: Ensure processed messages fit within context window

### Summarization Algorithm

When summarization is triggered, the manager:

1. Separates system messages (which must be preserved)
2. Takes a portion of older messages based on `summarizationRatio`
3. Sends those messages to the configured LLM for summarization
4. Creates a special "summary message" with the `isSummary` flag
5. Combines: system messages + summary message + recent messages
6. Performs additional truncation if still needed

### Token Caching

The manager optimizes performance through token caching:

1. Generates a cache key based on model ID, message role, and content
2. Stores token counts in both the message object and an internal cache
3. Reuses counts when processing the same or similar messages again

## Integration with LangGraph

This manager is designed to work seamlessly with LangGraph:

- Uses a compatible `Message` interface that works with LangGraph state
- Provides a singleton instance that can be shared across graph nodes
- Handles token tracking consistently across conversation flows
- Works with the LLM Factory for dynamic model selection

## Testing

The Context Window Manager has comprehensive unit tests covering:

1. **Basic functionality**: Correct handling of messages within various thresholds
2. **Summarization**: Proper summarization of conversations that exceed thresholds
3. **Token calculation**: Accurate token counting with caching
4. **Custom configuration**: Behavior with different summarization ratios and thresholds
5. **Error handling**: Graceful handling of errors from LLM clients

Tests use mock LLM clients to verify behavior without actual API calls, including edge cases like:
- Empty conversations
- Conversations with only system messages
- Extremely large messages that require multiple summarization steps

## Best Practices

- **Configuration Tuning**:
  - Set `maxTokensBeforeSummarization` based on your typical conversation patterns
  - Use a smaller, faster model for summarization if processing many conversations
  - Adjust `summarizationRatio` based on whether recent or historical context is more important

- **Performance Optimization**:
  - Enable `debug` only when troubleshooting token issues
  - Consider resetting the token cache periodically for long-running applications
  - Use the smallest viable context window for your use case

- **Integration Tips**:
  - Get a single instance early in your application lifecycle
  - Share the instance across components that process the same conversation
  - Consider conversation branching when managing multiple parallel discussions