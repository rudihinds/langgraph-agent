# Checkpoint Recovery Procedures

This document outlines the procedures for recovering proposal states from checkpoints in the Proposal Agent System. It provides guidelines for administrators and developers to restore sessions and proposals to their last known states in case of system failures or interruptions.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Recovery Scenarios](#recovery-scenarios)
4. [Recovery Procedures](#recovery-procedures)
5. [Automated Recovery](#automated-recovery)
6. [Troubleshooting](#troubleshooting)
7. [Data Retention and Cleanup](#data-retention-and-cleanup)

## Overview

The Proposal Agent System uses a checkpoint-based persistence mechanism to store the state of proposals and sessions in a PostgreSQL database via Supabase. This allows the system to recover from failures and resume work where it left off. The `PostgresCheckpointer` class and the `SessionManager` class are the key components that handle state persistence and recovery.

Key points about the checkpoint system:

- Proposals are stored in the `proposal_checkpoints` table
- Each proposal can have multiple checkpoint entries (threads)
- Checkpoints include serialized state data and thread information
- Sessions have additional metadata stored with a `proposal_sessions:` prefix
- Row-level security policies protect data from unauthorized access

## Prerequisites

To perform recovery operations, you need:

1. Administrative access to the Supabase database
2. The proposal ID or user ID related to the data being recovered
3. Access to application logs for reference
4. Understanding of the `ProposalManager` and `SessionManager` APIs

## Recovery Scenarios

### 1. System Crash or Restart

If the application server crashes or restarts, sessions may be interrupted. Upon restart:

- The `SessionManager` will automatically load active sessions from the database
- Users can navigate back to their proposal to continue working
- The session will be restored to its last saved state

### 2. User Session Timeout

When a user session times out due to inactivity:

- The session is automatically marked as paused
- The user can resume the session by navigating back to the proposal
- The `SessionManager.resumeSession()` method will be called to restore the session

### 3. Corrupted State

In rare cases where a state becomes corrupted:

- Administrators can restore from a previous checkpoint
- The system keeps a history of writes that can be used for rollback

### 4. Database Migration or Recovery

When restoring from a database backup or after migration:

- All checkpoints will be available from the backup point
- Sessions will need to be manually reactivated if they were active at the time of backup

## Recovery Procedures

### Recovering a Specific Proposal

To recover a specific proposal to its last known state:

```typescript
import { ProposalManager } from "../src/checkpoint/ProposalManager";
import { PostgresCheckpointer } from "../src/checkpoint/PostgresCheckpointer";
import { SupabaseConnectionPool } from "../src/checkpoint/supabaseClient";

// Create a Supabase client pool
const pool = SupabaseConnectionPool.getInstance({
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_SERVICE_KEY!,
});

// Create a checkpointer
const checkpointer = new PostgresCheckpointer({
  supabaseClient: pool.getClient(),
});

// Create a proposal manager
const proposalManager = new ProposalManager({
  checkpointer,
});

// Recover a proposal by ID
async function recoverProposal(proposalId: string) {
  const proposal = await proposalManager.getProposal(proposalId);

  if (!proposal) {
    console.error(`Proposal ${proposalId} not found`);
    return null;
  }

  console.log(`Recovered proposal: ${proposal.metadata.proposalTitle}`);
  return proposal;
}

// Usage
recoverProposal("12345-abcde-67890")
  .then((proposal) => {
    if (proposal) {
      console.log("Recovery successful");
    }
  })
  .catch((error) => {
    console.error("Recovery failed:", error);
  });
```

### Recovering a User Session

To recover a paused or interrupted session:

```typescript
import { SessionManager } from "../src/checkpoint/SessionManager";
import { ProposalManager } from "../src/checkpoint/ProposalManager";
import { PostgresCheckpointer } from "../src/checkpoint/PostgresCheckpointer";
import { ThreadManager } from "../src/checkpoint/threadManager";
import { SupabaseConnectionPool } from "../src/checkpoint/supabaseClient";

// Create a Supabase client pool
const pool = SupabaseConnectionPool.getInstance({
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_SERVICE_KEY!,
});

const supabaseClient = pool.getClient();

// Create dependencies
const checkpointer = new PostgresCheckpointer({ supabaseClient });
const proposalManager = new ProposalManager({ checkpointer });
const threadManager = new ThreadManager(checkpointer);

// Create a session manager
const sessionManager = new SessionManager({
  proposalManager,
  checkpointer,
  threadManager,
  supabaseClient,
});

// Start the session manager to load existing sessions
sessionManager.start();

// Recover a specific session
async function recoverUserSession(sessionId: string) {
  try {
    const session = await sessionManager.recoverSession(sessionId);
    console.log(`Recovered session for proposal: ${session.proposalId}`);
    return session;
  } catch (error) {
    console.error(`Failed to recover session ${sessionId}:`, error);
    return null;
  }
}

// Usage
recoverUserSession("session:12345-abcde-67890:1648900000000").then(
  (session) => {
    if (session) {
      console.log("Session recovery successful");
    }
  }
);
```

### Restoring from a Specific Checkpoint

To restore a proposal to a specific checkpoint (rollback):

```typescript
async function restoreFromCheckpoint(namespace: string) {
  // Get the checkpoint data
  const checkpoint = await checkpointer.get({ namespace });

  if (!checkpoint) {
    console.error(`Checkpoint ${namespace} not found`);
    return null;
  }

  // Extract proposal ID from the namespace
  const parts = namespace.split(":");
  const proposalId = parts[1]; // Assuming format is proposal:{proposalId}:user:{userId}

  // Create a new checkpoint with the state
  await checkpointer.put({
    namespace,
    state: checkpoint.state,
    writes: null, // Reset the writes history
  });

  console.log(`Restored proposal ${proposalId} to checkpoint ${namespace}`);
  return checkpoint.state;
}
```

## Automated Recovery

The system includes automated recovery mechanisms:

1. **Automatic Session Loading**: On system startup, the `SessionManager` loads all active sessions from the database.

2. **Session Timeout Handling**: Sessions that exceed their timeout period are automatically paused and can be resumed later.

3. **Session Keep-Alive**: When users interact with the system, the session's `lastActivity` timestamp is updated to prevent timeouts.

4. **Maximum Session Lifetime**: Sessions that exceed their maximum lifetime are automatically closed to prevent resource consumption.

## Troubleshooting

### Common Issues and Solutions

#### Issue: Session not found when trying to recover

**Solution**: Check if the session was closed rather than paused. Closed sessions are removed from the active sessions list. You may need to create a new session for the proposal.

```typescript
// Check if session exists
const session = sessionManager.getSession(sessionId);

if (!session) {
  // Try to recover from storage
  try {
    await sessionManager.recoverSession(sessionId);
  } catch (error) {
    // Create a new session if recovery fails
    const proposalId = extractProposalIdFromSessionId(sessionId);
    const userId = extractUserIdFromSessionId(sessionId);
    const newSessionId = await sessionManager.createSession(proposalId, userId);
    console.log(
      `Created new session ${newSessionId} for proposal ${proposalId}`
    );
  }
}
```

#### Issue: Corrupted state data

**Solution**: Use the writes history to roll back to a previous state.

```typescript
async function rollbackToLastValidState(namespace: string) {
  const checkpoint = await checkpointer.get({ namespace });

  if (!checkpoint || !checkpoint.writes || checkpoint.writes.length === 0) {
    console.error(`No writes history found for ${namespace}`);
    return null;
  }

  // Get the previous state by applying all writes except the last one
  const previousWrites = checkpoint.writes.slice(0, -1);

  // Apply the writes to an empty state
  let state = {};
  for (const write of previousWrites) {
    // Apply the write operation (simplified)
    state = { ...state, ...write };
  }

  // Save the rolled back state
  await checkpointer.put({
    namespace,
    state,
    writes: previousWrites,
  });

  console.log(`Rolled back ${namespace} to previous state`);
  return state;
}
```

#### Issue: Database connection issues

**Solution**: Use the connection pool to handle reconnections.

```typescript
async function ensureConnected() {
  try {
    // Force a new client to ensure fresh connection
    const client = pool.getClient({ forceNew: true });

    // Test connection with a simple query
    const { error } = await client
      .from("proposal_checkpoints")
      .select("id")
      .limit(1);

    if (error) {
      console.error("Connection test failed:", error);
      return false;
    }

    console.log("Connection successful");
    return true;
  } catch (error) {
    console.error("Connection error:", error);
    return false;
  }
}
```

## Data Retention and Cleanup

### Cleanup Policies

1. **Completed Sessions**: When a session is marked as completed, its checkpoints remain in the database for reference but the session itself is removed from the active sessions list.

2. **Error Sessions**: Sessions that encountered errors are kept for troubleshooting but marked with an error state.

3. **Abandoned Proposals**: Proposals that haven't been accessed for an extended period can be archived or deleted based on your organization's retention policy.

### Manual Cleanup

To manually clean up old checkpoints:

```typescript
async function cleanupOldCheckpoints(cutoffDate: Date) {
  const { data, error } = await supabaseClient
    .from("proposal_checkpoints")
    .delete()
    .lt("updated_at", cutoffDate.toISOString());

  if (error) {
    console.error("Cleanup failed:", error);
    return false;
  }

  console.log(`Deleted ${data?.length || 0} old checkpoints`);
  return true;
}

// Delete checkpoints older than 90 days
const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - 90);
cleanupOldCheckpoints(cutoffDate);
```

### Archiving

Instead of deleting, you may want to archive old data:

```typescript
async function archiveOldProposals(cutoffDate: Date) {
  // First, select old proposals
  const { data: oldProposals, error } = await supabaseClient
    .from("proposal_checkpoints")
    .select("proposal_id, namespace, state")
    .lt("updated_at", cutoffDate.toISOString());

  if (error || !oldProposals) {
    console.error("Archive selection failed:", error);
    return false;
  }

  // Insert into archive table
  const { error: archiveError } = await supabaseClient
    .from("proposal_archives")
    .insert(
      oldProposals.map((p) => ({
        proposal_id: p.proposal_id,
        namespace: p.namespace,
        state: p.state,
        archived_at: new Date().toISOString(),
      }))
    );

  if (archiveError) {
    console.error("Archive insertion failed:", archiveError);
    return false;
  }

  // Delete from active table
  const { error: deleteError } = await supabaseClient
    .from("proposal_checkpoints")
    .delete()
    .lt("updated_at", cutoffDate.toISOString());

  if (deleteError) {
    console.error("Archive deletion failed:", deleteError);
    return false;
  }

  console.log(`Archived ${oldProposals.length} old proposals`);
  return true;
}
```

## Conclusion

This document provides a comprehensive guide to recovering proposal states and sessions from checkpoints in the Proposal Agent System. By following these procedures, you can ensure the reliability and resilience of the system, minimizing data loss and disruption in case of failures.

For additional assistance, please contact the system administrator or refer to the system logs for more detailed information about specific failures and recovery attempts.
