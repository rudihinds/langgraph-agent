/**
 * Data Retention Utilities
 *
 * This module provides utilities for implementing data retention policies
 * for the Proposal Agent System. It includes functions for cleaning up
 * abandoned proposals, archiving completed proposals, managing session data,
 * and handling user data deletion requests in compliance with regulations.
 */

import { SupabaseConnectionPool } from "../checkpoint/supabaseClient";

/**
 * Gets a Supabase client from the connection pool
 */
function getSupabaseClient() {
  const pool = SupabaseConnectionPool.getInstance({
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseKey: process.env.SUPABASE_SERVICE_KEY!,
  });

  return pool.getClient();
}

/**
 * Cleanup abandoned proposals
 * Deletes proposals with no activity for 180+ days with an 'abandoned' status
 *
 * @returns {Promise<boolean>} True if cleanup succeeded, false otherwise
 */
export async function cleanupAbandonedProposals(): Promise<boolean> {
  const supabaseClient = getSupabaseClient();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 180);

  const { data, error } = await supabaseClient
    .from("proposal_checkpoints")
    .delete()
    .lt("updated_at", cutoffDate.toISOString())
    .eq("metadata->status", "abandoned");

  if (error) {
    console.error("Abandoned proposal cleanup failed:", error);
    return false;
  }

  console.log(`Deleted ${data?.length || 0} abandoned proposals`);

  // Log this retention action
  await logRetentionAction("cleanup_abandoned", {
    count: data?.length || 0,
    cutoff_date: cutoffDate.toISOString(),
  });

  return true;
}

/**
 * Archive completed proposals
 * Archives proposals completed 365+ days ago to the proposal_archives table
 * and removes them from the active proposal_checkpoints table
 *
 * @returns {Promise<boolean>} True if archiving succeeded, false otherwise
 */
export async function archiveCompletedProposals(): Promise<boolean> {
  const supabaseClient = getSupabaseClient();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 365);

  // Select proposals to archive
  const { data: completedProposals, error } = await supabaseClient
    .from("proposal_checkpoints")
    .select("id, proposal_id, namespace, state")
    .lt("updated_at", cutoffDate.toISOString())
    .eq("metadata->status", "completed");

  if (error || !completedProposals) {
    console.error("Proposal selection for archiving failed:", error);
    return false;
  }

  // Archive the proposals
  if (completedProposals.length > 0) {
    const { error: archiveError } = await supabaseClient
      .from("proposal_archives")
      .insert(
        completedProposals.map((p) => ({
          proposal_id: p.proposal_id,
          namespace: p.namespace,
          state: p.state,
          archived_at: new Date().toISOString(),
        }))
      );

    if (archiveError) {
      console.error("Proposal archiving failed:", archiveError);
      return false;
    }

    // Delete the archived proposals
    const proposalIds = completedProposals.map((p) => p.id);
    const { error: deleteError } = await supabaseClient
      .from("proposal_checkpoints")
      .delete()
      .in("id", proposalIds);

    if (deleteError) {
      console.error("Proposal deletion after archiving failed:", deleteError);
      return false;
    }

    console.log(`Archived ${completedProposals.length} completed proposals`);

    // Log this retention action
    await logRetentionAction("archive_completed", {
      count: completedProposals.length,
      cutoff_date: cutoffDate.toISOString(),
      proposal_ids: completedProposals.map((p) => p.proposal_id),
    });
  } else {
    console.log("No completed proposals to archive");
  }

  return true;
}

/**
 * Clean up expired sessions
 * Removes session data based on retention policies:
 * - Paused sessions: 30 days after being paused
 * - Completed/error sessions: 90 days after completion/error
 *
 * @returns {Promise<boolean>} True if cleanup succeeded, false otherwise
 */
