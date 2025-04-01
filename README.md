# LangGraph Agent

This is a starter project for building LangGraph agents using TypeScript. It provides a minimal setup with:

- TypeScript configuration
- ESM module support
- Vitest for testing
- Basic LangGraph example

## Prerequisites

- Node.js 18 or higher
- NPM 8 or higher

## Installation

Clone the repository and install dependencies:

```bash
# Clone the repository
git clone https://github.com/your-username/langgraph-agent.git
cd langgraph-agent

# Install dependencies
npm install
```

## Environment Setup

Create a `.env` file in the root directory and add your API keys:

```
OPENAI_API_KEY=sk-...
TAVILY_API_KEY=tvly-...
# Add other API keys as needed
```

## Structure

The project follows this structure:

- `/src` - Source code
  - `/agents` - Agent implementations
  - `/tools` - Custom tools
  - `/state` - State definitions
  - `/tests` - Test files

## Running the Tests

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run tests in watch mode
npm run test:watch
```

## Building an Agent

To create a simple ReAct agent that can search the web:

```typescript
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

// Define the tools for the agent to use
const agentTools = [new TavilySearchResults({ maxResults: 3 })];
const agentModel = new ChatOpenAI({ temperature: 0 });

// Initialize memory to persist state between graph runs
const agentCheckpointer = new MemorySaver();
const agent = createReactAgent({
  llm: agentModel,
  tools: agentTools,
  checkpointSaver: agentCheckpointer,
});

// Now use it!
const agentFinalState = await agent.invoke(
  { messages: [new HumanMessage("what is the current weather in sf")] },
  { configurable: { thread_id: "42" } }
);
```

## License

MIT
