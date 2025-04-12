# Loop Prevention Patterns for LangGraph

This guide provides advanced patterns and best practices for implementing loop prevention in complex LangGraph workflows.

## Implementation Patterns

### Pattern 1: Defensive Loop Prevention (Recommended)

Configure loop prevention at the graph level with safe defaults, useful for most applications:

```typescript
import { StateGraph } from "@langchain/langgraph";
import { configureLoopPrevention } from "../lib/llm/loop-prevention";

// Create your state graph
const graph = new StateGraph({ channels: {} });

// Configure with default settings (early in your setup)
configureLoopPrevention(graph, {
  maxIterations: 15,
  autoTrackProgress: true
});

// Continue normal graph setup
graph.addNode("generateContent", generateContentNode);
// ...
```

### Pattern 2: Progress-Based Protection

Monitor specific fields for meaningful changes:

```typescript
configureLoopPrevention(graph, {
  maxIterations: 20,
  progressField: "proposal", // Track changes to this field
  maxIterationsWithoutProgress: 3
});
```

### Pattern 3: Checkpoint Recovery Ready

Configure loop prevention to work seamlessly with checkpoint recovery:

```typescript
// Configure loop prevention
configureLoopPrevention(graph, {
  // Standard configuration
  maxIterations: 15,
  progressField: "content",
  
  // On termination, capture important state
  onTermination: (state, reason) => {
    // Log the reason and critical state for recovery
    console.warn(`Workflow terminated: ${reason}`);
    state._terminationReason = reason;
    state._recoveryAttempt = (state._recoveryAttempt || 0) + 1;
  }
});

// Configure checkpointer
const app = graph.compile({
  checkpointer: new PostgresCheckpointer({
    tableName: "workflows",
    connectionString: process.env.DATABASE_URL
  })
});
```

### Pattern 4: Human Intervention Circuit-Breaker

Automatically request human help when loops are detected:

```typescript
import { NodeInterrupt } from "@langchain/langgraph";

configureLoopPrevention(graph, {
  maxIterations: 20,
  
  // When loop detected, interrupt for human help
  onTermination: (state, reason) => {
    throw new NodeInterrupt(
      "requestHumanHelp",
      state,
      {
        reason,
        message: "The workflow appears to be stuck in a loop. Please provide guidance."
      }
    );
  }
});

// Add human intervention node
graph.addNode("requestHumanHelp", async (data) => {
  // Implementation for human intervention
  // Could send notification, create ticket, etc.
  return {
    ...data.state,
    humanIntervention: true,
    humanFeedback: null
  };
});
```

### Pattern 5: Adaptive Loop Prevention

Dynamically adjust prevention parameters based on workflow complexity:

```typescript
configureLoopPrevention(graph, {
  // Base configuration
  maxIterations: 15,
  
  // Custom normalization function that adapts to state complexity
  normalizeFn: (state) => {
    // For complex workflows, add additional fields to fingerprinting
    if (state.workflowComplexity === "high") {
      return {
        ...state,
        _fingerprint: {
          mainContent: state.content,
          structuralElements: state.structure,
          metadataFingerprint: state.metadata ? createMetadataFingerprint(state.metadata) : null
        }
      };
    }
    
    // For simple workflows, use standard fingerprinting
    return state;
  }
});
```

## Testing Strategies

### Strategy 1: Forced Loop Testing

Create tests that deliberately create infinite loops to test detection:

```typescript
it("should detect and terminate infinite loops", async () => {
  // Create a graph with a deliberate infinite loop
  const graph = new StateGraph({
    channels: { counter: 0 }
  });
  
  // This node never changes state - will cause a loop
  graph.addNode("noChangeNode", async (data) => {
    return { counter: data.state.counter };
  });
  
  // This edge always routes back to the same node
  graph.addConditionalEdges(
    "noChangeNode", 
    (state) => "noChangeNode"
  );
  
  // Configure loop prevention
  configureLoopPrevention(graph, {
    maxIterations: 5
  });
  
  const app = graph.compile();
  
  // Should detect the loop and throw an error
  await expect(app.invoke({ counter: 0 }))
    .rejects
    .toThrow("Loop detection terminated workflow");
});
```

### Strategy 2: Progress Detection Verification

Test that progress detection works as expected:

