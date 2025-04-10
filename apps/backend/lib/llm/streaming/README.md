# LangGraph Streaming Implementation

This directory contains a standard implementation of streaming for LangGraph applications using the native LangGraph/LangChain streaming capabilities.

## Files

- `langgraph-streaming.ts` - Core utilities for creating streaming-enabled models and chains
- `streaming-node.ts` - Node factories for use in LangGraph applications

## How It Works

This implementation provides a simple, standard approach to streaming in LangGraph that:

1. Uses native LangChain streaming capabilities
2. Automatically integrates with LangSmith for observability
3. Works with all standard LangGraph features
4. Supports multiple LLM providers (OpenAI, Anthropic, Mistral, Google)

## Usage

### Creating a Streaming Node

```typescript
import { createStreamingNode } from "./lib/llm/streaming/streaming-node";

const streamingNode = createStreamingNode<YourStateType>(
  "Your system prompt here",
  "gpt-4o", // or other supported model
  { temperature: 0.7 }
);
```

### Creating a Streaming Chain Node

```typescript
import { createStreamingChainNode } from "./lib/llm/streaming/streaming-node";
import { ChatPromptTemplate } from "@langchain/core/prompts";

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant."],
  ["human", "{input}"]
]);

const chainNode = createStreamingChainNode(
  prompt,
  (state) => ({ input: state.query }),
  "claude-3-7-sonnet",
  { temperature: 0.5 }
);
```

### Creating a Streaming Tool Node

```typescript
import { createStreamingToolNode } from "./lib/llm/streaming/streaming-node";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";

const searchTool = new TavilySearchResults();

const toolNode = createStreamingToolNode(
  [searchTool],
  "You are a helpful assistant with search capabilities.",
  "gpt-4o",
  { temperature: 0.7 }
);
```

## LangSmith Integration

This implementation automatically integrates with LangSmith when the following environment variables are set:

```
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your_api_key
LANGCHAIN_PROJECT=your_project_name
LANGCHAIN_ENDPOINT=https://api.smith.langchain.com (optional)
```

All traces will appear in your LangSmith dashboard, providing full visibility into:
- Node execution flow
- LLM prompts and responses
- Token usage and costs
- Stream events

## Benefits Over Custom Implementation

1. **Native compatibility** with the LangGraph/LangChain ecosystem
2. **Simplified maintenance** - no custom code to maintain
3. **Automatic updates** when LangGraph is upgraded
4. **Better observability** through LangSmith
5. **Full streaming support** across all LLM providers