export async function cleanupExpiredSessions(): Promise<boolean> {
  const supabaseClient = getSupabaseClient();
  let cleanedSessions = 0;

  try {
    // Paused sessions older than 30 days
    const pausedCutoff = new Date();
    pausedCutoff.setDate(pausedCutoff.getDate() - 30);

    // Find expired paused sessions
    const { data: pausedSessions, error: pausedError } = await supabaseClient
      .from("proposal_checkpoints")
      .select("namespace")
      .lt("updated_at", pausedCutoff.toISOString())
      .like("namespace", "proposal_sessions:%")
      .eq("state->state", "paused");

    if (pausedError) {
      console.error("Paused session query failed:", pausedError);
    } else if (pausedSessions && pausedSessions.length > 0) {
      // Delete expired paused sessions
      const namespaces = pausedSessions.map((s) => s.namespace);
      const { error: deleteError } = await supabaseClient
        .from("proposal_checkpoints")
        .delete()
        .in("namespace", namespaces);

      if (deleteError) {
        console.error("Paused session cleanup failed:", deleteError);
      } else {
        console.log(`Deleted ${namespaces.length} expired paused sessions`);
        cleanedSessions += namespaces.length;

        // Log this retention action
        await logRetentionAction("cleanup_paused_sessions", {
          count: namespaces.length,
          cutoff_date: pausedCutoff.toISOString(),
        });
      }
    }

    // Completed sessions older than 90 days
    const completedCutoff = new Date();
    completedCutoff.setDate(completedCutoff.getDate() - 90);

    // Find and delete expired completed/error sessions
    const { data: completedSessionsData, error: completedError } =
      await supabaseClient
        .from("proposal_checkpoints")
        .delete()
        .lt("updated_at", completedCutoff.toISOString())
        .like("namespace", "proposal_sessions:%")
        .or("state->state.eq.completed,state->state.eq.error")
        .select("namespace");

    if (completedError) {
      console.error("Completed session cleanup failed:", completedError);
      return false;
    }

    if (completedSessionsData && completedSessionsData.length > 0) {
      console.log(
        `Deleted ${completedSessionsData.length} expired completed/error sessions`
      );
      cleanedSessions += completedSessionsData.length;

      // Log this retention action
      await logRetentionAction("cleanup_completed_sessions", {
        count: completedSessionsData.length,
        cutoff_date: completedCutoff.toISOString(),
      });
    }

    return true;
  } catch (err) {
    console.error("Error in session cleanup:", err);
    return false;
  }
}

/**
 * Clean up activity logs
 * Removes activity logs based on retention policies:
 * - Standard activity: 90 days
 * - Security activity: 365 days
 *
 * @returns {Promise<boolean>} True if cleanup succeeded, false otherwise
 */
export async function cleanupActivityLogs(): Promise<boolean> {
  const supabaseClient = getSupabaseClient();
  let totalCleaned = 0;

  try {
    const standardCutoff = new Date();
    standardCutoff.setDate(standardCutoff.getDate() - 90);

    const securityCutoff = new Date();
    securityCutoff.setDate(securityCutoff.getDate() - 365);

    // Delete standard activity logs
    const { data: standardData, error: standardError } = await supabaseClient
      .from("activity_logs")
      .delete()
      .lt("timestamp", standardCutoff.toISOString())
      .not("activity_type", "in", [
        "security_event",
        "authentication",
        "authorization",
      ])
      .select("id");

    if (standardError) {
      console.error("Standard activity log cleanup failed:", standardError);
    } else if (standardData) {
      console.log(`Deleted ${standardData.length} standard activity logs`);
      totalCleaned += standardData.length;

      // Log this retention action
      await logRetentionAction("cleanup_standard_activity", {
        count: standardData.length,
        cutoff_date: standardCutoff.toISOString(),
      });
    }

    // Delete old security logs
    const { data: securityData, error: securityError } = await supabaseClient
      .from("activity_logs")
      .delete()
      .lt("timestamp", securityCutoff.toISOString())
      .in("activity_type", [
        "security_event",
        "authentication",
        "authorization",
      ])
      .select("id");

    if (securityError) {
      console.error("Security activity log cleanup failed:", securityError);
      return false;
    } else if (securityData) {
      console.log(`Deleted ${securityData.length} security activity logs`);
      totalCleaned += securityData.length;

      // Log this retention action
      await logRetentionAction("cleanup_security_activity", {
        count: securityData.length,
        cutoff_date: securityCutoff.toISOString(),
      });
    }

    return true;
  } catch (err) {
    console.error("Error in activity log cleanup:", err);
    return false;
  }
}

