# this will need massively updating or removing in future, langgraph server is dealing with most of this now not our express server

Agent Directory

This directory contains agent implementations for our proposal generation system built with LangGraph.js. These agents collaborate to analyze RFP documents, conduct research, and generate high-quality proposals.

## Directory Structure

```
agents/
├── research/            # Research agent for RFP analysis
├── proposal-agent/      # Proposal generation agent
├── orchestrator/        # Coordination agent for workflow management
├── examples/            # Example agent implementations
├── __tests__/           # Test directory for all agents
└── README.md            # This file
```

## Agent Architecture

Each agent in our system follows a standardized structure:

- **`index.ts`**: Main entry point that exports the agent graph
- **`state.ts`**: State definition and annotations
- **`nodes.ts`**: Node function implementations
- **`tools.ts`**: Specialized tools for this agent
- **`agents.ts`**: Agent configuration and specialized agent definitions
- **`prompts/`**: Directory containing prompt templates

Agents are implemented as LangGraph.js state machines with clearly defined nodes, edges, and state transitions.

## Import Patterns

In this codebase, we use ES Modules (ESM) with TypeScript. Follow these import patterns:

- Include `.js` file extensions for all relative imports:

  ```typescript
  // Correct
  import { documentLoaderNode } from "./nodes.js";
  import { ResearchState } from "./state.js";

  // Incorrect
  import { documentLoaderNode } from "./nodes";
  import { ResearchState } from "./state";
  ```

- Don't include extensions for package imports:
  ```typescript
  // Correct
  import { StateGraph } from "@langchain/langgraph";
  import { z } from "zod";
  ```

## State Management

Agents define their state using LangGraph's annotation system:

```typescript
export const ResearchStateAnnotation = Annotation.Root({
  // State fields with appropriate reducers
  rfpDocument: Annotation<DocumentType>(),
  results: Annotation<Results>({
    default: () => ({}),
    value: (existing, update) => ({ ...existing, ...update }),
  }),
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
  }),
  // Error handling and status tracking
  errors: Annotation<string[]>({
    value: (curr, update) => [...(curr || []), ...update],
    default: () => [],
  }),
});

export type ResearchState = typeof ResearchStateAnnotation.State;
```

## Graph Construction

Each agent exports a function to create its graph:

```typescript
export function createAgentGraph() {
  // Create the state graph
  const graph = new StateGraph({
    channels: {
      state: StateAnnotation,
    },
  });

  // Add nodes
  graph.addNode("nodeA", nodeAFunction);
  graph.addNode("nodeB", nodeBFunction);

  // Define edges with conditions
  graph.addEdge("nodeA", "nodeB", (state) => state.status.aComplete);

  // Add error handling
  graph.addConditionalEdges("nodeA", (state) =>
    state.status.aComplete ? "nodeB" : "error"
  );

  // Set entry point
  graph.setEntryPoint("nodeA");

  // Compile the graph
  return graph.compile();
}
```

## Persistence / Checkpointing

To ensure agents can resume their work and maintain state across multiple interactions or server restarts, we use the official LangGraph checkpointer for Postgres, compatible with Supabase.

**Package:** `@langchain/langgraph-checkpoint-postgres`

**Class:** `PostgresSaver` (Note: Use `PostgresSaver`, not `AsyncPostgresSaver` for the JavaScript implementation as identified during development)

**Implementation Steps:**

1.  **Install:** Add the package to your backend dependencies:
    ```bash
    npm install @langchain/langgraph-checkpoint-postgres
    # or yarn add / pnpm add
    ```
2.  **Environment Variable:** Ensure your Supabase database connection string is available as an environment variable (e.g., `DATABASE_URL`). Format: `postgresql://[user]:[password]@[host]:[port]/[database]`
3.  **Import:** Import the saver in your agent's main file (e.g., `index.ts`):
    ```typescript
    import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
    ```
4.  **Instantiate:** Create an instance using the static `fromConnString` method:
    ```typescript
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error("DATABASE_URL environment variable is not set.");
    }
    const checkpointer = PostgresSaver.fromConnString(dbUrl);
    ```
5.  **Setup Tables (First Run):** Before compiling the graph, ensure the necessary database tables for the checkpointer exist. Call the `setup` method:
    ```typescript
    // Place this after instantiation, before graph.compile()
    await checkpointer.setup();
    ```
    _Note: This typically only needs to create tables on the very first run, but calling it each time is safe._
6.  **Compile Graph:** Pass the checkpointer instance to the `compile` method:
    ```typescript
    const compiledGraph = graph.compile({
      checkpointer,
      // other compile options...
    });
    ```
7.  **Invoke with `thread_id`:** When invoking the compiled graph, provide a `thread_id` in the configuration object to save or resume a specific session:
    ```typescript
    const config = {
      configurable: {
        thread_id: "some-unique-session-id",
      },
    };
    const finalState = await compiledGraph.invoke(initialState, config);
    ```
    _If no `thread_id` is provided when a checkpointer is configured, LangGraph will automatically generate one for the new thread._

**Reference:** [LangGraph JS Docs - Postgres Persistence](https://langchain-ai.github.io/langgraphjs/how-tos/persistence-postgres/)

This approach ensures state is reliably saved to your Supabase database, following the recommended patterns from the LangGraph documentation.

## Error Handling

Node functions should implement error handling:

```typescript
export async function exampleNode(state) {
  try {
    // Node logic here
    return {
      result: processedData,
      status: { ...state.status, stepComplete: true },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to process data: ${errorMessage}`);

    return {
      errors: [`Failed to process data: ${errorMessage}`],
      status: { ...state.status, stepComplete: false },
    };
  }
}
```

## Development Guidelines

When developing agents:

1. Document all state definitions and node functions with JSDoc comments
2. Use standardized patterns for error handling and state updates
3. Follow the import patterns described above (include `.js` extensions for relative imports)
4. Keep prompt templates in dedicated files and reference them in node functions
5. Implement comprehensive tests for all nodes and workflows
6. Use descriptive node names with the pattern `verbNoun` (e.g., `loadDocument`, `analyzeContent`)
7. Use immutable patterns for state updates
8. Validate inputs and outputs with Zod schemas where appropriate

## Agent Communication Pattern

Agents communicate through structured state objects. For example, the research agent produces analysis that can be consumed by the proposal agent:

```typescript
// Research agent output
{
  "deepResearchResults": { /* structured research analysis */ },
  "solutionSoughtResults": { /* solution analysis */ }
}

// Proposal agent can access this data in its state
function proposalNode(state) {
  const researchData = state.researchResults;
  // Use research data to inform proposal
}
```

## Testing Agents

Test files in the `__tests__` directory should cover:

1. Individual node functions
2. Complete workflows through the agent graph
3. Error handling and recovery paths
4. Edge cases and boundary conditions

Use mocked LLM responses and configuration overrides for deterministic tests.
