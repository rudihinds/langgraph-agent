# LangGraph Infinite Loop Prevention Strategies

This document outlines strategies to prevent infinite loops and implement proper termination conditions in LangGraph workflows.

## Core Prevention Mechanisms

### 1. Recursion Limits

LangGraph provides a built-in recursion limit mechanism to prevent infinite loops:

```typescript
// Configure recursion limit when creating the graph
const graph = new StateGraph({
  channels: StateGraphChannels,
  recursion_limit: 10 // Default is 100
});

// The graph will throw a GraphRecursionError if it exceeds this limit
```

When a workflow exceeds the recursion limit, LangGraph throws a `GraphRecursionError` that can be caught and handled.

### 2. Conditional Edges

Properly configured conditional edges are essential for directing the workflow to the END node:

```typescript
graph.addEdge({
  from: "generateSection",
  to: graph.END,
  condition: (state) => {
    // Return true when all sections are complete
    return state.sections.every(section => section.status === "complete");
  }
});
```

Without clear conditions for termination, workflows can cycle indefinitely.

### 3. State Tracking

Implement state tracking to detect and prevent repeated states:

```typescript
function detectRepeatedState(node) {
  return async (state) => {
    // Track the history of states to detect repetition
    state.stateHistory = state.stateHistory || [];
    
    // Create a hashable representation of the current state
    const stateHash = JSON.stringify({
      currentNode: node,
      relevantData: state.relevantData
    });
    
    // Check if we've seen this state before
    if (state.stateHistory.includes(stateHash)) {
      // Prevent infinite loop by forcing termination
      return { ...state, forceEnd: true };
    }
    
    // Add current state to history
    state.stateHistory.push(stateHash);
    
    // Continue with normal processing
    return state;
  };
}
```

### 4. Timeout Safeguards

Implement timeout mechanisms to forcibly terminate long-running workflows:

```typescript
async function runWithTimeout(graph, state, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Execution timed out"));
    }, timeoutMs);
    
    graph.invoke(state)
      .then(result => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}
```

## Implementation Patterns

### Pattern 1: Maximum Iterations Counter

```typescript
function checkMaxIterations(node) {
  return async (state) => {
    // Initialize or increment iterations counter
    state.iterations = state.iterations || {};
    state.iterations[node] = (state.iterations[node] || 0) + 1;
    
    // Check if maximum iterations reached
    if (state.iterations[node] > MAX_ITERATIONS) {
      return { 
        ...state, 
        error: new Error(`Maximum iterations (${MAX_ITERATIONS}) exceeded for node: ${node}`)
      };
    }
    
    return state;
  };
}
```

### Pattern 2: Progress Detection

```typescript
function detectNoProgress(node) {
  return async (state) => {
    // Save previous state for comparison
    if (!state.previousStates) {
      state.previousStates = {};
    }
    
    const currentStateHash = JSON.stringify(state.relevantField);
    const previousStateHash = state.previousStates[node];
    
    // Update previous state
    state.previousStates[node] = currentStateHash;
    
    // If state hasn't changed, increment no progress counter
    if (currentStateHash === previousStateHash) {
      state.noProgressCount = (state.noProgressCount || 0) + 1;
      
      if (state.noProgressCount >= 3) {
        return { 
          ...state, 
          error: new Error("Workflow detected no progress for 3 consecutive iterations")
        };
      }
    } else {
      // Reset counter if progress was made
      state.noProgressCount = 0;
    }
    
    return state;
  };
}
```

### Pattern 3: Completion Detection

```typescript
// Add a completion detection node as the last step before potential looping
graph.addNode("detectCompletion", detectWorkflowCompletion);

function detectWorkflowCompletion(state) {
  // Check for completion conditions
  const isComplete = state.tasks.every(task => task.status === "complete");
  
  if (isComplete) {
    return { ...state, workflowStatus: "complete" };
  }
  
  // Check for maximum allowed runtime
  const startTime = state.metadata?.startTime || Date.now();
  const runtime = Date.now() - startTime;
  
  if (runtime > MAX_RUNTIME_MS) {
    return { 
      ...state, 
      workflowStatus: "terminated",
      terminationReason: "Exceeded maximum allowed runtime"
    };
  }
  
  return state;
}
```

## Best Practices