/**
 * Clean up error logs
 * Removes error logs based on retention policies:
 * - Standard errors: 30 days
 * - Security errors: 180 days
 * - Critical errors: 365 days
 *
 * @returns {Promise<boolean>} True if cleanup succeeded, false otherwise
 */
export async function cleanupErrorLogs(): Promise<boolean> {
  const supabaseClient = getSupabaseClient();
  let totalCleaned = 0;

  try {
    const standardCutoff = new Date();
    standardCutoff.setDate(standardCutoff.getDate() - 30);

    const securityCutoff = new Date();
    securityCutoff.setDate(securityCutoff.getDate() - 180);

    const criticalCutoff = new Date();
    criticalCutoff.setDate(criticalCutoff.getDate() - 365);

    // Delete standard error logs
    const { data: standardData, error: standardError } = await supabaseClient
      .from("error_logs")
      .delete()
      .lt("timestamp", standardCutoff.toISOString())
      .eq("severity", "standard")
      .select("id");

    if (standardError) {
      console.error("Standard error log cleanup failed:", standardError);
    } else if (standardData) {
      console.log(`Deleted ${standardData.length} standard error logs`);
      totalCleaned += standardData.length;

      // Log this retention action
      await logRetentionAction("cleanup_standard_errors", {
        count: standardData.length,
        cutoff_date: standardCutoff.toISOString(),
      });
    }

    // Delete security error logs
    const { data: securityData, error: securityError } = await supabaseClient
      .from("error_logs")
      .delete()
      .lt("timestamp", securityCutoff.toISOString())
      .eq("severity", "security")
      .select("id");

    if (securityError) {
      console.error("Security error log cleanup failed:", securityError);
    } else if (securityData) {
      console.log(`Deleted ${securityData.length} security error logs`);
      totalCleaned += securityData.length;

      // Log this retention action
      await logRetentionAction("cleanup_security_errors", {
        count: securityData.length,
        cutoff_date: securityCutoff.toISOString(),
      });
    }

    // Delete critical error logs
    const { data: criticalData, error: criticalError } = await supabaseClient
      .from("error_logs")
      .delete()
      .lt("timestamp", criticalCutoff.toISOString())
      .eq("severity", "critical")
      .select("id");

    if (criticalError) {
      console.error("Critical error log cleanup failed:", criticalError);
      return false;
    } else if (criticalData) {
      console.log(`Deleted ${criticalData.length} critical error logs`);
      totalCleaned += criticalData.length;

      // Log this retention action
      await logRetentionAction("cleanup_critical_errors", {
        count: criticalData.length,
        cutoff_date: criticalCutoff.toISOString(),
      });
    }

    return true;
  } catch (err) {
    console.error("Error in error log cleanup:", err);
    return false;
  }
}

/**
 * Place a legal hold on proposal data
 * Prevents automatic deletion of data that is subject to legal proceedings
 *
 * @param {string} proposalId - The ID of the proposal to place on hold
 * @param {string} reason - The reason for the legal hold
 * @returns {Promise<boolean>} True if hold placement succeeded, false otherwise
 */
export async function placeLegalHold(
  proposalId: string,
  reason: string
): Promise<boolean> {
  const supabaseClient = getSupabaseClient();

  try {
    // Record the legal hold
    const { error } = await supabaseClient.from("legal_holds").insert({
      proposal_id: proposalId,
      reason,
      created_at: new Date().toISOString(),
      created_by: "admin", // Should be the actual admin user ID
    });

    if (error) {
      console.error("Failed to place legal hold:", error);
      return false;
    }

    // Update the proposal to mark it as being on hold
    const { error: updateError } = await supabaseClient
      .from("proposal_checkpoints")
      .update({
        metadata: {
          on_legal_hold: true,
          legal_hold_reason: reason,
        },
      })
      .eq("proposal_id", proposalId);

    if (updateError) {
      console.error(
        "Failed to update proposal with legal hold status:",
        updateError
      );
      return false;
    }

    console.log(`Legal hold placed on proposal ${proposalId}`);

    // Log this action
    await logRetentionAction("place_legal_hold", {
      proposal_id: proposalId,
      reason,
    });

    return true;
  } catch (err) {
    console.error("Error placing legal hold:", err);
    return false;
  }
}

