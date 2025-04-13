# LangGraph Agent Development Standards

This document defines the standards and best practices for developing LangGraph agents in our system.

## Directory Structure

All agents should follow this standardized directory structure:

```
<agent-name>/
├── README.md           # Documentation for the agent
├── index.ts            # Main exports
├── state.ts            # State definitions with annotations
├── nodes.ts            # Node implementations
├── graph.ts            # Graph definition (if separate from index.ts)
├── tools.ts            # Agent-specific tools (if needed)
├── agents.ts           # Agent implementations (if using React agents)
├── prompts/            # Agent-specific prompts
│   └── index.ts        # Consolidated prompt templates
└── __tests__/          # Tests for the agent
```

## File Naming and Conventions

1. Use `.ts` files for all TypeScript code
2. Use kebab-case for file names with multiple words (e.g., `graph-streaming.ts`)
3. Group related functionality in the same file (e.g., all prompts in `prompts/index.ts`)
4. Prefer named exports over default exports

## State Management

1. Define state using `Annotation.Root` from LangGraph
2. Export a type alias for the state object (e.g., `export type MyAgentState = typeof MyAgentStateAnnotation.State;`)
3. Use custom reducers for complex state updates
4. Include comprehensive Zod schemas for validation

## Prompt Management

1. Store all prompts in a dedicated `prompts/index.ts` file
2. Use template literals with descriptive names
3. Document expected input variables in comments
4. Standardize output format instructions

## Tool Integration

1. Define tools in a dedicated `tools.ts` file
2. Use the `tool` function from LangGraph/LangChain
3. Implement proper error handling within tools
4. Use Zod schemas to define input parameters

## Graph Structure

1. Define the graph structure in a clear, modular way
2. Use descriptive names for nodes that follow the `verbNoun` pattern
3. Implement proper conditional edges for branching
4. Use a checkpointer for persistence

## Agent Implementations

1. If using ReAct agents, define them in a dedicated `agents.ts` file
2. Properly bind tools to agents
3. Use appropriate system messages for agent directives
4. Export factory functions that create the agents

## Documentation

1. Include a README.md in each agent directory
2. Document state structure, node functions, and usage examples
3. Include diagrams when helpful
4. Explain design decisions and trade-offs

## Testing

1. Implement comprehensive tests for all components
2. Test the full graph execution
3. Test individual nodes
4. Use mocks for external dependencies

## Error Handling

1. Implement robust error handling in all nodes
2. Track errors in state
3. Use conditional edges to handle error cases
4. Provide meaningful error messages

## Export Pattern

Follow this pattern in `index.ts`:

```typescript
export * from "./state";
export * from "./nodes";
export * from "./tools";
// etc.

// Re-export the main graph creation function
export { createSomeAgentGraph } from "./graph";

// Export a simplified API if appropriate
export const someAgent = {
  invoke: async (inputs) => {
    // Implementation
  }
};
```

## Example Implementations

For reference implementations that follow these standards, see:

- [Research Agent](./research/README.md) - A specialized agent for RFP analysis
- [Proposal Agent](./proposal-agent/README.md) - A comprehensive agent for proposal writing

By following these standards, we ensure consistent, maintainable, and robust agent implementations across our system.