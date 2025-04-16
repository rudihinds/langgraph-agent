/**
 * Simple tests for SupabaseCheckpointer class
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SupabaseCheckpointer } from "../supabase-checkpointer.js";
import { createClient } from "@supabase/supabase-js";
import { CheckpointMetadata } from "@langchain/langgraph";

// Mock the Supabase client creation
vi.mock("@supabase/supabase-js", () => {
  const mockFrom = vi.fn().mockReturnThis();
  const mockSelect = vi.fn().mockReturnThis();
  const mockEq = vi.fn().mockReturnThis();
  const mockSingle = vi.fn().mockReturnThis();
  const mockUpsert = vi.fn().mockReturnThis();
  const mockDelete = vi.fn().mockReturnThis();

  return {
    createClient: vi.fn(() => ({
      from: mockFrom,
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
      upsert: mockUpsert,
      delete: mockDelete,
    })),
  };
});

// Mock the withRetry function
vi.mock("../../utils/backoff.js", () => ({
  withRetry: vi.fn((fn) => fn()),
}));

describe("SupabaseCheckpointer", () => {
  let checkpointer: SupabaseCheckpointer;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSupabaseClient: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockUserIdGetter: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockProposalIdGetter: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockUserIdGetter = vi.fn().mockResolvedValue("test-user-id");
    mockProposalIdGetter = vi.fn().mockResolvedValue("test-proposal-id");

    checkpointer = new SupabaseCheckpointer({
      supabaseUrl: "https://example.supabase.co",
      supabaseKey: "test-key",
      userIdGetter: mockUserIdGetter,
      proposalIdGetter: mockProposalIdGetter,
    });

    // Access the client for assertions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockSupabaseClient = (createClient as any).mock.results[0].value;
  });

  it("should generate a valid thread ID with the correct format", () => {
    const proposalId = "test-proposal-123";
    const threadId = checkpointer.generateThreadId(proposalId, "test");

    // The threadId should be in the format: componentName_proposalId_timestamp
    expect(threadId).toMatch(new RegExp(`^test_${proposalId}_\\d+$`));
  });

  it("should generate a thread ID with default component name when not provided", () => {
    const proposalId = "test-proposal-123";
    const threadId = checkpointer.generateThreadId(proposalId);

    // The default component name is 'proposal'
    expect(threadId).toMatch(new RegExp(`^proposal_${proposalId}_\\d+$`));
  });

  it("should create an instance with default parameters", () => {
    const checkpointer = new SupabaseCheckpointer({
      supabaseUrl: "https://example.supabase.co",
      supabaseKey: "test-key",
    });

    expect(checkpointer).toBeInstanceOf(SupabaseCheckpointer);
  });

  it("should use custom table names when provided", () => {
    const checkpointer = new SupabaseCheckpointer({
      supabaseUrl: "https://example.supabase.co",
      supabaseKey: "test-key",
      tableName: "custom_checkpoints",
      sessionTableName: "custom_sessions",
    });

    expect(checkpointer).toBeInstanceOf(SupabaseCheckpointer);
  });

  describe("get method", () => {
    it("should return undefined when no thread_id is provided", async () => {
      const result = await checkpointer.get({});
      expect(result).toBeUndefined();
    });

    it("should call Supabase with correct parameters and return parsed checkpoint", async () => {
      const mockCheckpointData = {
        state: { value: "test-state" },
        ts: new Date().toISOString(),
      };
      // Mock successful response
      mockSupabaseClient.single.mockResolvedValue({
        data: { checkpoint_data: mockCheckpointData },
        error: null,
      });

      const config = { configurable: { thread_id: "test-thread-id" } };
      const result = await checkpointer.get(config);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "proposal_checkpoints"
      );
      expect(mockSupabaseClient.select).toHaveBeenCalledWith("checkpoint_data");
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith(
        "thread_id",
        "test-thread-id"
      );
      expect(mockSupabaseClient.single).toHaveBeenCalled();
      expect(result).toEqual(mockCheckpointData);
    });

    it("should return undefined if Supabase returns no data", async () => {
      mockSupabaseClient.single.mockResolvedValue({ data: null, error: null });
      const config = { configurable: { thread_id: "test-thread-id" } };
      const result = await checkpointer.get(config);
      expect(result).toBeUndefined();
    });

    it("should log warning and return undefined if Supabase returns error", async () => {
      const consoleSpy = vi.spyOn(console, "warn");
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: new Error("DB Error"),
      });
      const config = { configurable: { thread_id: "test-thread-id" } };
      const result = await checkpointer.get(config);
      expect(result).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error fetching checkpoint"),
        expect.any(Error)
      );
      consoleSpy.mockRestore(); // Restore original console.warn
    });
  });

  describe("put method", () => {
    it("should throw error when no thread_id is provided", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const checkpoint: any = { state: { foo: "bar" } };
      const metadata: CheckpointMetadata = {
        parents: {},
        source: "input",
        step: 1,
        writes: {},
      };

      await expect(
        checkpointer.put({}, checkpoint, metadata, {})
      ).rejects.toThrow("No thread_id provided");
    });

    it("should throw error when user or proposal IDs are not available", async () => {
      mockUserIdGetter.mockResolvedValue(null);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const checkpoint: any = { state: { foo: "bar" } };
      const metadata: CheckpointMetadata = {
        parents: {},
        source: "input",
        step: 1,
        writes: {},
      };
      const config = { configurable: { thread_id: "test-thread-id" } };

      await expect(
        checkpointer.put(config, checkpoint, metadata, {})
      ).rejects.toThrow("Cannot store checkpoint without user ID");
    });

    it("should call Supabase upsert with correct parameters on success", async () => {
      mockUserIdGetter.mockResolvedValue("test-user-put");
      mockProposalIdGetter.mockResolvedValue("test-proposal-put");

      const threadId = "test-thread-put";
      const checkpoint = {
        v: 1,
        id: "mock-checkpoint-id-1",
        ts: new Date().toISOString(),
        channel_values: { some_channel: "value" },
        channel_versions: {},
        versions_seen: {},
        pending_sends: [],
      };
      const metadata: CheckpointMetadata = {
        parents: {},
        source: "update",
        step: 2,
        writes: {},
      };
      const config = { configurable: { thread_id: threadId } };

      // Mock upsert success
      mockSupabaseClient.upsert.mockResolvedValue({ error: null });

      await checkpointer.put(config, checkpoint, metadata, {});

      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "proposal_checkpoints"
      );
      expect(mockSupabaseClient.upsert).toHaveBeenCalledWith({
        thread_id: threadId,
        user_id: "test-user-put",
        proposal_id: "test-proposal-put",
        checkpoint_data: checkpoint,
      });
      // Also check session activity update
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("session_activity");
      expect(mockSupabaseClient.upsert).toHaveBeenCalledWith({
        thread_id: threadId,
        user_id: "test-user-put",
        proposal_id: "test-proposal-put",
        last_accessed: expect.any(String), // ISO string
      });
    });

    it("should log warning if Supabase upsert fails", async () => {
      mockUserIdGetter.mockResolvedValue("test-user-put-fail");
      mockProposalIdGetter.mockResolvedValue("test-proposal-put-fail");
      const consoleSpy = vi.spyOn(console, "warn");
      const threadId = "test-thread-put-fail";
      const checkpoint = {
        v: 1,
        id: "mock-checkpoint-id-2",
        ts: new Date().toISOString(),
        channel_values: {},
        channel_versions: {},
        versions_seen: {},
        pending_sends: [],
      };
      const metadata: CheckpointMetadata = {
        parents: {},
        source: "input",
        step: 1,
        writes: {},
      };
      const config = { configurable: { thread_id: threadId } };

      mockSupabaseClient.upsert.mockResolvedValue({
        error: new Error("Upsert Error"),
      });

      await checkpointer.put(config, checkpoint, metadata, {});

      expect(mockSupabaseClient.upsert).toHaveBeenCalledTimes(2); // Once for checkpoint, once for session
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error upserting checkpoint"),
        expect.any(Error)
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error updating session activity"),
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe("delete method", () => {
    it("should call Supabase delete with correct parameters", async () => {
      const threadId = "test-thread-delete";
      // Mock delete success
      mockSupabaseClient.delete.mockResolvedValue({ error: null });

      await checkpointer.delete(threadId);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "proposal_checkpoints"
      );
      expect(mockSupabaseClient.delete).toHaveBeenCalled();
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith("thread_id", threadId);
    });

    it("should log warning if Supabase delete fails", async () => {
      const consoleSpy = vi.spyOn(console, "warn");
      const threadId = "test-thread-delete-fail";
      mockSupabaseClient.delete.mockResolvedValue({
        error: new Error("Delete Error"),
      });

      await checkpointer.delete(threadId);

      expect(mockSupabaseClient.delete).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error deleting checkpoint"),
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe("listNamespaces method", () => {
    it("should call Supabase select distinct and return namespaces", async () => {
      const mockNamespaces = [
        { proposal_id: "proposal-123" },
        { proposal_id: "proposal-456" },
      ];
      // Mock the distinct select call
      mockSupabaseClient.select.mockReturnValueOnce({
        distinct: vi.fn().mockReturnThis(), // Chain distinct()
        eq: vi.fn().mockReturnThis(), // Chain potential eq()
        like: vi.fn().mockReturnThis(), // Chain potential like()
        ilike: vi.fn().mockReturnThis(), // Chain potential ilike()
        neq: vi.fn().mockReturnThis(), // Chain potential neq()
        gt: vi.fn().mockReturnThis(), // Chain potential gt()
        gte: vi.fn().mockReturnThis(), // Chain potential gte()
        lt: vi.fn().mockReturnThis(), // Chain potential lt()
        lte: vi.fn().mockReturnThis(), // Chain potential lte()
        in: vi.fn().mockReturnThis(), // Chain potential in()
        is: vi.fn().mockReturnThis(), // Chain potential is()
        contains: vi.fn().mockReturnThis(), // Chain potential contains()
        containedBy: vi.fn().mockReturnThis(), // Chain potential containedBy()
        // Mock the final resolution of the query
        then: vi.fn((callback) =>
          callback({ data: mockNamespaces, error: null })
        ),
      } as any);

      const result = await checkpointer.listNamespaces();

      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "proposal_checkpoints"
      );
      // Check if distinct was called on the select query builder
      expect(mockSupabaseClient.select().distinct).toHaveBeenCalledWith();
      expect(result).toEqual(["proposal-123", "proposal-456"]);
    });

    it("should handle Supabase errors during namespace listing", async () => {
      const consoleSpy = vi.spyOn(console, "warn");
      const testError = new Error("Namespace List Error");
      // Mock the distinct select call to return an error
      mockSupabaseClient.select.mockReturnValueOnce({
        distinct: vi.fn().mockReturnThis(),
        // Mock the final resolution to return an error
        then: vi.fn((callback) => callback({ data: null, error: testError })),
      } as any);

      const result = await checkpointer.listNamespaces();

      expect(mockSupabaseClient.select().distinct).toHaveBeenCalled();
      expect(result).toEqual([]); // Expect empty array on error
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error listing namespaces"),
        testError
      );
      consoleSpy.mockRestore();
    });
  });

  // New tests for getUserCheckpoints
  describe("getUserCheckpoints method", () => {
    it("should call Supabase select with user_id and return summaries", async () => {
      const userId = "user-abc";
      const mockCheckpoints = [
        {
          thread_id: "thread-1",
          user_id: userId,
          proposal_id: "proposal-123",
          updated_at: new Date().toISOString(),
          checkpoint: JSON.stringify({ v: 1, ts: "some-ts" }),
          metadata: JSON.stringify({ source: "test" }),
        },
        {
          thread_id: "thread-2",
          user_id: userId,
          proposal_id: "proposal-456",
          updated_at: new Date().toISOString(),
          checkpoint: JSON.stringify({ v: 1, ts: "other-ts", data: "abc" }),
          metadata: JSON.stringify({}),
        },
      ];
      const expectedSummaries = [
        {
          thread_id: "thread-1",
          user_id: userId,
          proposal_id: "proposal-123",
          updated_at: expect.any(String),
          size_bytes:
            JSON.stringify(mockCheckpoints[0].checkpoint).length +
            JSON.stringify(mockCheckpoints[0].metadata).length,
        },
        {
          thread_id: "thread-2",
          user_id: userId,
          proposal_id: "proposal-456",
          updated_at: expect.any(String),
          size_bytes:
            JSON.stringify(mockCheckpoints[1].checkpoint).length +
            JSON.stringify(mockCheckpoints[1].metadata).length,
        },
      ];

      // Mock the select call for user checkpoints
      mockSupabaseClient.select.mockResolvedValue({
        data: mockCheckpoints,
        error: null,
      });

      const result = await checkpointer.getUserCheckpoints(userId);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "proposal_checkpoints"
      );
      expect(mockSupabaseClient.select).toHaveBeenCalledWith(
        "thread_id, user_id, proposal_id, updated_at, checkpoint, metadata"
      );
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith("user_id", userId);
      // Deep equality check ignoring updated_at specifics but checking type
      expect(result).toHaveLength(expectedSummaries.length);
      expect(result[0]).toMatchObject(expectedSummaries[0]);
      expect(result[1]).toMatchObject(expectedSummaries[1]);
      expect(typeof result[0].updated_at).toBe("string");
      expect(typeof result[1].updated_at).toBe("string");
    });

    it("should handle Supabase errors during user checkpoint fetching", async () => {
      const consoleSpy = vi.spyOn(console, "warn");
      const userId = "user-error";
      const testError = new Error("User Checkpoint Fetch Error");
      mockSupabaseClient.select.mockResolvedValue({
        data: null,
        error: testError,
      });

      const result = await checkpointer.getUserCheckpoints(userId);

      expect(mockSupabaseClient.eq).toHaveBeenCalledWith("user_id", userId);
      expect(result).toEqual([]); // Expect empty array on error
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error fetching checkpoints for user"),
        testError
      );
      consoleSpy.mockRestore();
    });

    it("should return an empty array if no checkpoints found", async () => {
      const userId = "user-no-checkpoints";
      mockSupabaseClient.select.mockResolvedValue({ data: [], error: null });

      const result = await checkpointer.getUserCheckpoints(userId);

      expect(mockSupabaseClient.eq).toHaveBeenCalledWith("user_id", userId);
      expect(result).toEqual([]);
    });
  });

  // New tests for getProposalCheckpoints
  describe("getProposalCheckpoints method", () => {
    it("should call Supabase select with proposal_id and return summaries", async () => {
      const proposalId = "proposal-xyz";
      const mockCheckpoints = [
        {
          thread_id: "thread-3",
          user_id: "user-789",
          proposal_id: proposalId,
          updated_at: new Date().toISOString(),
          checkpoint: JSON.stringify({ v: 1, ts: "some-ts" }),
          metadata: JSON.stringify({ source: "test" }),
        },
      ];
      const expectedSummaries = [
        {
          thread_id: "thread-3",
          user_id: "user-789",
          proposal_id: proposalId,
          updated_at: expect.any(String),
          size_bytes:
            JSON.stringify(mockCheckpoints[0].checkpoint).length +
            JSON.stringify(mockCheckpoints[0].metadata).length,
        },
      ];
      // Mock the select call for proposal checkpoints
      mockSupabaseClient.select.mockResolvedValue({
        data: mockCheckpoints,
        error: null,
      });

      const result = await checkpointer.getProposalCheckpoints(proposalId);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "proposal_checkpoints"
      );
      expect(mockSupabaseClient.select).toHaveBeenCalledWith(
        "thread_id, user_id, proposal_id, updated_at, checkpoint, metadata"
      );
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith(
        "proposal_id",
        proposalId
      );
      expect(result).toHaveLength(expectedSummaries.length);
      expect(result[0]).toMatchObject(expectedSummaries[0]);
      expect(typeof result[0].updated_at).toBe("string");
    });

    it("should handle Supabase errors during proposal checkpoint fetching", async () => {
      const consoleSpy = vi.spyOn(console, "warn");
      const proposalId = "proposal-error";
      const testError = new Error("Proposal Checkpoint Fetch Error");
      mockSupabaseClient.select.mockResolvedValue({
        data: null,
        error: testError,
      });

      const result = await checkpointer.getProposalCheckpoints(proposalId);

      expect(mockSupabaseClient.eq).toHaveBeenCalledWith(
        "proposal_id",
        proposalId
      );
      expect(result).toEqual([]); // Expect empty array on error
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error fetching checkpoints for proposal"),
        testError
      );
      consoleSpy.mockRestore();
    });

    it("should return an empty array if no checkpoints found", async () => {
      const proposalId = "proposal-no-checkpoints";
      mockSupabaseClient.select.mockResolvedValue({ data: [], error: null });

      const result = await checkpointer.getProposalCheckpoints(proposalId);

      expect(mockSupabaseClient.eq).toHaveBeenCalledWith(
        "proposal_id",
        proposalId
      );
      expect(result).toEqual([]);
    });
  });
});
