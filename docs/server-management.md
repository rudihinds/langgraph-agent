# LangGraph Agent Server Management Guide

This guide provides instructions for managing the LangGraph agent server, including proper shutdown and restart procedures to ensure reliable operation and clean resource handling.

## Server Process Management

### Proper Shutdown

To gracefully shutdown the LangGraph agent server, follow these steps:

1. **Send termination signal**: Use SIGTERM to allow proper cleanup
   ```bash
   kill -15 <server_pid>
   ```
   
2. **Alternative approach**: If running in a terminal, press `Ctrl+C` to trigger a graceful shutdown

3. **Force termination (use only when necessary)**: If the server is unresponsive
   ```bash 
   kill -9 <server_pid>
   ```
   Note: This may leave resources in an inconsistent state

### Finding the Server Process

To find the running LangGraph server process:

```bash
ps aux | grep langgraph-agent
```

Identify the process ID (PID) from the output to use in the kill command.

### Restart Procedure

For a complete restart:

1. Stop the current running server (see Proper Shutdown above)
2. Wait approximately 5 seconds to ensure clean termination
3. Start the server using the appropriate command:
   ```bash
   cd /Users/rudihinds/code/langgraph-agent
   npm run start:server
   ```
   
### Health Check

After restart, verify the server is functioning correctly:

```bash
curl http://localhost:3000/api/health
```

A successful response indicates the server is ready to accept connections.

## Resource Management

The LangGraph server implements comprehensive resource tracking and cleanup mechanisms to ensure that resources are properly released even during irregular termination scenarios.

### Implemented Safeguards

1. **Process Termination Handlers**: Signal handlers (SIGINT, SIGTERM) trigger proper cleanup
2. **Resource Tracking**: All resources are monitored via the resource tracker module
3. **Automatic Cleanup**: Resources are released when a workflow completes or terminates
4. **Forceful Termination Recovery**: On next server start, orphaned resources are detected and cleaned

### Troubleshooting Resource Issues

If you experience resource-related problems (memory leaks, connection issues):

1. Check the server logs for warning messages about resource cleanup failures
2. Restart the server to trigger the cleanup recovery mechanism
3. Monitor resource usage after restart to confirm successful cleanup

## Monitoring Guidelines

When managing the server in production:

1. Configure health check monitoring to detect server availability
2. Set up log monitoring to catch resource cleanup warnings
3. Implement automated restart procedures if the server becomes unresponsive
4. Monitor resource usage (memory, connections) for unexpected growth patterns

## Testing Restart Procedures

To verify proper server restart functionality:

1. Start the server and initiate some workflows
2. Shutdown the server using the proper procedure
3. Restart the server and verify:
   - Previously running workflows resume correctly
   - Resources are properly cleaned up
   - New workflows can be initiated

Following these guidelines ensures reliable operation of the LangGraph agent server, particularly in production environments where proper resource management is critical.