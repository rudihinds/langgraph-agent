import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SupabaseConnectionPool } from "../../src/checkpoint/supabaseClient";
import {
  cleanupAbandonedProposals,
  archiveCompletedProposals,
  cleanupExpiredSessions,
  cleanupActivityLogs,
  cleanupErrorLogs,
  placeLegalHold,
  deleteUserData,
  logRetentionAction,
  generateRetentionReport,
} from "../../src/retention/dataRetention";

// Mock the Supabase client
vi.mock("../../src/checkpoint/supabaseClient", () => {
  // Create mock functions
  const mockDeleteFn = vi.fn().mockReturnThis();
  const mockInsertFn = vi.fn().mockReturnThis();
  const mockUpdateFn = vi.fn().mockReturnThis();
  const mockSelectFn = vi.fn().mockReturnThis();
  const mockLikeFn = vi.fn().mockReturnThis();
  const mockEqFn = vi.fn().mockReturnThis();
  const mockLtFn = vi.fn().mockReturnThis();
  const mockGteFn = vi.fn().mockReturnThis();
  const mockLteFn = vi.fn().mockReturnThis();
  const mockInFn = vi.fn().mockReturnThis();
  const mockNotFn = vi.fn().mockReturnThis();
  const mockOrFn = vi.fn().mockReturnThis();

  // Create mock Supabase client with chaining methods
  const mockSupabaseClient = {
    from: vi.fn().mockImplementation(() => ({
      delete: mockDeleteFn,
      insert: mockInsertFn,
      update: mockUpdateFn,
      select: mockSelectFn,
    })),
  };

  // Setup chain for delete operations
  mockDeleteFn.mockImplementation(() => ({
    lt: mockLtFn,
    like: mockLikeFn,
    eq: mockEqFn,
    in: mockInFn,
    select: mockSelectFn,
  }));

  // Setup chain for select operations
  mockSelectFn.mockImplementation(() => ({
    lt: mockLtFn,
    like: mockLikeFn,
    eq: mockEqFn,
    in: mockInFn,
    gte: mockGteFn,
    lte: mockLteFn,
    not: mockNotFn,
    or: mockOrFn,
  }));

  // Setup chain for update operations
  mockUpdateFn.mockImplementation(() => ({
    eq: mockEqFn,
  }));

  // Setup chain for additional operations
  mockLtFn.mockImplementation(() => ({
    like: mockLikeFn,
    eq: mockEqFn,
    not: mockNotFn,
  }));

  mockLikeFn.mockImplementation(() => ({
    eq: mockEqFn,
    or: mockOrFn,
  }));

  mockGteFn.mockImplementation(() => ({
    lte: mockLteFn,
  }));

  mockNotFn.mockImplementation(() => ({
    in: mockInFn,
  }));

  // Return the mock pool
  return {
    SupabaseConnectionPool: {
      getInstance: vi.fn().mockReturnValue({
        getClient: vi.fn().mockReturnValue(mockSupabaseClient),
        releaseClient: vi.fn(),
      }),
    },
  };
});

