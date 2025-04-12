# LangGraph Utilities

This directory contains utilities for enhancing the LangGraph experience, providing robust solutions for common challenges in LLM workflow development.

## Loop Prevention System

The Loop Prevention System provides safeguards against infinite loops and repetitive cycles in LangGraph workflows, which is a common issue in LLM-based agents.

### Core Components

- **loop-prevention.ts**: Main configuration and integration module
- **state-fingerprinting.ts**: State comparison and cycle detection engine
- **loop-prevention-utils.ts**: Utility functions and helper nodes

### Getting Started

To use the loop prevention system in your LangGraph workflow:

```typescript
import { StateGraph } from "@langchain/langgraph";
import { configureLoopPrevention } from "./lib/llm/loop-prevention";

// Create your graph
const graph = new StateGraph({ /* your config */ });

// Add loop prevention (just one line!)
configureLoopPrevention(graph);

// Continue with your normal graph setup
graph.addNode(/* ... */);
// ...
```

### Documentation

Detailed documentation is available in the `/docs` directory:

- [Loop Prevention Usage Guide](./docs/loop-prevention-usage.md): Comprehensive documentation for implementation
- [Loop Prevention Patterns](./docs/loop-prevention-patterns.md): Advanced patterns and best practices
- [Loop Prevention](./docs/loop-prevention.md): Conceptual overview and design principles

### Features

- **Automatic Cycle Detection**: Identifies repetitive patterns in state transitions
- **Progress Monitoring**: Ensures workflows are making meaningful forward progress
- **Iteration Limits**: Configurable maximum iteration counts to prevent runaway processes
- **Customizable Fingerprinting**: Fine-grained control over state comparison
- **Recovery Mechanisms**: Options for graceful termination or alternate routing
- **Checkpoint Integration**: Works seamlessly with LangGraph's checkpoint system

### Testing

The system includes comprehensive tests covering both basic functionality and edge cases:
- Unit tests for individual components
- Integration tests for combined functionality
- Edge case handling and error recovery

Run tests with:

```bash
npm test -- apps/backend/lib/llm/__tests__/loop-prevention.test.ts
```

## Other Utilities

- **checkpoint-recovery.ts**: Enhanced recovery from checkpoints
- **error-classification.ts**: Classification and handling of common LLM errors
- **context-window-manager.ts**: Management of context window limits

## Contributing

When contributing to these utilities:

1. Maintain comprehensive JSDoc comments
2. Add tests for new functionality
3. Update documentation for significant changes
4. Follow the established patterns for error handling and state management