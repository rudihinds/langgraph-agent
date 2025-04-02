# Session Management Best Practices

This document provides guidance on implementing and using the `SessionManager` for handling proposal sessions in the agent system.

## Overview

The `SessionManager` is responsible for managing the lifecycle of proposal editing sessions, including:

- Creating new sessions
- Tracking user activity
- Implementing session timeout
- Pausing and resuming sessions
- Recovering from interrupted sessions
- Ensuring proper cleanup of abandoned sessions

## Key Components

### Session Metadata

Each session has associated metadata that tracks:

- Session ID
- Proposal ID
- User ID
- Thread ID for LangGraph state
- Last activity timestamp
- Creation timestamp
- Current state (running, paused, completed, error)
- Current phase and step in the workflow
- Optional error details

### Configuration Options

The `SessionManager` can be configured with:

- Session timeout duration (default: 30 minutes)
- Check interval for timeout monitoring (default: 1 minute)
- Maximum session lifetime (default: 24 hours)

## Session Lifecycle

### 1. Creation

Sessions are created when a user starts working on a proposal:

```typescript
const sessionId = await sessionManager.createSession(proposalId, userId);
```

This:

- Verifies the user has access to the proposal
- Creates a thread if needed
- Initializes session metadata
- Persists the session state

### 2. Activity Tracking

To prevent timeouts, record user activity:

```typescript
await sessionManager.recordActivity(sessionId);
```

Call this whenever the user performs an action like:

- Submitting information
- Editing content
- Providing feedback
- Navigating between sections

### 3. Session Updates

Update session metadata when workflow state changes:

```typescript
await sessionManager.updateSession(sessionId, {
  currentPhase: "section_generation",
  currentStep: "problem_statement",
  state: "running",
});
```

### 4. Pausing and Resuming

For long interruptions, pause sessions:

```typescript
await sessionManager.pauseSession(sessionId, "User requested pause");
```

Resume them later:

```typescript
const session = await sessionManager.resumeSession(sessionId);
```

### 5. Session Completion

When work is finished, close the session:

```typescript
await sessionManager.closeSession(sessionId, "completed");
```

For error conditions:

```typescript
await sessionManager.closeSession(sessionId, "error", "Error details here");
```

## Automatic Timeout Handling

The `SessionManager` automatically handles session timeouts:

1. Call `sessionManager.start()` during application initialization
2. The manager will check for inactive sessions at the configured interval
3. Sessions inactive for longer than the timeout will be automatically paused
4. Sessions exceeding maximum lifetime will be closed
5. Call `sessionManager.stop()` during application shutdown

## Recovery Mechanisms

To recover from browser crashes or service interruptions:

```typescript
const session = await sessionManager.recoverSession(sessionId);
```

This will:

1. Load the session metadata
2. Verify session isn't already closed
3. Update the session state to "running"
4. Record new activity timestamp
5. Return the session metadata

## Implementation Considerations

### Error Handling

Always wrap session operations in try/catch blocks:

```typescript
try {
  await sessionManager.updateSession(sessionId, updates);
} catch (error) {
  console.error("Failed to update session:", error);
  // Implement appropriate error handling
}
```

### Persistence Strategy

Session metadata is stored using the `PostgresCheckpointer` in a dedicated namespace:

- Each session has a unique namespace: `proposal_sessions:${sessionId}`
- The state object contains the SessionMetadata
- The writes field is not used for sessions

### Session Cleanup

Regularly clean up old sessions:

```typescript
// Example manual cleanup in an admin function
async function cleanupOldSessions() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);

  // Find and delete old sessions
  // Implementation depends on your specific database access
}
```

## Security Considerations

1. Always verify user ownership before allowing session access
2. Implement session token validation if exposed via API
3. Ensure proper isolation between user sessions
4. Apply appropriate Row Level Security policies on session data

## Integration with UI

Implement status indicators in the UI:

1. Show active session status
2. Provide timeout warnings
3. Allow manual pausing and resuming
4. Display recovery options when applicable

## Troubleshooting

Common issues and solutions:

1. **Session not found**: Verify sessionId is correct and not expired
2. **Cannot resume session**: Check if session was closed or exceeded maximum lifetime
3. **Frequent timeouts**: Review session timeout configuration and activity tracking calls
4. **Persistence failures**: Check database connectivity and permissions
