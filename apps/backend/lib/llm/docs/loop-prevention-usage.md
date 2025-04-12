# Loop Prevention in LangGraph Workflows

This guide explains how to use the loop prevention utilities in your LangGraph workflows to prevent infinite loops, detect cycles, and ensure workflows terminate properly.

## Overview

The loop prevention system consists of multiple components that work together to prevent infinite loops:

1. **State Tracking**: Maintains a history of states to detect repetition
2. **Cycle Detection**: Identifies repeating patterns in the workflow execution
3. **Progress Monitoring**: Ensures the workflow is making meaningful progress
4. **Iteration Limits**: Enforces maximum iteration counts
5. **Safety Nodes**: Specialized nodes to check for termination conditions

## Quick Start

Here's a basic example of configuring loop prevention for your StateGraph:

```typescript
import { StateGraph } from "langchain/graphs/state";
import { configureLoopPrevention, WithLoopPrevention } from "../lib/llm/loop-prevention";

// Define your state type with loop prevention
interface MyWorkflowState extends WithLoopPrevention {
  proposal: string;
  iterations: number;
  // ... other state fields
}

// Create your state graph
const graph = new StateGraph<MyWorkflowState>({
  channels: {},
});

// Add your nodes
graph.addNode("generateProposal", generateProposalNode);
graph.addNode("reviewProposal", reviewProposalNode);
// ... add other nodes

// Add your edges
graph.addEdge("generateProposal", "reviewProposal");
graph.addEdge("reviewProposal", "generateProposal");
// ... add other edges

// Configure loop prevention
configureLoopPrevention(graph, {
  maxIterations: 10,
  progressField: "proposal",
  maxIterationsWithoutProgress: 3,
  useDefaultSafeguards: true,
});

// Compile the graph and use as normal
const executor = graph.compile();
```

## Configuration Options

The `configureLoopPrevention` function accepts various options to customize behavior:

| Option | Description | Default |
|--------|-------------|---------|
| `maxIterations` | Maximum number of iterations allowed for the graph | 20 |
| `progressField` | Field to track for changes to detect progress | undefined |
| `maxIterationsWithoutProgress` | Maximum iterations without progress before terminating | 5 |
| `fingerprintOptions` | Options for state fingerprinting and cycle detection | {} |
| `onLoopDetected` | Handler called when a loop is detected | Default handler |
| `onMaxIterationsExceeded` | Handler called when iterations exceed maximum | Default handler |
| `onNoProgressDetected` | Handler called when progress isn't detected | Default handler |
| `useDefaultSafeguards` | Whether to apply default safeguards | true |
| `recoveryNodeName` | Node to direct flow to when loop is detected | undefined |

## State Fingerprinting

The system creates "fingerprints" of states to detect cycles. You can customize which fields are included:

```typescript
configureLoopPrevention(graph, {
  fingerprintOptions: {
    includeFields: ["proposal", "research", "outline"],
    excludeFields: ["timestamp", "metadata"],
    cycleThreshold: 2, // Number of repetitions to consider a cycle
    normalizeFn: (state) => {
      // Custom normalization function to prepare state for fingerprinting
      return { ...state };
    }
  }
});
```

## Specialized Nodes

You can add explicit nodes to your graph for more control:

### Termination Node

```typescript
import { terminateOnLoop } from "../lib/llm/loop-prevention";

graph.addNode("checkForLoops", terminateOnLoop({
  message: "Proposal generation is stuck in a loop, terminating",
  shouldTerminate: (state) => {
    // Custom logic to determine if workflow should terminate
    return state.loopDetection?.loopDetected || false;
  }
}));
```

### Progress Detection Node

```typescript
import { createProgressDetectionNode } from "../lib/llm/loop-prevention";

graph.addNode("checkProgress", createProgressDetectionNode("proposal", {
  maxNoProgressIterations: 3,
  message: "No meaningful changes to the proposal detected",
  onNoProgress: (state) => {
    // Custom handling when no progress is detected
    return { next: "generateNewApproach", reason: "Trying a different approach" };
  }
}));
```

### Iteration Limit Node

```typescript
import { createIterationLimitNode } from "../lib/llm/loop-prevention";

graph.addNode("checkIterations", createIterationLimitNode({
  maxIterations: 15,
  message: "Maximum revision attempts reached",
  onLimitReached: (state) => {
    return { next: "finalizeProposal", reason: "Using best version so far" };
  }
}));
```

