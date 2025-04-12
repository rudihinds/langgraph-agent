# Timeout and Cancellation Management

This document describes the timeout and cancellation system for LangGraph workflows, allowing you to set appropriate limits for different types of nodes, especially research-heavy operations that need generous time limits.

## Overview

The timeout and cancellation system provides:

1. **Workflow-level timeouts**: Set an overall time limit for the entire workflow.
2. **Node-specific timeouts**: Configure different time limits for different node types.
3. **Research node support**: Special handling for nodes that perform complex research or knowledge retrieval.
4. **Cancellation mechanisms**: Safely terminate workflows that exceed time limits.
5. **Resource cleanup**: Automatic cleanup of timers and resources to prevent memory leaks.

## Key Concepts

### Node Types

The system recognizes several types of nodes, each with default timeout values:

- **Default nodes**: Standard processing nodes (default: 3 minutes)
- **Research nodes**: Nodes that perform extensive research, context gathering, or knowledge retrieval (default: 10 minutes)
- **Generation nodes**: Nodes that generate complex text content (default: 5 minutes)

### Timeout Hierarchy

Timeouts are determined in the following order:

1. Node-specific timeouts defined in the `nodeTimeouts` configuration
2. Node type timeouts based on the node's inclusion in `researchNodes` or `generationNodes`
3. Default timeouts based on the node type

### Cancellation Mechanism

When a timeout occurs:

1. The `onTimeout` event handler is called with details about the node and elapsed time
2. The workflow is cancelled with a descriptive reason
3. All timers and resources are cleaned up
4. The `onCancellation` event handler is called
5. A `WorkflowCancellationError` is thrown to stop execution

## Basic Usage

```typescript
import { StateGraph } from "@langchain/langgraph";
import { configureTimeouts } from "../timeout-manager";

// Create your graph
const graph = new StateGraph({ /* your config */ });

// Configure timeouts
const { graph: timeoutGraph, timeoutManager } = configureTimeouts(graph, {
  workflowTimeout: 5 * 60 * 1000, // 5 minutes for the workflow
  researchNodes: ["research", "knowledge_retrieval"], 
});

// Start the timeout manager
timeoutManager.startWorkflow();

// Run the workflow
const app = timeoutGraph.compile();
const result = await app.invoke({ /* initial state */ });

// Clean up resources
timeoutManager.cleanup();
```

## Advanced Configuration

The `TimeoutOptions` interface provides extensive configuration options:

```typescript
interface TimeoutOptions {
  // Overall workflow timeout in milliseconds
  workflowTimeout?: number;
  
  // Node-specific timeouts (by node name)
  nodeTimeouts?: Record<string, number>;
  
  // Default timeout for each node type
  defaultTimeouts?: {
    default?: number;
    research?: number;
    generation?: number;
  };
  
  // Names of research nodes (will use research timeout by default)
  researchNodes?: string[];
  
  // Names of generation nodes (will use generation timeout by default)
  generationNodes?: string[];
  
  // Whether to enable cancellation support
  enableCancellation?: boolean;
  
  // Event handler for timeout events
  onTimeout?: (nodeName: string, elapsedTime: number) => void;
  
  // Event handler for cancellation events
  onCancellation?: (reason: string) => void;
}
```

## Handling Timeouts and Cancellations

To properly handle timeout and cancellation errors:

```typescript
try {
  const result = await app.invoke({ /* initial state */ });
  console.log("Workflow completed successfully:", result);
} catch (error) {
  if (error.name === "WorkflowCancellationError") {
    console.error(`Workflow was cancelled: ${error.message}`);
    // Handle cancellation gracefully
  } else if (error.name === "NodeTimeoutError") {
    console.error(`Node timeout: ${error.nodeName} (${error.elapsedTime}ms)`);
    // Handle specific node timeout
  } else {
    console.error("Workflow error:", error);
    // Handle other errors
  }
}
```

## Integration with Loop Prevention

The timeout system works seamlessly with the loop prevention system:

```typescript
import { StateGraph } from "@langchain/langgraph";
import { configureLoopPrevention } from "../loop-prevention";
import { configureTimeouts } from "../timeout-manager";

const graph = new StateGraph({ /* your config */ });

// First add loop prevention
configureLoopPrevention(graph, {
  maxIterations: 10,
  autoAddTerminationNodes: true,
});

// Then add timeout support
const { graph: configuredGraph, timeoutManager } = configureTimeouts(graph, {
  workflowTimeout: 5 * 60 * 1000,
  researchNodes: ["research"],
});

// Use the fully configured graph
const app = configuredGraph.compile();
timeoutManager.startWorkflow();
const result = await app.invoke({ /* initial state */ });
timeoutManager.cleanup();
```

## Best Practices for Research Nodes

When working with research-heavy nodes:

1. **Be generous with timeouts**: Research operations can take time, especially with large contexts.
2. **Add logging within nodes**: Log progress within long-running nodes to help with debugging.
3. **Consider chunking**: Break up large research tasks into smaller chunks with separate timeouts.
4. **Use graceful degradation**: Have fallback strategies when research operations time out.
5. **Monitor actual execution times**: Adjust timeout values based on real-world performance.

## Manual Cancellation

You can manually cancel workflows when needed:

```typescript
// Cancel for any reason
timeoutManager.cancel("User requested cancellation");

// Check if cancelled
if (timeoutManager.isCancelled()) {
  console.log("Workflow was cancelled");
}
```

## Example: Generous Limits for Research Nodes

```typescript
const { graph, timeoutManager } = configureTimeouts(graph, {
  workflowTimeout: 15 * 60 * 1000, // 15 minutes overall
  researchNodes: [
    "researchTopic", 
    "gatherSources", 
    "knowledgeRetrieval",
    "deepAnalysis"
  ],
  defaultTimeouts: {
    default: 1 * 60 * 1000,     // 1 minute for regular nodes
    research: 10 * 60 * 1000,   // 10 minutes for research nodes
    generation: 5 * 60 * 1000,  // 5 minutes for generation nodes
  },
  // Node-specific overrides for especially complex operations
  nodeTimeouts: {
    "deepAnalysis": 15 * 60 * 1000,  // 15 minutes for the most complex node
  },
  onTimeout: (nodeName, elapsedTime) => {
    console.log(`Research node ${nodeName} timed out after ${elapsedTime / 1000} seconds`);
    // Log to monitoring system
  }
});
```

This configuration provides generous limits for research nodes while still protecting against infinite running times.