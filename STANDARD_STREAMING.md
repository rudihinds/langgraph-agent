# Standard LangGraph Streaming Implementation

This document provides an overview of the standard LangGraph streaming implementation that has replaced the previous custom streaming solution. This change ensures better compatibility with the LangGraph ecosystem and reduces maintenance overhead.

## What Changed

We have replaced a custom streaming implementation with a standardized approach that leverages native LangGraph and LangChain streaming capabilities. The key files implementing this standard approach are:

1. `/apps/backend/lib/llm/streaming/langgraph-streaming.ts` - Core utilities
2. `/apps/backend/lib/llm/streaming/streaming-node.ts` - Node factories for LangGraph
3. `/apps/backend/agents/proposal-agent/nodes-streaming.ts` - Streaming versions of proposal agent nodes
4. `/apps/backend/agents/proposal-agent/graph-streaming.ts` - Streaming version of proposal agent graph

We've also updated the backend server to use this new implementation.

## Benefits

The standard implementation provides several benefits:

1. **Native LangGraph Compatibility**: Uses the standard streaming mechanisms built into LangGraph and LangChain.

2. **Better LangSmith Integration**: All traces automatically appear in the LangSmith dashboard with proper nesting and context.

3. **Simplified Maintenance**: Less custom code to maintain, as we leverage the built-in capabilities of the LangGraph framework.

4. **Future-Proof**: Automatically benefits from updates to the LangGraph library without requiring changes to our implementation.

5. **Full Provider Support**: Works seamlessly with all LLM providers (OpenAI, Anthropic, Mistral, Google).

## How to Use It

### Creating a Basic Streaming Node

```typescript
import { createStreamingNode } from "./lib/llm/streaming/streaming-node";

const myNode = createStreamingNode<MyStateType>(
  "System prompt here",
  "gpt-4o",
  { temperature: 0.7 }
);
```

### Creating a Streaming Node with Tools

```typescript
import { createStreamingToolNode } from "./lib/llm/streaming/streaming-node";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";

const searchTool = new TavilySearchResults();

const toolNode = createStreamingToolNode(
  [searchTool],
  "System prompt here",
  "gpt-4o",
  { temperature: 0.7 }
);
```

### Using in a LangGraph

```typescript
import { StateGraph } from "@langchain/langgraph";
import { createStreamingNode } from "./lib/llm/streaming/streaming-node";

// Create streaming nodes
const node1 = createStreamingNode<MyStateType>("...");
const node2 = createStreamingNode<MyStateType>("...");

// Create the graph
const graph = new StateGraph({ channels: MyStateAnnotation })
  .addNode("node1", node1)
  .addNode("node2", node2);

// Define edges
graph.addEdge("node1", "node2");

// Compile and use
const compiledGraph = graph.compile();
const result = await compiledGraph.invoke(initialState, {
  configurable: {
    streaming: true,
    temperature: 0.7,
  }
});
```

## LangSmith Integration

The streaming implementation automatically sends traces to LangSmith when the following environment variables are set:

```
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your_api_key
LANGCHAIN_PROJECT=your_project_name
```

These traces will show:
- Graph execution flow
- Node inputs and outputs
- LLM prompts and completions
- Streaming events
- Token usage and costs

## Testing the Implementation

The new streaming implementation can be tested via the `/api/proposal-agent-streaming` endpoint:

```bash
curl -X POST -H "Content-Type: application/json" -d '{"query":"I need help writing a grant proposal"}' http://localhost:3001/api/proposal-agent-streaming
```

You can also run the application and check the LangSmith dashboard to see the traces.