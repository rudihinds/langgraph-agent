# Data Retention Policies

This document outlines the data retention policies and implementation guidelines for managing proposal checkpoint data in the LangGraph proposal agent system.

## Overview

The proposal agent system stores checkpoint data in PostgreSQL to maintain state across sessions. Without proper retention policies, this data can grow indefinitely, leading to increased storage costs and decreased performance. This document outlines policies and implementation approaches for managing this data over time.

## Retention Policy Guidelines

### Checkpoint Data Categories

Checkpoint data falls into several categories, each with different retention requirements:

1. **Active Proposals** - Proposals that are currently being worked on
2. **Completed Proposals** - Proposals that have been finalized and submitted
3. **Abandoned Proposals** - Proposals that have been inactive for an extended period
4. **Session Metadata** - Information about user sessions
5. **Historical Versions** - Intermediate states of a proposal during development

### Retention Periods

| Data Category       | Retention Period            | Rationale                            |
| ------------------- | --------------------------- | ------------------------------------ |
| Active Proposals    | Indefinite                  | Needed for ongoing work              |
| Completed Proposals | 90 days after completion    | Allows for review and revision       |
| Abandoned Proposals | 30 days after last activity | Balance between recovery and storage |
| Session Metadata    | 14 days after session end   | Troubleshooting window               |
| Historical Versions | 7 days                      | Short-term rollback capability       |

## Implementation

### Database Cleanup Function

Implement a scheduled function to clean up expired data:

```typescript
import { PostgresCheckpointer } from "../checkpoint/PostgresCheckpointer";
import { SupabaseClient } from "@supabase/supabase-js";

export interface RetentionConfig {
  completedProposalDays: number;
  abandonedProposalDays: number;
  sessionMetadataDays: number;
  historicalVersionsDays: number;
}

export async function cleanupExpiredData(
  supabase: SupabaseClient,
  config: RetentionConfig = {
    completedProposalDays: 90,
    abandonedProposalDays: 30,
    sessionMetadataDays: 14,
    historicalVersionsDays: 7,
  }
) {
  const now = new Date();

  // Calculate cutoff dates
  const completedCutoff = new Date(now);
  completedCutoff.setDate(
    completedCutoff.getDate() - config.completedProposalDays
  );

  const abandonedCutoff = new Date(now);
  abandonedCutoff.setDate(
    abandonedCutoff.getDate() - config.abandonedProposalDays
  );

  const sessionCutoff = new Date(now);
  sessionCutoff.setDate(sessionCutoff.getDate() - config.sessionMetadataDays);

  const versionsCutoff = new Date(now);
  versionsCutoff.setDate(
    versionsCutoff.getDate() - config.historicalVersionsDays
  );

  // Delete completed proposals past retention period
  const { data: completedDeleted, error: completedError } = await supabase
    .from("proposal_checkpoints")
    .delete()
    .eq("state->>'status'", "completed")
    .lt("updated_at", completedCutoff.toISOString());

  if (completedError) {
    console.error("Error deleting completed proposals:", completedError);
  } else {
    console.log(`Deleted ${completedDeleted?.length || 0} completed proposals`);
  }

  // Delete abandoned proposals past retention period
  const { data: abandonedDeleted, error: abandonedError } = await supabase
    .from("proposal_checkpoints")
    .delete()
    .not("state->>'status'", "completed")
    .lt("updated_at", abandonedCutoff.toISOString());

  if (abandonedError) {
    console.error("Error deleting abandoned proposals:", abandonedError);
  } else {
    console.log(`Deleted ${abandonedDeleted?.length || 0} abandoned proposals`);
  }

  // Delete old session metadata
  const { data: sessionsDeleted, error: sessionsError } = await supabase
    .from("proposal_checkpoints")
    .delete()
    .ilike("namespace", "proposal_sessions:%")
    .lt("updated_at", sessionCutoff.toISOString());

  if (sessionsError) {
    console.error("Error deleting session metadata:", sessionsError);
  } else {
    console.log(`Deleted ${sessionsDeleted?.length || 0} session records`);
  }

  // Delete historical versions
  // This requires a custom SQL query to identify old versions while keeping the latest
  const { error: versionsError } = await supabase.rpc(
    "delete_old_proposal_versions",
    {
      cutoff_date: versionsCutoff.toISOString(),
    }
  );

  if (versionsError) {
    console.error("Error deleting historical versions:", versionsError);
  } else {
    console.log("Historical versions cleanup completed");
  }

  return {
    completedDeleted: completedDeleted?.length || 0,
    abandonedDeleted: abandonedDeleted?.length || 0,
    sessionsDeleted: sessionsDeleted?.length || 0,
  };
}
```

### SQL Function for Version Cleanup

Create a PostgreSQL function to handle historical version cleanup:

```sql
CREATE OR REPLACE FUNCTION delete_old_proposal_versions(cutoff_date TIMESTAMPTZ)
RETURNS void AS $$
BEGIN
  -- Keep only the latest version for each proposal when older than cutoff date
  WITH ranked_versions AS (
    SELECT
      id,
      namespace,
      ROW_NUMBER() OVER (PARTITION BY substring(namespace from 'proposal:([^:]+)') ORDER BY updated_at DESC) as rn,
      updated_at
    FROM
      proposal_checkpoints
    WHERE
      namespace ~ '^proposal:[^:]+$'
  )
  DELETE FROM proposal_checkpoints
  WHERE id IN (
    SELECT id FROM ranked_versions
    WHERE rn > 1 AND updated_at < cutoff_date
  );
END;
$$ LANGUAGE plpgsql;
```

### Scheduling Cleanup

Use a scheduled function to run the cleanup regularly:

```typescript
// In a serverless function or cron job
import { createClient } from "@supabase/supabase-js";
import { cleanupExpiredData } from "./retention";

export async function scheduledRetentionCleanup() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  console.log("Starting scheduled data retention cleanup");

  try {
    const results = await cleanupExpiredData(supabase);
    console.log("Cleanup completed:", results);
    return { success: true, results };
  } catch (error) {
    console.error("Cleanup failed:", error);
    return { success: false, error };
  }
}
```

## Archiving Strategy

Instead of immediate deletion, consider implementing archiving for valuable data:

```typescript
async function archiveOldProposals(
  supabase: SupabaseClient,
  cutoffDays: number = 180
) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - cutoffDays);

  // Find proposals to archive
  const { data: proposalsToArchive, error: findError } = await supabase
    .from("proposal_checkpoints")
    .select("id, namespace, state, proposal_id, user_id")
    .lt("updated_at", cutoffDate.toISOString())
    .is("archived", null); // Only those not already archived

  if (findError) {
    console.error("Error finding proposals to archive:", findError);
    return { success: false, error: findError };
  }

  if (!proposalsToArchive || proposalsToArchive.length === 0) {
    console.log("No proposals to archive");
    return { success: true, archivedCount: 0 };
  }

  // Archive the proposals
  const archivePromises = proposalsToArchive.map(async (proposal) => {
    // Store in archives table
    const { error: archiveError } = await supabase
      .from("proposal_archives")
      .insert({
        original_id: proposal.id,
        namespace: proposal.namespace,
        state: proposal.state,
        proposal_id: proposal.proposal_id,
        user_id: proposal.user_id,
        archived_at: new Date().toISOString(),
      });

    if (archiveError) {
      console.error(`Failed to archive proposal ${proposal.id}:`, archiveError);
      return false;
    }

    // Mark as archived in original table
    const { error: updateError } = await supabase
      .from("proposal_checkpoints")
      .update({ archived: true })
      .eq("id", proposal.id);

    if (updateError) {
      console.error(
        `Failed to mark proposal ${proposal.id} as archived:`,
        updateError
      );
      return false;
    }

    return true;
  });

  const results = await Promise.all(archivePromises);
  const successCount = results.filter(Boolean).length;

  return {
    success: true,
    totalCount: proposalsToArchive.length,
    successCount,
    failureCount: proposalsToArchive.length - successCount,
  };
}
```

## User Controls

Provide users with controls to manage their data:

```typescript
async function exportUserProposals(userId: string) {
  const proposalManager = new ProposalManager({
    /* config */
  });
  const userProposals = await proposalManager.listUserProposals(userId);

  return userProposals.map((proposal) => ({
    id: proposal.id,
    title: proposal.title,
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
    status: proposal.status,
    data: proposal.data,
  }));
}

async function deleteProposalData(userId: string, proposalId: string) {
  const proposalManager = new ProposalManager({
    /* config */
  });

  // Verify ownership
  const proposal = await proposalManager.getProposal(proposalId);
  if (!proposal || proposal.metadata.userId !== userId) {
    throw new Error("Unauthorized or proposal not found");
  }

  return await proposalManager.deleteProposal(proposalId);
}
```

## Compliance and Privacy

Ensure all retention policies comply with applicable regulations:

1. **GDPR Compliance**: Implement "right to be forgotten" through user data deletion APIs
2. **Data Minimization**: Only store necessary checkpoint data
3. **Purpose Limitation**: Use data only for its intended purpose
4. **Storage Limitation**: Apply appropriate retention periods

## Monitoring and Reporting

Implement monitoring for data retention operations:

```typescript
async function generateRetentionReport(supabase: SupabaseClient) {
  const now = new Date();

  // Count data by category
  const { data: counts, error: countError } = await supabase.rpc(
    "get_data_retention_counts"
  );

  if (countError) {
    console.error("Error generating retention report:", countError);
    return { success: false, error: countError };
  }

  // Get storage usage
  const { data: usage, error: usageError } = await supabase.rpc(
    "get_table_size",
    { table_name: "proposal_checkpoints" }
  );

  if (usageError) {
    console.error("Error getting storage usage:", usageError);
  }

  return {
    success: true,
    generatedAt: now.toISOString(),
    counts,
    storageUsage: usage,
  };
}
```

## Conclusion

Implementing proper data retention policies helps maintain system performance, reduce costs, and ensure compliance with privacy regulations. Regular review of these policies is recommended as application usage patterns evolve.
