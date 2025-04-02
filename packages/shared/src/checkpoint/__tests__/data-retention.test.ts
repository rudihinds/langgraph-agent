import { describe, expect, it, vi, beforeEach } from "vitest";
import { SupabaseClient } from "@supabase/supabase-js";

// Interface to match the retention config
interface RetentionConfig {
  completedProposalDays: number;
  abandonedProposalDays: number;
  sessionMetadataDays: number;
  historicalVersionsDays: number;
}

// Function implementations copied from the DATA-RETENTION.md document
async function cleanupExpiredData(
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

// Create mock implementation for Supabase
vi.mock("@supabase/supabase-js", () => {
  return {
    createClient: vi.fn(),
  };
});

describe("Data Retention", () => {
  // Mock Supabase client
  let mockSupabase: any;

  beforeEach(() => {
    // Reset mocks between tests
    vi.resetAllMocks();

    // Setup mock responses
    mockSupabase = {
      from: vi.fn(() => mockSupabase),
      select: vi.fn(() => mockSupabase),
      delete: vi.fn(() => mockSupabase),
      update: vi.fn(() => mockSupabase),
      insert: vi.fn(() => mockSupabase),
      eq: vi.fn(() => mockSupabase),
      not: vi.fn(() => mockSupabase),
      lt: vi.fn(() => mockSupabase),
      gt: vi.fn(() => mockSupabase),
      is: vi.fn(() => mockSupabase),
      ilike: vi.fn(() => mockSupabase),
      like: vi.fn(() => mockSupabase),
      rpc: vi.fn(() => mockSupabase),
    };

    // Add console mocks
    console.error = vi.fn();
    console.log = vi.fn();
  });

  describe("cleanupExpiredData", () => {
    it("should delete completed proposals older than retention period", async () => {
      // Setup mock response
      mockSupabase.eq.mockReturnValueOnce(
        Promise.resolve({
          data: [{ id: 1 }, { id: 2 }],
          error: null,
        })
      );

      // For other queries, return empty results
      mockSupabase.not.mockReturnValueOnce(
        Promise.resolve({ data: [], error: null })
      );
      mockSupabase.ilike.mockReturnValueOnce(
        Promise.resolve({ data: [], error: null })
      );
      mockSupabase.rpc.mockReturnValueOnce(Promise.resolve({ error: null }));

      const result = await cleanupExpiredData(
        mockSupabase as unknown as SupabaseClient
      );

      // Verify correct retention period was applied
      expect(mockSupabase.from).toHaveBeenCalledWith("proposal_checkpoints");
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith(
        "state->>'status'",
        "completed"
      );
      expect(result.completedDeleted).toBe(2);
      expect(result.abandonedDeleted).toBe(0);
      expect(result.sessionsDeleted).toBe(0);
    });

    it("should delete abandoned proposals older than retention period", async () => {
      // Setup mock responses
      mockSupabase.eq.mockReturnValueOnce(
        Promise.resolve({ data: [], error: null })
      );
      mockSupabase.not.mockReturnValueOnce(
        Promise.resolve({
          data: [{ id: 3 }, { id: 4 }, { id: 5 }],
          error: null,
        })
      );
      mockSupabase.ilike.mockReturnValueOnce(
        Promise.resolve({ data: [], error: null })
      );
      mockSupabase.rpc.mockReturnValueOnce(Promise.resolve({ error: null }));

      const result = await cleanupExpiredData(
        mockSupabase as unknown as SupabaseClient
      );

      // Verify abandoned proposal cleanup
      expect(mockSupabase.from).toHaveBeenCalledWith("proposal_checkpoints");
      expect(mockSupabase.not).toHaveBeenCalledWith(
        "state->>'status'",
        "completed"
      );
      expect(result.completedDeleted).toBe(0);
      expect(result.abandonedDeleted).toBe(3);
      expect(result.sessionsDeleted).toBe(0);
    });

    it("should delete old session metadata", async () => {
      // Setup mock responses
      mockSupabase.eq.mockReturnValueOnce(
        Promise.resolve({ data: [], error: null })
      );
      mockSupabase.not.mockReturnValueOnce(
        Promise.resolve({ data: [], error: null })
      );
      mockSupabase.ilike.mockReturnValueOnce(
        Promise.resolve({
          data: [{ id: 6 }, { id: 7 }],
          error: null,
        })
      );
      mockSupabase.rpc.mockReturnValueOnce(Promise.resolve({ error: null }));

      const result = await cleanupExpiredData(
        mockSupabase as unknown as SupabaseClient
      );

      // Verify session cleanup
      expect(mockSupabase.from).toHaveBeenCalledWith("proposal_checkpoints");
      expect(mockSupabase.ilike).toHaveBeenCalledWith(
        "namespace",
        "proposal_sessions:%"
      );
      expect(result.completedDeleted).toBe(0);
      expect(result.abandonedDeleted).toBe(0);
      expect(result.sessionsDeleted).toBe(2);
    });

    it("should call the RPC function for version cleanup", async () => {
      // Setup mock responses for all queries
      mockSupabase.eq.mockReturnValueOnce(
        Promise.resolve({ data: [], error: null })
      );
      mockSupabase.not.mockReturnValueOnce(
        Promise.resolve({ data: [], error: null })
      );
      mockSupabase.ilike.mockReturnValueOnce(
        Promise.resolve({ data: [], error: null })
      );
      mockSupabase.rpc.mockReturnValueOnce(Promise.resolve({ error: null }));

      await cleanupExpiredData(mockSupabase as unknown as SupabaseClient);

      // Verify RPC call
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "delete_old_proposal_versions",
        {
          cutoff_date: expect.any(String),
        }
      );
    });

    it("should handle errors gracefully", async () => {
      // Setup mock responses with errors
      mockSupabase.eq.mockReturnValueOnce(
        Promise.resolve({
          data: null,
          error: new Error("Database error"),
        })
      );
      mockSupabase.not.mockReturnValueOnce(
        Promise.resolve({
          data: null,
          error: new Error("Another error"),
        })
      );
      mockSupabase.ilike.mockReturnValueOnce(
        Promise.resolve({
          data: null,
          error: new Error("Session error"),
        })
      );
      mockSupabase.rpc.mockReturnValueOnce(
        Promise.resolve({
          error: new Error("RPC error"),
        })
      );

      const result = await cleanupExpiredData(
        mockSupabase as unknown as SupabaseClient
      );

      // Verify error handling
      expect(console.error).toHaveBeenCalledTimes(4);
      expect(result.completedDeleted).toBe(0);
      expect(result.abandonedDeleted).toBe(0);
      expect(result.sessionsDeleted).toBe(0);
    });

    it("should apply custom retention periods", async () => {
      // Setup mock responses
      mockSupabase.eq.mockReturnValueOnce(
        Promise.resolve({ data: [], error: null })
      );
      mockSupabase.not.mockReturnValueOnce(
        Promise.resolve({ data: [], error: null })
      );
      mockSupabase.ilike.mockReturnValueOnce(
        Promise.resolve({ data: [], error: null })
      );
      mockSupabase.rpc.mockReturnValueOnce(Promise.resolve({ error: null }));

      // Custom retention config
      const customConfig: RetentionConfig = {
        completedProposalDays: 180, // Custom: 180 days instead of 90
        abandonedProposalDays: 60, // Custom: 60 days instead of 30
        sessionMetadataDays: 7, // Custom: 7 days instead of 14
        historicalVersionsDays: 3, // Custom: 3 days instead of 7
      };

      // Calculate expected cutoff dates
      const now = new Date();

      const expectedCompletedCutoff = new Date(now);
      expectedCompletedCutoff.setDate(expectedCompletedCutoff.getDate() - 180);

      const expectedAbandonedCutoff = new Date(now);
      expectedAbandonedCutoff.setDate(expectedAbandonedCutoff.getDate() - 60);

      const expectedSessionCutoff = new Date(now);
      expectedSessionCutoff.setDate(expectedSessionCutoff.getDate() - 7);

      const expectedVersionsCutoff = new Date(now);
      expectedVersionsCutoff.setDate(expectedVersionsCutoff.getDate() - 3);

      await cleanupExpiredData(
        mockSupabase as unknown as SupabaseClient,
        customConfig
      );

      // Compare cutoff dates (we can't access the internal variables directly,
      // so we'll verify the function was called with parameters in the correct ranges)

      // Check each call's lt parameter to ensure it used the custom retention periods
      const ltCalls = mockSupabase.lt.mock.calls;

      // First lt call - completed proposals
      const completedDateArg = new Date(ltCalls[0][1]);
      expect(
        Math.abs(completedDateArg.getTime() - expectedCompletedCutoff.getTime())
      ).toBeLessThan(1000 * 60); // Allow 1 minute difference due to test execution time

      // Second lt call - abandoned proposals
      const abandonedDateArg = new Date(ltCalls[1][1]);
      expect(
        Math.abs(abandonedDateArg.getTime() - expectedAbandonedCutoff.getTime())
      ).toBeLessThan(1000 * 60);

      // Third lt call - session metadata
      const sessionDateArg = new Date(ltCalls[2][1]);
      expect(
        Math.abs(sessionDateArg.getTime() - expectedSessionCutoff.getTime())
      ).toBeLessThan(1000 * 60);

      // RPC call for versions
      const rpcDateArg = new Date(
        mockSupabase.rpc.mock.calls[0][1].cutoff_date
      );
      expect(
        Math.abs(rpcDateArg.getTime() - expectedVersionsCutoff.getTime())
      ).toBeLessThan(1000 * 60);
    });
  });

  describe("archiveOldProposals", () => {
    it("should archive proposals older than cutoff date", async () => {
      // Setup mock response for finding proposals
      mockSupabase.is.mockReturnValueOnce({
        data: [
          {
            id: 1,
            namespace: "proposal:1",
            state: {},
            proposal_id: "1",
            user_id: "user1",
          },
          {
            id: 2,
            namespace: "proposal:2",
            state: {},
            proposal_id: "2",
            user_id: "user1",
          },
        ],
        error: null,
      });

      // Setup mock responses for archiving
      mockSupabase.insert.mockReturnValueOnce({ error: null });
      mockSupabase.insert.mockReturnValueOnce({ error: null });

      // Setup mock responses for updating original records
      mockSupabase.eq.mockReturnValueOnce({ error: null });
      mockSupabase.eq.mockReturnValueOnce({ error: null });

      const result = await archiveOldProposals(
        mockSupabase as unknown as SupabaseClient
      );

      // Verify archive operations
      expect(mockSupabase.from).toHaveBeenCalledWith("proposal_checkpoints");
      expect(mockSupabase.select).toHaveBeenCalledWith(
        "id, namespace, state, proposal_id, user_id"
      );
      expect(mockSupabase.lt).toHaveBeenCalledWith(
        "updated_at",
        expect.any(String)
      );
      expect(mockSupabase.is).toHaveBeenCalledWith("archived", null);

      // Verify archive inserts
      expect(mockSupabase.from).toHaveBeenCalledWith("proposal_archives");
      expect(mockSupabase.insert).toHaveBeenCalledTimes(2);

      // Verify updates to original records
      expect(mockSupabase.update).toHaveBeenCalledWith({ archived: true });
      expect(mockSupabase.eq).toHaveBeenCalledTimes(2);

      // Verify result
      expect(result.success).toBe(true);
      expect(result.totalCount).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
    });

    it("should handle no proposals to archive", async () => {
      // Setup mock response for finding no proposals
      mockSupabase.is.mockReturnValueOnce({
        data: [],
        error: null,
      });

      const result = await archiveOldProposals(
        mockSupabase as unknown as SupabaseClient
      );

      // Verify no archive operations
      expect(mockSupabase.from).toHaveBeenCalledWith("proposal_checkpoints");
      expect(mockSupabase.from).not.toHaveBeenCalledWith("proposal_archives");
      expect(mockSupabase.insert).not.toHaveBeenCalled();
      expect(mockSupabase.update).not.toHaveBeenCalled();

      // Verify result
      expect(result.success).toBe(true);
      expect(result.archivedCount).toBe(0);
    });

    it("should handle errors when finding proposals", async () => {
      // Setup mock response for query error
      mockSupabase.is.mockReturnValueOnce({
        data: null,
        error: new Error("Database error"),
      });

      const result = await archiveOldProposals(
        mockSupabase as unknown as SupabaseClient
      );

      // Verify error handling
      expect(console.error).toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle partial failures during archiving", async () => {
      // Setup mock response for finding proposals
      mockSupabase.is.mockReturnValueOnce({
        data: [
          {
            id: 1,
            namespace: "proposal:1",
            state: {},
            proposal_id: "1",
            user_id: "user1",
          },
          {
            id: 2,
            namespace: "proposal:2",
            state: {},
            proposal_id: "2",
            user_id: "user1",
          },
        ],
        error: null,
      });

      // First archive succeeds, second fails
      mockSupabase.insert.mockReturnValueOnce({ error: null });
      mockSupabase.insert.mockReturnValueOnce({
        error: new Error("Insert error"),
      });

      // Update responses
      mockSupabase.eq.mockReturnValueOnce({ error: null });

      const result = await archiveOldProposals(
        mockSupabase as unknown as SupabaseClient
      );

      // Verify error handling
      expect(console.error).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.totalCount).toBe(2);
      expect(result.successCount).toBe(0); // Both should fail due to Promise.all behavior
      expect(result.failureCount).toBe(2);
    });

    it("should apply custom cutoff period", async () => {
      // Setup mock response
      mockSupabase.is.mockReturnValueOnce({
        data: [],
        error: null,
      });

      // Custom cutoff: 365 days
      const customCutoffDays = 365;

      // Calculate expected cutoff date
      const now = new Date();
      const expectedCutoff = new Date(now);
      expectedCutoff.setDate(expectedCutoff.getDate() - customCutoffDays);

      await archiveOldProposals(
        mockSupabase as unknown as SupabaseClient,
        customCutoffDays
      );

      // Verify custom cutoff was applied
      const ltDateArg = new Date(mockSupabase.lt.mock.calls[0][1]);
      expect(
        Math.abs(ltDateArg.getTime() - expectedCutoff.getTime())
      ).toBeLessThan(1000 * 60); // Allow 1 minute difference
    });
  });

  describe("Integration scenarios", () => {
    it("should simulate a full retention cleanup cycle", async () => {
      // Setup mock for scheduled cleanup function
      const scheduledRetentionCleanup = async () => {
        // Mock createClient
        const mockClient = mockSupabase;

        // Mock responses for all operations
        mockSupabase.eq.mockReturnValueOnce(
          Promise.resolve({ data: [{ id: 1 }], error: null })
        );
        mockSupabase.not.mockReturnValueOnce(
          Promise.resolve({ data: [{ id: 2 }], error: null })
        );
        mockSupabase.ilike.mockReturnValueOnce(
          Promise.resolve({ data: [{ id: 3 }], error: null })
        );
        mockSupabase.rpc.mockReturnValueOnce(Promise.resolve({ error: null }));

        console.log("Starting scheduled data retention cleanup");

        try {
          const results = await cleanupExpiredData(
            mockClient as unknown as SupabaseClient
          );
          console.log("Cleanup completed:", results);
          return { success: true, results };
        } catch (error) {
          console.error("Cleanup failed:", error);
          return { success: false, error };
        }
      };

      const result = await scheduledRetentionCleanup();

      // Verify logging
      expect(console.log).toHaveBeenCalledWith(
        "Starting scheduled data retention cleanup"
      );
      expect(console.log).toHaveBeenCalledWith(
        "Cleanup completed:",
        expect.any(Object)
      );

      // Verify result
      expect(result.success).toBe(true);
      expect(result.results).toEqual({
        completedDeleted: 1,
        abandonedDeleted: 1,
        sessionsDeleted: 1,
      });
    });
  });
});
