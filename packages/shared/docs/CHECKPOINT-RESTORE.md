# Checkpoint Restore Procedures

This document outlines the procedures for restoring proposal agent state from checkpoints in the event of failures or application restarts.

## Overview

The proposal agent system uses a persistent checkpoint system built on PostgreSQL to ensure that agent state can be recovered in various failure scenarios. This document explains how to effectively implement checkpoint recovery in different situations.

## Prerequisites

Before implementing checkpoint recovery, ensure you have:

1. A properly configured `PostgresCheckpointer` instance
2. Access to the appropriate Supabase database
3. Knowledge of the proposal ID or namespace for the state you need to recover

## Recovery Scenarios

### 1. Application Restart Recovery

When the application restarts after a planned shutdown or crash:

```typescript
import { PostgresCheckpointer } from "@shared/checkpoint/PostgresCheckpointer";
import { ProposalManager } from "@shared/checkpoint/ProposalManager";
import { SessionManager } from "@shared/checkpoint/SessionManager";

async function recoverOnStartup() {
  // Initialize the checkpointer
  const checkpointer = new PostgresCheckpointer({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_SERVICE_KEY,
  });

  // Create proposal and session managers
  const proposalManager = new ProposalManager({ checkpointer });
  const sessionManager = new SessionManager({
    proposalManager,
    checkpointer,
    threadManager,
  });

  // Start the session manager to recover existing sessions
  sessionManager.start();

  console.log("Session manager started, existing sessions have been recovered");
}
```

### 2. User Session Recovery

When a user needs to resume a previous session after a browser refresh or crash:

```typescript
async function handleUserReturn(userId: string, proposalId: string) {
  try {
    // Find existing sessions for this proposal
    const userSessions = await sessionManager.getUserSessions(userId);
    const proposalSessions = userSessions.filter(
      (session) => session.proposalId === proposalId
    );

    if (proposalSessions.length > 0) {
      // Sort by most recent activity
      const sortedSessions = proposalSessions.sort(
        (a, b) =>
          new Date(b.lastActivity).getTime() -
          new Date(a.lastActivity).getTime()
      );

      // Resume the most recent session
      const mostRecentSession = sortedSessions[0];
      await sessionManager.resumeSession(mostRecentSession.sessionId);

      return mostRecentSession.sessionId;
    } else {
      // Create a new session if none exists
      return await sessionManager.createSession(proposalId, userId);
    }
  } catch (error) {
    console.error("Failed to recover user session:", error);
    // Fall back to creating a new session
    return await sessionManager.createSession(proposalId, userId);
  }
}
```

### 3. Error Recovery

When a session encounters an error that requires state restoration:

```typescript
async function recoverFromError(sessionId: string, errorDetails: string) {
  try {
    // Get the current session metadata
    const session = await sessionManager.getSession(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Update session to error state
    await sessionManager.updateSession(sessionId, {
      state: "error",
      errorDetails,
    });

    // Attempt recovery
    return await sessionManager.recoverSession(sessionId);
  } catch (error) {
    console.error("Failed to recover from error:", error);
    throw error;
  }
}
```

## Restoration from Database Backup

If you need to restore from a database backup:

1. Restore the Supabase database from backup
2. Initialize the application with the standard startup procedure
3. Sessions will be automatically recovered from the restored database

## Manual State Recovery

For situations requiring manual intervention:

```typescript
async function manualStateRecovery(namespace: string) {
  const checkpointer = new PostgresCheckpointer({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_SERVICE_KEY,
  });

  // Retrieve the checkpoint directly
  const checkpoint = await checkpointer.get({ namespace });

  if (!checkpoint) {
    throw new Error(`No checkpoint found for namespace: ${namespace}`);
  }

  // Log the raw state for debugging
  console.log("Retrieved checkpoint:", checkpoint);

  return checkpoint;
}
```

## Verification and Testing

After performing a checkpoint recovery, it's important to verify the state:

```typescript
async function verifyRecoveredState(proposalId: string, userId: string) {
  // Get the proposal with recovered state
  const proposal = await proposalManager.getProposal(proposalId);

  if (!proposal) {
    throw new Error(`Failed to recover proposal: ${proposalId}`);
  }

  // Verify critical state components
  const verification = {
    hasMessages: proposal.messages.length > 0,
    hasMetadata:
      proposal.metadata && proposal.metadata.proposalId === proposalId,
    userMatch: proposal.metadata.userId === userId,
    hasSections: Object.keys(proposal.proposalSections).length > 0,
  };

  console.log("Verification results:", verification);

  // Return true if all critical components are present
  return Object.values(verification).every((value) => value === true);
}
```

## Troubleshooting

If you encounter issues during recovery:

1. **Invalid or corrupt state**: Use the `executeBatch` method to retrieve both state and writes, which might contain additional recovery information.

2. **Missing checkpoints**: Verify the namespace format. Proposal checkpoints use the format `proposal:{proposalId}`.

3. **Permission errors**: Ensure the service role key has proper access to the checkpoints table.

4. **Serialization errors**: If deserializing the state fails, inspect the raw state from PostgreSQL and check for JSON format issues.

## Best Practices

1. **Frequent checkpointing**: Configure your application to create checkpoints at appropriate intervals, especially after important state changes.

2. **Defensive error handling**: Always wrap recovery code in try/catch blocks and provide graceful fallbacks.

3. **Logging**: Maintain comprehensive logs of checkpoint operations to aid in debugging recovery issues.

4. **Regular testing**: Periodically test your recovery procedures to ensure they work as expected.

5. **State validation**: Implement validation to ensure recovered state meets your application's requirements before proceeding.

## Conclusion

The checkpoint recovery system provides robust protection against data loss, but should be used with appropriate error handling and verification to ensure smooth operation of the proposal agent system.