/**
 * Delete user data
 * Removes all data associated with a specific user ID
 * Used for GDPR compliance and "right to be forgotten" requests
 *
 * @param {string} userId - The ID of the user whose data should be deleted
 * @returns {Promise<boolean>} True if deletion succeeded, false otherwise
 */
export async function deleteUserData(userId: string): Promise<boolean> {
  const supabaseClient = getSupabaseClient();

  try {
    // Delete all proposal checkpoints owned by the user
    const { error: checkpointError } = await supabaseClient
      .from("proposal_checkpoints")
      .delete()
      .eq("user_id", userId);

    if (checkpointError) {
      console.error("Failed to delete user checkpoints:", checkpointError);
      return false;
    }

    // Delete all sessions owned by the user
    const { error: sessionError } = await supabaseClient
      .from("proposal_checkpoints")
      .delete()
      .like("namespace", "proposal_sessions:%")
      .eq("state->userId", userId);

    if (sessionError) {
      console.error("Failed to delete user sessions:", sessionError);
      return false;
    }

    // Delete user activity logs
    const { error: activityError } = await supabaseClient
      .from("activity_logs")
      .delete()
      .eq("user_id", userId);

    if (activityError) {
      console.error("Failed to delete user activity logs:", activityError);
      return false;
    }

    console.log(`Data deleted for user ${userId}`);

    // Log this action
    await logRetentionAction("delete_user_data", {
      user_id: userId,
      timestamp: new Date().toISOString(),
    });

    return true;
  } catch (err) {
    console.error("Error deleting user data:", err);
    return false;
  }
}

/**
 * Log retention actions to the audit log
 * Creates a record of all data deletion or archiving activities
 *
 * @param {string} action - The type of retention action performed
 * @param {Record<string, any>} details - Details about the action
 * @returns {Promise<boolean>} True if logging succeeded, false otherwise
 */
export async function logRetentionAction(
  action: string,
  details: Record<string, any>
): Promise<boolean> {
  const supabaseClient = getSupabaseClient();

  try {
    const { error } = await supabaseClient.from("retention_audit_logs").insert({
      action,
      details,
      timestamp: new Date().toISOString(),
      performed_by: "system", // Or admin user ID for manual actions
    });

    if (error) {
      console.error("Failed to log retention action:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Error logging retention action:", err);
    return false;
  }
}

/**
 * Generate a retention report for a specified time period
 * Provides summary statistics about data retention activities
 *
 * @param {Date} startDate - The beginning of the reporting period
 * @param {Date} endDate - The end of the reporting period
 * @returns {Promise<Object|null>} The report object or null if generation failed
 */
export async function generateRetentionReport(
  startDate: Date,
  endDate: Date
): Promise<Record<string, any> | null> {
  const supabaseClient = getSupabaseClient();

  try {
    // Query audit logs for the specified period
    const { data, error } = await supabaseClient
      .from("retention_audit_logs")
      .select("*")
      .gte("timestamp", startDate.toISOString())
      .lte("timestamp", endDate.toISOString());

    if (error || !data) {
      console.error("Failed to query retention audit logs:", error);
      return null;
    }

    if (data.length === 0) {
      return {
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        summary: {
          totalActions: 0,
          actionCounts: {},
        },
        details: [],
      };
    }

    // Group actions by type
    const actionCounts = data.reduce((counts: Record<string, number>, log) => {
      const action = log.action;
      counts[action] = (counts[action] || 0) + 1;
      return counts;
    }, {});

    // Calculate summary statistics
    const totalActions = data.length;
    const oldestAction = data.reduce((oldest, log) => {
      return new Date(log.timestamp) < new Date(oldest.timestamp)
        ? log
        : oldest;
    }, data[0]);
    const newestAction = data.reduce((newest, log) => {
      return new Date(log.timestamp) > new Date(newest.timestamp)
        ? log
        : newest;
    }, data[0]);

    return {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      summary: {
        totalActions,
        actionCounts,
        oldest: oldestAction,
        newest: newestAction,
      },
      details: data,
    };
  } catch (err) {
    console.error("Error generating retention report:", err);
    return null;
  }
}