describe("Data Retention Functions", () => {
  let supabaseClient: any;

  beforeEach(() => {
    vi.resetAllMocks();

    // Get a fresh reference to the mocked client
    supabaseClient = SupabaseConnectionPool.getInstance({
      supabaseUrl: "test-url",
      supabaseKey: "test-key",
    }).getClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("cleanupAbandonedProposals", () => {
    it("should delete abandoned proposals older than 180 days", async () => {
      // Setup successful response
      const fromSpy = supabaseClient.from;
      const deleteSpy = fromSpy().delete;
      const ltSpy = deleteSpy.lt;
      const eqSpy = ltSpy().eq;

      eqSpy.mockReturnValueOnce({ data: [{ id: 1 }, { id: 2 }], error: null });

      // Mock the logRetentionAction to avoid dependencies
      vi.mock(
        "../../src/retention/dataRetention",
        async (importOriginal) => {
          const mod =
            await importOriginal<
              typeof import("../../src/retention/dataRetention")
            >();
          return {
            ...mod,
            logRetentionAction: vi.fn().mockResolvedValue(true),
          };
        },
        { partial: true }
      );

      const result = await cleanupAbandonedProposals();

      expect(fromSpy).toHaveBeenCalledWith("proposal_checkpoints");
      expect(deleteSpy).toHaveBeenCalled();
      expect(ltSpy).toHaveBeenCalled();
      expect(eqSpy).toHaveBeenCalledWith("metadata->status", "abandoned");
      expect(result).toBe(true);
    });

    it("should handle errors during cleanup", async () => {
      // Setup error response
      const fromSpy = supabaseClient.from;
      const deleteSpy = fromSpy().delete;
      const ltSpy = deleteSpy.lt;
      const eqSpy = ltSpy().eq;

      eqSpy.mockReturnValueOnce({
        data: null,
        error: new Error("Database error"),
      });

      const result = await cleanupAbandonedProposals();

      expect(result).toBe(false);
    });
  });

  describe("archiveCompletedProposals", () => {
    it("should archive and delete completed proposals older than 365 days", async () => {
      // Mock the select query returning proposals to archive
      const fromSpy = supabaseClient.from;
      const selectSpy = fromSpy().select;
      const ltSpy = selectSpy.lt;
      const eqSpy = ltSpy().eq;

      eqSpy.mockReturnValueOnce({
        data: [
          { id: 1, proposal_id: "p1", namespace: "n1", state: {} },
          { id: 2, proposal_id: "p2", namespace: "n2", state: {} },
        ],
        error: null,
      });

      // Mock the insert operation for archiving
      const insertSpy = fromSpy().insert;
      insertSpy.mockReturnValueOnce({ error: null });

      // Mock the delete operation for removing archived proposals
      const deleteSpy = fromSpy().delete;
      const inSpy = deleteSpy.in;
      inSpy.mockReturnValueOnce({ error: null });

      // Mock the logRetentionAction
      vi.mock(
        "../../src/retention/dataRetention",
        async (importOriginal) => {
          const mod =
            await importOriginal<
              typeof import("../../src/retention/dataRetention")
            >();
          return {
            ...mod,
            logRetentionAction: vi.fn().mockResolvedValue(true),
          };
        },
        { partial: true }
      );

      const result = await archiveCompletedProposals();

      expect(fromSpy).toHaveBeenCalledWith("proposal_checkpoints");
      expect(fromSpy).toHaveBeenCalledWith("proposal_archives");
      expect(selectSpy).toHaveBeenCalledWith(
        "id, proposal_id, namespace, state"
      );
      expect(insertSpy).toHaveBeenCalled();
      expect(inSpy).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should handle errors during archiving", async () => {
      // Mock the select query with error
      const fromSpy = supabaseClient.from;
      const selectSpy = fromSpy().select;
      const ltSpy = selectSpy.lt;
      const eqSpy = ltSpy().eq;

      eqSpy.mockReturnValueOnce({
        data: null,
        error: new Error("Database error"),
      });

      const result = await archiveCompletedProposals();

      expect(result).toBe(false);
    });
  });

  describe("cleanupExpiredSessions", () => {
    it("should delete paused sessions older than 30 days", async () => {
      // Mock finding paused sessions
      const fromSpy = supabaseClient.from;
      const selectSpy = fromSpy().select;
      const ltSpy = selectSpy.lt;
      const likeSpy = ltSpy().like;
      const eqSpy = likeSpy().eq;

      eqSpy.mockReturnValueOnce({
        data: [
          { namespace: "proposal_sessions:s1" },
          { namespace: "proposal_sessions:s2" },
        ],
        error: null,
      });

      // Mock deleting paused sessions
      const deleteSpy = fromSpy().delete;
      const inSpy = deleteSpy.in;
      inSpy.mockReturnValueOnce({ error: null });

      // Mock deleting completed/error sessions
      const ltSpy2 = deleteSpy.lt;
      const likeSpy2 = ltSpy2().like;
      const orSpy = likeSpy2().or;
      orSpy.mockReturnValueOnce({
        data: [{ namespace: "proposal_sessions:s3" }],
        error: null,
      });

      // Mock the logRetentionAction
      vi.mock(
        "../../src/retention/dataRetention",
        async (importOriginal) => {
          const mod =
            await importOriginal<
              typeof import("../../src/retention/dataRetention")
            >();
          return {
            ...mod,
            logRetentionAction: vi.fn().mockResolvedValue(true),
          };
        },
        { partial: true }
      );

      const result = await cleanupExpiredSessions();

      expect(fromSpy).toHaveBeenCalledWith("proposal_checkpoints");
      expect(result).toBe(true);
    });

    it("should handle errors during session cleanup", async () => {
      // Mock deleting completed/error sessions with error
      const fromSpy = supabaseClient.from;
      const selectSpy = fromSpy().select;
      const ltSpy = selectSpy.lt;
      const likeSpy = ltSpy().like;
      const eqSpy = likeSpy().eq;

      eqSpy.mockReturnValueOnce({
        data: [],
        error: null,
      });

      // Mock error in second operation
      const deleteSpy = fromSpy().delete;
      const ltSpy2 = deleteSpy.lt;
      const likeSpy2 = ltSpy2().like;
      const orSpy = likeSpy2().or;
      orSpy.mockReturnValueOnce({ error: new Error("Database error") });

      const result = await cleanupExpiredSessions();

      expect(result).toBe(false);
    });
  });

  describe("placeLegalHold", () => {
    it("should place a legal hold on a proposal", async () => {
      // Mock insert into legal_holds
      const fromSpy = supabaseClient.from;
      const insertSpy = fromSpy().insert;
      insertSpy.mockReturnValueOnce({ error: null });

      // Mock update proposal with legal hold status
      const updateSpy = fromSpy().update;
      const eqSpy = updateSpy().eq;
      eqSpy.mockReturnValueOnce({ error: null });

      // Mock the logRetentionAction
      vi.mock(
        "../../src/retention/dataRetention",
        async (importOriginal) => {
          const mod =
            await importOriginal<
              typeof import("../../src/retention/dataRetention")
            >();
          return {
            ...mod,
            logRetentionAction: vi.fn().mockResolvedValue(true),
          };
        },
        { partial: true }
      );

      const result = await placeLegalHold("p1", "Legal investigation");

      expect(fromSpy).toHaveBeenCalledWith("legal_holds");
      expect(fromSpy).toHaveBeenCalledWith("proposal_checkpoints");
      expect(insertSpy).toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalledWith({
        metadata: {
          on_legal_hold: true,
          legal_hold_reason: "Legal investigation",
        },
      });
      expect(eqSpy).toHaveBeenCalledWith("proposal_id", "p1");
      expect(result).toBe(true);
    });

    it("should handle errors during legal hold placement", async () => {
      // Mock insert error
      const fromSpy = supabaseClient.from;
      const insertSpy = fromSpy().insert;
      insertSpy.mockReturnValueOnce({ error: new Error("Database error") });

      const result = await placeLegalHold("p1", "Legal investigation");

      expect(result).toBe(false);
    });
  });

  describe("deleteUserData", () => {
    it("should delete all user data when requested", async () => {
      // Setup mock returns for all delete operations
      const fromSpy = supabaseClient.from;
      const deleteSpy = fromSpy().delete;
      const eqSpy = deleteSpy.eq;
      const likeSpy = deleteSpy.like;

      // Mock first delete operation
      eqSpy.mockReturnValueOnce({ error: null });

      // Mock second delete operation
      const eqSpy2 = likeSpy().eq;
      eqSpy2.mockReturnValueOnce({ error: null });

      // Mock third delete operation
      eqSpy.mockReturnValueOnce({ error: null });

      // Mock the logRetentionAction
      vi.mock(
        "../../src/retention/dataRetention",
        async (importOriginal) => {
          const mod =
            await importOriginal<
              typeof import("../../src/retention/dataRetention")
            >();
          return {
            ...mod,
            logRetentionAction: vi.fn().mockResolvedValue(true),
          };
        },
        { partial: true }
      );

      const result = await deleteUserData("user123");

      expect(fromSpy).toHaveBeenCalledWith("proposal_checkpoints");
      expect(fromSpy).toHaveBeenCalledWith("activity_logs");
      expect(result).toBe(true);
    });

    it("should handle errors during user data deletion", async () => {
      // Mock delete error
      const fromSpy = supabaseClient.from;
      const deleteSpy = fromSpy().delete;
      const eqSpy = deleteSpy.eq;

      eqSpy.mockReturnValueOnce({ error: new Error("Database error") });

      const result = await deleteUserData("user123");

      expect(result).toBe(false);
    });
  });

  describe("logRetentionAction", () => {
    it("should log retention actions successfully", async () => {
      // Mock insert for action logging
      const fromSpy = supabaseClient.from;
      const insertSpy = fromSpy().insert;
      insertSpy.mockReturnValueOnce({ error: null });

      const result = await logRetentionAction("delete_expired", {
        count: 5,
        type: "sessions",
      });

      expect(fromSpy).toHaveBeenCalledWith("retention_audit_logs");
      expect(insertSpy).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should handle errors during action logging", async () => {
      // Mock insert error
      const fromSpy = supabaseClient.from;
      const insertSpy = fromSpy().insert;
      insertSpy.mockReturnValueOnce({ error: new Error("Database error") });

      const result = await logRetentionAction("delete_expired", {
        count: 5,
        type: "sessions",
      });

      expect(result).toBe(false);
    });
  });

  describe("generateRetentionReport", () => {
    it("should generate a retention report for a specified period", async () => {
      // Mock select for report generation
      const fromSpy = supabaseClient.from;
      const selectSpy = fromSpy().select;
      const gteSpy = selectSpy.gte;
      const lteSpy = gteSpy().lte;

      lteSpy.mockReturnValueOnce({
        data: [
          { action: "delete_expired", timestamp: "2023-01-01T00:00:00Z" },
          { action: "delete_expired", timestamp: "2023-01-02T00:00:00Z" },
          { action: "archive", timestamp: "2023-01-03T00:00:00Z" },
        ],
        error: null,
      });

      const startDate = new Date("2023-01-01");
      const endDate = new Date("2023-01-31");
      const report = await generateRetentionReport(startDate, endDate);

      expect(fromSpy).toHaveBeenCalledWith("retention_audit_logs");
      expect(selectSpy).toHaveBeenCalledWith("*");
      expect(gteSpy).toHaveBeenCalledWith("timestamp", startDate.toISOString());
      expect(lteSpy).toHaveBeenCalledWith("timestamp", endDate.toISOString());

      expect(report).toMatchObject({
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        summary: {
          totalActions: 3,
          actionCounts: {
            delete_expired: 2,
            archive: 1,
          },
        },
      });
      expect(report?.details).toHaveLength(3);
    });

    it("should handle errors during report generation", async () => {
      // Mock select error
      const fromSpy = supabaseClient.from;
      const selectSpy = fromSpy().select;
      const gteSpy = selectSpy.gte;
      const lteSpy = gteSpy().lte;

      lteSpy.mockReturnValueOnce({
        data: null,
        error: new Error("Database error"),
      });

      const startDate = new Date("2023-01-01");
      const endDate = new Date("2023-01-31");
      const report = await generateRetentionReport(startDate, endDate);

      expect(report).toBeNull();
    });
  });
});