```typescript
it("should correctly track progress in specified field", async () => {
  const progressFieldSpy = vi.fn();
  
  // Configure with progress tracking
  configureLoopPrevention(graph, {
    progressField: "value",
    maxIterationsWithoutProgress: 2,
    onTermination: progressFieldSpy
  });
  
  // Create a sequence that makes progress then stalls
  const steps = [
    { counter: 1, value: "initial" },
    { counter: 2, value: "updated" },
    { counter: 3, value: "updated" }, // No change in value
    { counter: 4, value: "updated" }  // Still no change
  ];
  
  // Mock node that follows the sequence
  let stepIndex = 0;
  graph.addNode("sequenceNode", async () => {
    return steps[stepIndex++];
  });
  
  graph.addConditionalEdges(
    "sequenceNode",
    () => stepIndex < steps.length ? "sequenceNode" : "END"
  );
  
  const app = graph.compile();
  
  // Should terminate due to lack of progress
  await expect(app.invoke({ counter: 0, value: "" }))
    .rejects
    .toThrow("No progress detected");
  
  // Should have called our spy with the right reason
  expect(progressFieldSpy).toHaveBeenCalledWith(
    expect.anything(),
    expect.stringContaining("No progress detected in specified field")
  );
});
```

### Strategy 3: Integration Testing

Test loop prevention alongside other LangGraph features:

```typescript
it("should work with checkpointing and human interventions", async () => {
  const memorySaver = new MemorySaver();
  
  // Configure graph with both checkpoint and loop prevention
  const graph = createWorkflowGraph();
  configureLoopPrevention(graph, { maxIterations: 5 });
  
  const app = graph.compile({
    checkpointer: memorySaver
  });
  
  // Start execution
  let threadId;
  try {
    await app.invoke({ counter: 0 });
  } catch (e) {
    // Should fail with loop error
    expect(e.message).toContain("Loop detection terminated workflow");
    threadId = e.threadId;
  }
  
  // Should have created a checkpoint
  const checkpoints = await memorySaver.list({});
  expect(checkpoints.length).toBeGreaterThan(0);
  
  // Should be able to recover from checkpoint with modifications
  const checkpoint = await memorySaver.get(threadId);
  const state = checkpoint.getState();
  
  // Modify state to break the loop
  state.breakLoop = true;
  
  // Create new checkpoint with modified state
  await memorySaver.put(threadId, state);
  
  // Should now be able to continue
  const result = await app.invoke(
    {},
    { configurable: { thread_id: threadId } }
  );
  
  expect(result.completed).toBe(true);
});
```

## Performance Considerations

### Memory Usage

The state fingerprinting system maintains a history of state fingerprints, which can consume memory in long-running workflows. Optimize with:

```typescript
// Limit history length to control memory usage
configureLoopPrevention(graph, {
  fingerprintOptions: {
    maxHistoryLength: 20 // Only keep last 20 states
  }
});
```

### Computation Overhead

Fingerprinting operations add some computational overhead. For very performance-sensitive applications:

```typescript
// Optimize fingerprinting for performance
configureLoopPrevention(graph, {
  fingerprintOptions: {
    // Only include essential fields
    includeFields: ["critical1", "critical2"],
    // Exclude large fields that don't affect cycle detection
    excludeFields: ["largeMetadata", "fullHistory", "verboseDebugInfo"]
  }
});
```

## Troubleshooting Guide

### Common Issues

1. **False Positives**: System incorrectly detects a loop

   Solution: Adjust fingerprinting to exclude frequently changing but non-essential fields:

   ```typescript
   configureLoopPrevention(graph, {
     fingerprintOptions: {
       excludeFields: ["timestamp", "uuid", "randomIds"]
     }
   });
   ```

2. **Premature Termination**: Workflow terminates too early

   Solution: Increase iteration limits or add minimum required iterations:

   ```typescript
   configureLoopPrevention(graph, {
     maxIterations: 30,
     minRequiredIterations: 5 // Allow at least 5 iterations
   });
   ```

3. **Loop Not Detected**: System misses actual infinite loops

   Solution: Ensure proper fingerprinting of relevant state:

   ```typescript
   configureLoopPrevention(graph, {
     fingerprintOptions: {
       includeFields: ["critical1", "critical2"],
       normalizeValue: (value) => {
         // Custom normalization to detect semantic equivalence
         if (typeof value === "string") {
           return value.toLowerCase().trim();
         }
         return value;
       }
     }
   });
   ```

## Conclusion

Effective loop prevention is a critical component of robust LangGraph applications. By applying these patterns and testing strategies, you can ensure your workflows remain stable and efficient, avoiding the common pitfalls of infinite loops while maintaining flexibility for complex, iterative processing.