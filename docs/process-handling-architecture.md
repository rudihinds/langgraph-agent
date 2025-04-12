# Process Handling Architecture

This document provides a detailed overview of the process handling and resource cleanup architecture implemented for the LangGraph agent server.

## Architecture Overview

The system implements a comprehensive resource tracking and cleanup mechanism to ensure that server processes are properly managed during both normal operation and unexpected termination scenarios.

```
┌────────────────────┐      ┌───────────────────┐      ┌───────────────────┐
│                    │      │                   │      │                   │
│  Resource Tracker  │◄────►│ Process Handlers  │◄────►│  StateGraph Flow  │
│                    │      │                   │      │                   │
└────────────────────┘      └───────────────────┘      └───────────────────┘
          ▲                          ▲                           ▲
          │                          │                           │
          │                          │                           │
          ▼                          ▼                           ▼
┌────────────────────┐      ┌───────────────────┐      ┌───────────────────┐
│                    │      │                   │      │                   │
│ Persistent Storage │◄────►│ Signal Handlers   │◄────►│ Cleanup Routines  │
│                    │      │                   │      │                   │
└────────────────────┘      └───────────────────┘      └───────────────────┘
```

## Key Components

### 1. Resource Tracker

The `resource-tracker.ts` module provides mechanisms to track and manage resources used by the application:

- Tracks usage of various resources (memory, connections, tokens, etc.)
- Implements limits and triggers actions when exceeded
- Provides cleanup methods to release resources when needed
- Exposes current resource usage for monitoring and logging

### 2. Process Handlers

The `process-handlers.ts` module handles process lifecycle events:

- Registers signal handlers for SIGINT, SIGTERM
- Implements graceful shutdown procedures
- Coordinates cleanup across all registered resources and workflows
- Provides restart capabilities with proper cleanup
- Handles persistence of resource state for recovery after forced termination

### 3. Signal Handling Flow

When a termination signal is received:

1. Signal handler is triggered (`handleTermination()`)
2. Current resource state is persisted to disk
3. Cleanup routines are executed for all registered trackers and graphs
4. Process exits with appropriate code based on cleanup success

### 4. Orphaned Resource Recovery

To handle cases where forced termination occurs:

1. On startup, `detectOrphanedResources()` checks for persisted state file
2. If found, it processes the orphaned resources
3. Appropriate cleanup actions are taken based on the persisted state
4. State file is removed after successful processing

## Implementation Details

### Resource Tracking

Resources are tracked using a flexible tracking system:

```typescript
const tracker = createResourceTracker({
  limits: {
    tokens: 10000,
    connections: 50
  },
  onLimitExceeded: (usage) => {
    console.warn('Resource limits exceeded:', usage);
    // Take appropriate action
  }
});

// Use throughout the application
tracker.trackResource('tokens', 150);
```

### Graceful Shutdown Sequence

1. Termination signal received (SIGINT/SIGTERM)
2. Current state persisted to `.resource-state.json`
3. All registered resource trackers are reset (triggering cleanup)
4. All registered graphs perform their cleanup routines
5. Wait for async operations to complete
6. Process exits with code 0 if successful, 1 otherwise

### Restart Procedure

The restart procedure follows this sequence:

1. `restartServer()` is called (manually or by admin API)
2. Cleanup is performed as in graceful shutdown
3. After cleanup completes, a new server process is started
4. Original process exits after successful handoff

## Error Handling

The architecture includes comprehensive error handling:

- Uncaught exceptions and unhandled rejections are captured
- Resource state is persisted before potential crashes
- Each cleanup operation is executed in try/catch to prevent cascading failures
- Timeout mechanisms ensure the process terminates even if cleanup hangs

## Testing Strategy

The testing approach covers:

1. **Unit Tests**: Individual components tested in isolation
2. **Integration Tests**: Testing interactions between components
3. **Termination Scenarios**: Simulating various termination signals
4. **Recovery Tests**: Verifying orphaned resource recovery works correctly
5. **Error Handling**: Testing behavior when errors occur during cleanup

## Best Practices

For developers extending this system:

1. Always register new resource trackers with `registerResourceTracker()`
2. Implement proper cleanup in finalizers and error handlers
3. Use try/finally blocks to ensure resources are released
4. Avoid long-running operations during cleanup phase
5. Add appropriate logging for all cleanup operations

## Future Improvements

Potential enhancements to the system:

1. Implementation of distributed resource tracking for clustered deployments
2. Enhanced monitoring and telemetry for resource usage
3. More sophisticated recovery mechanisms for complex workflow states
4. Integration with container orchestration systems for coordinated shutdowns