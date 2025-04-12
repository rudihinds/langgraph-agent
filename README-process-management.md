# LangGraph Agent Process Management

This README provides comprehensive information about the process management capabilities implemented for the LangGraph agent system, focusing on proper termination, resource management, and restart procedures.

## Key Components Implemented

1. **Resource Tracking Utilities**
   - Located in `apps/backend/lib/llm/resource-tracker.ts`
   - Provides tracking of various resource types (memory, tokens, API calls, etc.)
   - Implements configurable limits and callbacks for when limits are exceeded
   - Includes integration with StateGraph for automatic resource checking

2. **Process Handlers**
   - Located in `apps/backend/lib/llm/process-handlers.ts`
   - Implements signal handlers for SIGINT, SIGTERM and uncaught exceptions
   - Provides graceful cleanup of resources during termination
   - Handles persistence of resource state for recovery after forced termination
   - Implements restart capabilities with proper cleanup

3. **Loop Prevention Utilities**
   - Located in `apps/backend/lib/llm/loop-prevention-utils.ts`
   - Detects cycles in workflow execution by fingerprinting state
   - Terminates workflows when loops are detected
   - Provides progress tracking and iteration limits
   - Integrates with resource tracking for comprehensive protection

## Detailed Documentation

For detailed information about the implementation, please refer to:

1. [Server Management Guide](docs/server-management.md) - Instructions for managing the LangGraph agent server, including shutdown and restart procedures.

2. [Process Handling Architecture](docs/process-handling-architecture.md) - Technical details about the process handling architecture.

## Test Coverage

The implementation includes comprehensive test coverage for:

1. **Resource Tracking Tests**
   - Located in `apps/backend/lib/llm/__tests__/resource-tracker.test.ts`
   - Tests tracking of resource usage and limit checking
   - Verifies integration with StateGraph

2. **Process Termination Tests**
   - Located in `apps/backend/lib/llm/__tests__/process-termination.test.ts`
   - Tests signal handling and cleanup during termination
   - Verifies resource persistence and recovery

3. **Resource Cleanup Tests**
   - Located in `apps/backend/lib/llm/__tests__/resource-cleanup.test.ts`
   - Tests cleanup during normal and forced termination
   - Verifies timeout and cancellation handling

## Quick Usage Guide

### Managing the Server

**Graceful Shutdown:**
```bash
# Find the process ID
ps aux | grep langgraph-agent

# Send termination signal
kill -15 <server_pid>
```

**Restart Procedure:**
```bash
# Stop current server
kill -15 <server_pid>

# Wait 5 seconds
sleep 5

# Start the server
cd /Users/rudihinds/code/langgraph-agent
npm run start:server
```

### Health Check

```bash
curl http://localhost:3000/api/health
```

## Configuration Options

The resource tracking and process handling systems can be configured through environment variables:

```
# Resource limits
MAX_TOKENS=100000
MAX_API_CALLS=1000
MAX_RUNTIME_MS=300000

# Process management
GRACEFUL_SHUTDOWN_TIMEOUT_MS=5000
ENABLE_RESOURCE_PERSISTENCE=true
```

## Additional Information

For more information about LangGraph and its capabilities, please refer to the [LangGraph.js documentation](https://langchain-ai.github.io/langgraphjs/).

For questions or issues, please create an issue in the project repository.