### Completion Check Node

```typescript
import { createCompletionCheckNode } from "../lib/llm/loop-prevention";

graph.addNode("checkCompletion", createCompletionCheckNode(
  (state) => state.proposal.length > 1000 && state.allSectionsComplete,
  {
    message: "Proposal meets completion criteria",
    nextNodeOnComplete: "finalizeProposal"
  }
));
```

## Advanced Example

Here's a more comprehensive example that demonstrates multiple loop prevention strategies:

```typescript
import { StateGraph, END } from "langchain/graphs/state";
import {
  configureLoopPrevention,
  WithLoopPrevention,
  terminateOnLoop,
  createProgressDetectionNode,
  createIterationLimitNode,
  createCompletionCheckNode
} from "../lib/llm/loop-prevention";

interface ProposalState extends WithLoopPrevention {
  proposal: string;
  sections: { title: string; content: string; complete: boolean }[];
  currentSectionIndex: number;
  revisionCount: number;
}

const graph = new StateGraph<ProposalState>({
  channels: {},
});

// Add workflow nodes
graph.addNode("initializeProposal", initializeProposalNode);
graph.addNode("generateSection", generateSectionNode);
graph.addNode("reviewSection", reviewSectionNode);
graph.addNode("reviseSection", reviseSectionNode);
graph.addNode("moveToNextSection", moveToNextSectionNode);
graph.addNode("finalizeProposal", finalizeProposalNode);

// Add safety check nodes
graph.addNode("checkRevisionLoop", terminateOnLoop({
  message: "Section revision is stuck in a loop",
}));

graph.addNode("checkSectionProgress", createProgressDetectionNode("sections", {
  maxNoProgressIterations: 3,
  onNoProgress: (state) => ({ 
    next: "moveToNextSection", 
    reason: "Moving to next section after multiple revision attempts" 
  })
}));

graph.addNode("checkIterationLimit", createIterationLimitNode({
  maxIterations: 30,
}));

graph.addNode("checkCompletion", createCompletionCheckNode(
  (state) => state.sections.every(s => s.complete),
  { nextNodeOnComplete: "finalizeProposal" }
));

// Add edges
graph.addEdge("initializeProposal", "generateSection");
graph.addEdge("generateSection", "reviewSection");
graph.addEdge("reviewSection", "checkSectionProgress");
graph.addEdge("checkSectionProgress", "reviseSection");
graph.addEdge("checkSectionProgress", "moveToNextSection");
graph.addEdge("reviseSection", "checkRevisionLoop");
graph.addEdge("checkRevisionLoop", "reviewSection");
graph.addEdge("moveToNextSection", "checkCompletion");
graph.addEdge("checkCompletion", "generateSection");
graph.addEdge("checkCompletion", "finalizeProposal");
graph.addEdge("finalizeProposal", END);

// Add global check after every node
graph.addGlobalNode("checkIterationLimit");

// Configure loop prevention
configureLoopPrevention(graph, {
  maxIterations: 50,
  progressField: "proposal",
  maxIterationsWithoutProgress: 5,
  useDefaultSafeguards: true,
});

const executor = graph.compile();
```

## Best Practices

1. **Always set reasonable iteration limits** appropriate for your workflow
2. **Track meaningful progress fields** that indicate real advancement
3. **Use explicit termination conditions** rather than relying only on cycle detection
4. **Include safety nodes at critical decision points** in your workflow
5. **Test edge cases** to ensure your workflow terminates properly
6. **Combine different prevention strategies** for robust protection

## Common Pitfalls

1. **Missing END conditions**: Ensure there are paths to properly terminate the workflow
2. **Too strict limits**: Setting iteration limits too low may prevent valid workflows from completing
3. **Inappropriate progress fields**: Choose fields that meaningfully track progress
4. **Ignoring cycle detection results**: Always handle detected cycles appropriately
5. **Not preserving important state**: Be careful not to exclude critical fields from fingerprinting

## Debugging Loop Issues

When debugging loops, use these techniques:

- **Enable verbose logging** to track state changes between iterations
- **Inspect the state history** to identify where cycles are forming
- **Check termination conditions** to ensure they properly evaluate
- **Look for edge case inputs** that might trigger unexpected behavior
- **Verify node transitions** align with your intended workflow