1. **Always define termination conditions**: Every graph should have clear conditions that route to the END node.

2. **Set appropriate recursion limits**: Configure recursion_limit based on your workflow's expected depth.

3. **Implement state-based loop detection**: Track state changes to detect when the workflow is stuck in a loop.

4. **Use timeout mechanisms**: Implement both per-node and overall workflow timeouts.

5. **Add progress validation**: Ensure each iteration makes measurable progress toward completion.

6. **Handle GraphRecursionError**: Catch and properly handle recursion errors to provide meaningful feedback.

7. **Implement circuit breakers**: Add conditions to break cycles when predefined thresholds are exceeded.

## Common Pitfalls

1. **Missing END conditions**: Failing to define conditions that route to the END node.

2. **Overly generic conditions**: Conditions that are too general and never evaluate to true.

3. **Stateless nodes**: Nodes that don't modify state, leading to repeated identical states.

4. **Improper error handling**: Not catching or properly responding to timeout or recursion errors.

5. **Insufficient monitoring**: Lack of logging or tracking that would identify loops.

## Debugging Infinite Loops

1. **Enable verbose logging**: Add detailed logging to track state transitions.

2. **Implement state snapshots**: Capture state at each step for post-mortem analysis.

3. **Use step-based execution**: Run the workflow step by step to identify problematic transitions.

4. **Analyze state deltas**: Compare state changes between iterations to identify stagnation.

## Example: Complete Loop-Safe Graph

```typescript
import { StateGraph } from "@langchain/langgraph";

// Define your state interface
interface WorkflowState {
  tasks: { id: string; status: string }[];
  iterations: Record<string, number>;
  metadata: {
    startTime: number;
    lastProgressTime: number;
  };
}

// Create graph with safety limits
const graph = new StateGraph<WorkflowState>({
  channels: { 
    tasks: { default: [] },
    iterations: { default: {} },
    metadata: { 
      default: { 
        startTime: Date.now(),
        lastProgressTime: Date.now()
      } 
    }
  },
  recursion_limit: 20
});

// Add nodes with safety wrappers
graph.addNode("processTasks", withSafetyChecks("processTasks", processTasksFunction));
graph.addNode("checkCompletion", checkWorkflowCompletion);

// Add edges with clear termination conditions
graph.addEdge({
  from: "processTasks",
  to: "checkCompletion"
});

graph.addEdge({
  from: "checkCompletion",
  to: graph.END,
  condition: (state) => {
    return state.tasks.every(task => task.status === "complete");
  }
});

graph.addEdge({
  from: "checkCompletion",
  to: "processTasks",
  condition: (state) => {
    return !state.tasks.every(task => task.status === "complete");
  }
});

// Safety wrapper for nodes
function withSafetyChecks(nodeName, nodeFunction) {
  return async (state: WorkflowState) => {
    // Track iterations
    state.iterations = state.iterations || {};
    state.iterations[nodeName] = (state.iterations[nodeName] || 0) + 1;
    
    // Check max iterations
    if (state.iterations[nodeName] > 10) {
      throw new Error(`Maximum iterations exceeded for node: ${nodeName}`);
    }
    
    // Check total runtime
    const runtime = Date.now() - state.metadata.startTime;
    if (runtime > 300000) { // 5 minutes
      throw new Error("Maximum workflow runtime exceeded");
    }
    
    // Process node function
    const result = await nodeFunction(state);
    
    // Check for progress
    const madeProgress = JSON.stringify(state) !== JSON.stringify(result);
    if (madeProgress) {
      result.metadata.lastProgressTime = Date.now();
    } else {
      // No progress check
      const timeSinceProgress = Date.now() - state.metadata.lastProgressTime;
      if (timeSinceProgress > 60000) { // 1 minute
        throw new Error("No progress detected for 1 minute");
      }
    }
    
    return result;
  };
}

// Compile and export
const workflow = graph.compile();
```

## Resources

- [LangGraph Documentation on StateGraph](https://langchain-ai.github.io/langgraph/docs/tutorials/stategraph/)
- [Error Handling in LangGraph](https://langchain-ai.github.io/langgraph/docs/tutorials/errors)
- [Timeouts and Cancellation](https://langchain-ai.github.io/langgraph/docs/tutorials/cancellation)