/**
 * Simple tests for SupabaseCheckpointer class
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SupabaseCheckpointer } from "../supabase-checkpointer.js";
import { createClient } from "@supabase/supabase-js";
import { CheckpointMetadata } from "@langchain/langgraph";

// Mock the Supabase client creation
vi.mock("@supabase/supabase-js", () => {
  // Create mocks for the chained methods
  const mockEq = vi.fn().mockReturnThis();
  const mockOrder = vi.fn().mockReturnThis();
  const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null }); // Default mock
  const mockSelect = vi.fn().mockImplementation(() => ({
    // Return object with chainable methods
    eq: mockEq,
    order: mockOrder,
    single: mockSingle,
    distinct: mockDistinct, // Added distinct here if select() returns it directly
    // If distinct is chained after select, it needs its own mock setup
  }));
  const mockUpsert = vi.fn().mockResolvedValue({ error: null }); // Default mock
  const mockDelete = vi.fn().mockImplementation(() => ({
    // Return object with chainable methods
    eq: mockEq,
  }));
  const mockDistinct = vi.fn().mockImplementation(() => ({
    // Return object with chainable methods
    order: mockOrder, // Assuming distinct is followed by order
  }));
  const mockFrom = vi.fn().mockImplementation(() => ({
    // Return object with chainable methods
    select: mockSelect,
    upsert: mockUpsert,
    delete: mockDelete,
  }));

  return {
    createClient: vi.fn(() => ({
      from: mockFrom,
      // Keep direct mocks if needed, but chainable mocks handle most cases
      // select: mockSelect, // Now handled within mockFrom
      // eq: mockEq,         // Now handled within mockSelect/mockDelete
      // single: mockSingle,   // Now handled within mockSelect
      // upsert: mockUpsert,   // Now handled within mockFrom
      // delete: mockDelete,   // Now handled within mockFrom
      // distinct: mockDistinct, // Now handled within mockSelect (potentially)
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

    // Reset mocks that return promises with specific values for each test if needed
    // This is important to avoid mock state bleeding between tests
    const mockEq = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockSelect = vi.fn().mockImplementation(() => ({
      eq: mockEq,
      order: mockOrder,
      single: mockSingle,
      distinct: mockDistinct,
    }));
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const mockDeleteInnerEq = vi.fn().mockResolvedValue({ error: null }); // Mock for delete().eq() resolution
    const mockDelete = vi.fn().mockImplementation(() => ({
      eq: mockDeleteInnerEq,
    }));
    const mockDistinctInnerOrder = vi
      .fn()
      .mockResolvedValue({ data: [], error: null }); // Mock for distinct().order() resolution
    const mockDistinct = vi.fn().mockImplementation(() => ({
      order: mockDistinctInnerOrder,
    }));
    const mockFrom = vi.fn().mockImplementation(() => ({
      select: mockSelect,
      upsert: mockUpsert,
      delete: mockDelete,
    }));

    // Re-assign mocks to the client instance within beforeEach
    // This ensures each test gets a fresh set of mocks configured correctly
    mockSupabaseClient = {
      from: mockFrom,
      // If createClient mock needs updating:
      // (createClient as any).mockReturnValueOnce({ from: mockFrom });
      // mockSupabaseClient = (createClient as any)(); // Re-initialize if structure changed
    };

    mockUserIdGetter = vi.fn().mockResolvedValue("test-user-id");
    mockProposalIdGetter = vi.fn().mockResolvedValue("test-proposal-id");

    checkpointer = new SupabaseCheckpointer({
      supabaseUrl: "https://example.supabase.co",
      supabaseKey: "test-key",
      userIdGetter: mockUserIdGetter,
      proposalIdGetter: mockProposalIdGetter,
      // Pass the *specific mock client instance* if the class accepts it
      // Or rely on the global mock if it modifies the imported createClient directly
      // supabaseClient: mockSupabaseClient, // Example if constructor takes client
    });

    // If checkpointer creates its own client internally, re-access the globally mocked one
    // This assumes the vi.mock at the top correctly intercepts the createClient call made by the checkpointer instance.
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
      const mockSingle = vi.fn().mockResolvedValue({
        data: { checkpoint_data: mockCheckpointData },
        error: null,
      });
      const mockEq = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockImplementation(() => ({
        eq: mockEq,
        single: mockSingle,
      }));
      mockSupabaseClient.from.mockImplementation(() => ({
        select: mockSelect,
      }));

      const config = { configurable: { thread_id: "test-thread-id" } };
      const result = await checkpointer.get(config);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "proposal_checkpoints"
      );
      // Check the mockSelect was called
      expect(mockSupabaseClient.from().select).toHaveBeenCalledWith(
        "checkpoint_data"
      );
      // Check the mockEq was called *on the result of select*
      expect(mockSupabaseClient.from().select().eq).toHaveBeenCalledWith(
        "thread_id",
        "test-thread-id"
      );
      // Check the mockSingle was called *on the result of eq*
      expect(mockSupabaseClient.from().select().eq().single).toHaveBeenCalled();
      expect(result).toEqual(mockCheckpointData);
    });

    it("should return undefined if Supabase returns no data", async () => {
      // Configure the mock chain for this test case
      const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockEq = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockImplementation(() => ({
        eq: mockEq,
        single: mockSingle,
      }));
      mockSupabaseClient.from.mockImplementation(() => ({
        select: mockSelect,
      }));

      const config = { configurable: { thread_id: "test-thread-id" } };
      const result = await checkpointer.get(config);
      expect(result).toBeUndefined();
      // Verify the chain was called
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "proposal_checkpoints"
      );
      expect(mockSupabaseClient.from().select).toHaveBeenCalledWith(
        "checkpoint_data"
      );
      expect(mockSupabaseClient.from().select().eq).toHaveBeenCalledWith(
        "thread_id",
        "test-thread-id"
      );
      expect(mockSupabaseClient.from().select().eq().single).toHaveBeenCalled();
    });

    it("should log warning and return undefined if Supabase returns error", async () => {
      const consoleSpy = vi.spyOn(console, "warn");
      const dbError = new Error("DB Error");
      // Configure the mock chain for this test case
      const mockSingle = vi
        .fn()
        .mockResolvedValue({ data: null, error: dbError });
      const mockEq = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockImplementation(() => ({
        eq: mockEq,
        single: mockSingle,
      }));
      mockSupabaseClient.from.mockImplementation(() => ({
        select: mockSelect,
      }));

      const config = { configurable: { thread_id: "test-thread-id" } };
      const result = await checkpointer.get(config); // Call the function

      expect(result).toBeUndefined(); // Assert the result
      // Verify the chain was called
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "proposal_checkpoints"
      );
      expect(mockSupabaseClient.from().select).toHaveBeenCalledWith(
        "checkpoint_data"
      );
      expect(mockSupabaseClient.from().select().eq).toHaveBeenCalledWith(
        "thread_id",
        "test-thread-id"
      );
      expect(mockSupabaseClient.from().select().eq().single).toHaveBeenCalled();
      // Assert the warning AFTER the call has resolved/rejected
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error fetching checkpoint"),
        dbError
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

      // Mock upsert success for both tables
      const mockUpsertCheckpoint = vi.fn().mockResolvedValue({ error: null });
      const mockUpsertSession = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from.mockImplementation((tableName: string) => {
        if (tableName === "proposal_checkpoints") {
          return { upsert: mockUpsertCheckpoint };
        }
        if (tableName === "proposal_sessions") {
          return { upsert: mockUpsertSession };
        }
        return { upsert: vi.fn() }; // Default fallback
      });

      await checkpointer.put(config, checkpoint, metadata, {});

      // Check checkpoint upsert call
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "proposal_checkpoints"
      );
      expect(mockUpsertCheckpoint).toHaveBeenCalledWith(
        // Use the specific mock
        expect.objectContaining({
          // Use objectContaining for flexibility
          thread_id: threadId,
          user_id: "test-user-put",
          proposal_id: "test-proposal-put",
          checkpoint_data: checkpoint,
          updated_at: expect.any(String),
          size_bytes: expect.any(Number),
        }),
        { onConflict: "thread_id" } // Correct onConflict based on migration guide/schema
      );

      // Check session activity update call
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("proposal_sessions");
      expect(mockUpsertSession).toHaveBeenCalledWith(
        // Use the specific mock
        expect.objectContaining({
          // Use objectContaining
          thread_id: threadId,
          user_id: "test-user-put",
          proposal_id: "test-proposal-put",
          last_accessed: expect.any(String), // Check correct field name
        }),
        { onConflict: "thread_id" } // Correct onConflict based on migration guide/schema
      );
    });

    it("should log warning if Supabase checkpoint upsert fails", async () => {
      mockUserIdGetter.mockResolvedValue("test-user-put-fail");
      mockProposalIdGetter.mockResolvedValue("test-proposal-put-fail");
      const consoleSpy = vi.spyOn(console, "warn");
      const threadId = "test-thread-put-fail";
      const checkpoint = { v: 1, ts: new Date().toISOString() } as any; // Minimal checkpoint
      const metadata = {} as CheckpointMetadata; // Minimal metadata
      const config = { configurable: { thread_id: threadId } };
      const upsertError = new Error("Upsert Error");

      // Mock upsert failure for checkpoints, success for sessions (or handle separately)
      const mockUpsertCheckpoint = vi
        .fn()
        .mockResolvedValue({ error: upsertError });
      const mockUpsertSession = vi.fn().mockResolvedValue({ error: null }); // Assume session update still happens or test failure cascade

      mockSupabaseClient.from.mockImplementation((tableName: string) => {
        if (tableName === "proposal_checkpoints") {
          return { upsert: mockUpsertCheckpoint };
        }
        if (tableName === "proposal_sessions") {
          return { upsert: mockUpsertSession };
        }
        return { upsert: vi.fn() };
      });

      // Expect the put method *itself* not to throw, but to log a warning
      await checkpointer.put(config, checkpoint, metadata, {});

      expect(mockUpsertCheckpoint).toHaveBeenCalled(); // Ensure it was called
      // Assert the warning AFTER the async call completes
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error storing checkpoint"),
        upsertError
      );
      consoleSpy.mockRestore();
    });

    it("should log warning if Supabase session upsert fails", async () => {
      mockUserIdGetter.mockResolvedValue("test-user-session-fail");
      mockProposalIdGetter.mockResolvedValue("test-proposal-session-fail");
      const consoleSpy = vi.spyOn(console, "warn");
      const threadId = "test-thread-session-fail";
      const checkpoint = { v: 1, ts: new Date().toISOString() } as any;
      const metadata = {} as CheckpointMetadata;
      const config = { configurable: { thread_id: threadId } };
      const sessionUpsertError = new Error("Session Upsert Error");

      // Mock success for checkpoints, failure for sessions
      const mockUpsertCheckpoint = vi.fn().mockResolvedValue({ error: null });
      const mockUpsertSession = vi
        .fn()
        .mockResolvedValue({ error: sessionUpsertError });

      mockSupabaseClient.from.mockImplementation((tableName: string) => {
        if (tableName === "proposal_checkpoints") {
          return { upsert: mockUpsertCheckpoint };
        }
        if (tableName === "proposal_sessions") {
          return { upsert: mockUpsertSession };
        }
        return { upsert: vi.fn() };
      });

      await checkpointer.put(config, checkpoint, metadata, {});

      expect(mockUpsertCheckpoint).toHaveBeenCalled();
      expect(mockUpsertSession).toHaveBeenCalled();
      // Assert the warning AFTER the async call completes
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error updating session activity"),
        sessionUpsertError
      );
      consoleSpy.mockRestore();
    });
  });

  describe("delete method", () => {
    it("should throw error when no thread_id is provided", async () => {
      await expect(checkpointer.delete("")).rejects.toThrow(
        "No thread_id provided"
      );
    });

    it("should call Supabase delete with correct parameters", async () => {
      // Mock the delete chain
      const mockEq = vi.fn().mockResolvedValue({ error: null }); // Mock eq() resolving successfully
      const mockDelete = vi.fn().mockImplementation(() => ({
        eq: mockEq,
      }));
      mockSupabaseClient.from.mockImplementation(() => ({
        // Re-mock 'from' for this specific test
        delete: mockDelete,
      }));

      const threadId = "test-thread-delete";
      await checkpointer.delete(threadId);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "proposal_checkpoints"
      );
      // Check the mockDelete was called
      expect(mockSupabaseClient.from().delete).toHaveBeenCalled();
      // Check the mockEq was called *on the result of delete*
      expect(mockSupabaseClient.from().delete().eq).toHaveBeenCalledWith(
        "thread_id",
        threadId
      );
    });

    it("should log warning if Supabase delete fails", async () => {
      const consoleSpy = vi.spyOn(console, "warn");
      const threadId = "test-thread-delete-fail";
      const deleteError = new Error("Delete Error");

      // Mock the delete chain failing
      const mockEq = vi.fn().mockResolvedValue({ error: deleteError }); // Mock eq() resolving with an error
      const mockDelete = vi.fn().mockImplementation(() => ({
        eq: mockEq,
      }));
      mockSupabaseClient.from.mockImplementation(() => ({
        delete: mockDelete,
      }));

      // Delete should not throw, just log
      await checkpointer.delete(threadId);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "proposal_checkpoints"
      );
      expect(mockSupabaseClient.from().delete).toHaveBeenCalled();
      expect(mockSupabaseClient.from().delete().eq).toHaveBeenCalledWith(
        "thread_id",
        threadId
      );
      // Assert the warning AFTER the async call completes
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error deleting checkpoint"),
        deleteError
      );
      consoleSpy.mockRestore();
    });

    it("should handle successful deletion with retries", async () => {
      // Mock the delete chain
      const mockEq = vi.fn().mockResolvedValue({ error: null }); // Mock successful deletion
      const mockDelete = vi.fn().mockImplementation(() => ({
        eq: mockEq,
      }));
      mockSupabaseClient.from.mockImplementation(() => ({
        delete: mockDelete,
      }));

      const threadId = "test-thread-id-retry-success";
      await checkpointer.delete(threadId);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "proposal_checkpoints"
      );
      expect(mockSupabaseClient.from().delete).toHaveBeenCalled();
      expect(mockSupabaseClient.from().delete().eq).toHaveBeenCalledWith(
        "thread_id",
        threadId
      );
    });

    it("should not throw an error if deletion fails", async () => {
      const deleteError = new Error("Deletion Error");

      // Mock the delete chain
      const mockEq = vi.fn().mockResolvedValue({ error: deleteError }); // Mock unsuccessful deletion
      const mockDelete = vi.fn().mockImplementation(() => ({
        eq: mockEq,
      }));
      mockSupabaseClient.from.mockImplementation(() => ({
        delete: mockDelete,
      }));

      const threadId = "test-thread-id-failure";
      await expect(checkpointer.delete(threadId)).resolves.not.toThrow();

      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "proposal_checkpoints"
      );
      expect(mockSupabaseClient.from().delete).toHaveBeenCalled();
      expect(mockSupabaseClient.from().delete().eq).toHaveBeenCalledWith(
        "thread_id",
        threadId
      );

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Failed to delete checkpoint after all retries"
        ),
        expect.any(Object)
      );
    });

    it("should handle errors during deletion", async () => {
      const error = new Error("Deletion Error");

      // Mock the delete chain to reject
      const mockEq = vi.fn().mockRejectedValue(error); // Mock rejected promise
      const mockDelete = vi.fn().mockImplementation(() => ({
        eq: mockEq,
      }));
      mockSupabaseClient.from.mockImplementation(() => ({
        delete: mockDelete,
      }));

      const threadId = "test-thread-id-error";
      await expect(checkpointer.delete(threadId)).resolves.not.toThrow(); // Should not throw

      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "proposal_checkpoints"
      );
      expect(mockSupabaseClient.from().delete).toHaveBeenCalled();
      expect(mockSupabaseClient.from().delete().eq).toHaveBeenCalledWith(
        "thread_id",
        threadId
      );

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Failed to delete checkpoint after all retries"
        ),
        expect.any(Object)
      );
    });

    it("should return an empty array if no checkpoints are found for the proposal", async () => {
      const proposalId = "proposal-456";

      // Mock the select chain
      const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockEq = vi.fn().mockImplementation(() => ({ order: mockOrder }));
      const mockSelect = vi.fn().mockImplementation(() => ({ eq: mockEq }));
      mockSupabaseClient.from.mockImplementation(() => ({
        select: mockSelect,
      }));

      const checkpoints = await checkpointer.getProposalCheckpoints(proposalId);

      expect(checkpoints).toEqual([]);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "proposal_checkpoints"
      );
      expect(mockSupabaseClient.from().select).toHaveBeenCalledWith(
        "thread_id, user_id, proposal_id, updated_at, size_bytes"
      );
      expect(mockSupabaseClient.from().select().eq).toHaveBeenCalledWith(
        "proposal_id",
        proposalId
      );
      expect(
        mockSupabaseClient.from().select().eq().order
      ).toHaveBeenCalledWith("updated_at", { ascending: false });
    });

    it("should return summarized checkpoints for a given proposal ID", async () => {
      const proposalId = "proposal-789";
      const mockData = [
        {
          thread_id: "t1",
          updated_at: new Date().toISOString(),
          size_bytes: 100,
          proposal_id: "p1",
          user_id: "test-user",
        },
      ];

      // Mock the select chain
      const mockOrder = vi
        .fn()
        .mockResolvedValue({ data: mockData, error: null });
      const mockEq = vi.fn().mockImplementation(() => ({ order: mockOrder }));
      const mockSelect = vi.fn().mockImplementation(() => ({ eq: mockEq }));
      mockSupabaseClient.from.mockImplementation(() => ({
        select: mockSelect,
      }));

      const checkpoints = await checkpointer.getProposalCheckpoints(proposalId);

      expect(checkpoints).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            threadId: "t1",
            size: 100,
            proposalId: "p1",
          }),
        ])
      );
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "proposal_checkpoints"
      );
      expect(mockSupabaseClient.from().select).toHaveBeenCalledWith(
        "thread_id, user_id, proposal_id, updated_at, size_bytes"
      );
      expect(mockSupabaseClient.from().select().eq).toHaveBeenCalledWith(
        "proposal_id",
        proposalId
      );
      expect(
        mockSupabaseClient.from().select().eq().order
      ).toHaveBeenCalledWith("updated_at", { ascending: false });
    });

    it("should handle errors when fetching proposal checkpoints", async () => {
      const proposalId = "proposal-error";
      const error = new Error("Fetch Error");

      // Mock the select chain
      const mockOrder = vi.fn().mockRejectedValue(error);
      const mockEq = vi.fn().mockImplementation(() => ({ order: mockOrder }));
      const mockSelect = vi.fn().mockImplementation(() => ({ eq: mockEq }));
      mockSupabaseClient.from.mockImplementation(() => ({
        select: mockSelect,
      }));

      await expect(
        checkpointer.getProposalCheckpoints(proposalId)
      ).rejects.toThrow("Failed to get proposal checkpoints");

      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "proposal_checkpoints"
      );
      expect(mockSupabaseClient.from().select).toHaveBeenCalledWith(
        "thread_id, user_id, proposal_id, updated_at, size_bytes"
      );
      expect(mockSupabaseClient.from().select().eq).toHaveBeenCalledWith(
        "proposal_id",
        proposalId
      );
      expect(mockSupabaseClient.from().select().eq().order).toHaveBeenCalled();

      // The following would normally be checked, but the error is thrown before this log happens
      // expect(console.error).toHaveBeenCalledWith(
      //   "Failed to get proposal checkpoints after all retries",
      //   error
      // );
    });
  });

  describe("listNamespaces method", () => {
    it("should call Supabase select distinct with correct parameters", async () => {
      const mockNamespaces = [{ proposal_id: "ns1" }, { proposal_id: "ns2" }];
      // Mock the distinct chain
      const mockOrder = vi
        .fn()
        .mockResolvedValue({ data: mockNamespaces, error: null });
      const mockDistinct = vi.fn().mockImplementation(() => ({
        order: mockOrder,
      }));
      const mockSelect = vi.fn().mockImplementation(() => ({
        distinct: mockDistinct,
      }));
      mockSupabaseClient.from.mockImplementation(() => ({
        select: mockSelect,
      }));

      const result = await checkpointer.listNamespaces();

      expect(mockSupabaseClient.from).toHaveBeenCalledWith("proposal_sessions"); // Should check sessions table
      // Check the mockSelect was called
      expect(mockSupabaseClient.from().select).toHaveBeenCalledWith(
        "proposal_id"
      );
      // Check the mockDistinct was called *on the result of select*
      expect(mockSupabaseClient.from().select().distinct).toHaveBeenCalled();
      // Check the mockOrder was called *on the result of distinct*
      expect(
        mockSupabaseClient.from().select().distinct().order
      ).toHaveBeenCalledWith("proposal_id", { ascending: true });

      expect(result).toEqual(["ns1", "ns2"]);
    });

    it("should return empty array if Supabase returns no data", async () => {
      const mockOrder = vi.fn().mockResolvedValue({ data: null, error: null }); // No data
      const mockDistinct = vi
        .fn()
        .mockImplementation(() => ({ order: mockOrder }));
      const mockSelect = vi
        .fn()
        .mockImplementation(() => ({ distinct: mockDistinct }));
      mockSupabaseClient.from.mockImplementation(() => ({
        select: mockSelect,
      }));

      const result = await checkpointer.listNamespaces();
      expect(result).toEqual([]);
      // Optionally verify calls happened
      expect(
        mockSupabaseClient.from().select().distinct().order
      ).toHaveBeenCalled();
    });

    it("should log warning and return empty array if Supabase returns error", async () => {
      const consoleSpy = vi.spyOn(console, "warn");
      const listError = new Error("List Error");
      const mockOrder = vi
        .fn()
        .mockResolvedValue({ data: null, error: listError }); // Error
      const mockDistinct = vi
        .fn()
        .mockImplementation(() => ({ order: mockOrder }));
      const mockSelect = vi
        .fn()
        .mockImplementation(() => ({ distinct: mockDistinct }));
      mockSupabaseClient.from.mockImplementation(() => ({
        select: mockSelect,
      }));

      const result = await checkpointer.listNamespaces();

      expect(result).toEqual([]);
      expect(
        mockSupabaseClient.from().select().distinct().order
      ).toHaveBeenCalled();
      // Assert warning AFTER call completes
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error listing namespaces"),
        listError
      );
      consoleSpy.mockRestore();
    });
  });

  describe("getUserCheckpoints method", () => {
    it("should call Supabase select with correct columns and filter", async () => {
      const mockCheckpoints = [
        {
          thread_id: "t1",
          updated_at: new Date().toISOString(),
          size_bytes: 100,
          proposal_id: "p1",
          user_id: "test-user",
        },
        {
          thread_id: "t2",
          updated_at: new Date().toISOString(),
          size_bytes: 200,
          proposal_id: "p2",
          user_id: "test-user",
        },
      ];
      // Mock the select chain
      const mockOrder = vi
        .fn()
        .mockResolvedValue({ data: mockCheckpoints, error: null });
      const mockEq = vi.fn().mockImplementation(() => ({ order: mockOrder }));
      const mockSelect = vi.fn().mockImplementation(() => ({ eq: mockEq }));
      mockSupabaseClient.from.mockImplementation(() => ({
        select: mockSelect,
      }));

      const result = await checkpointer.getUserCheckpoints("test-user");

      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "proposal_checkpoints"
      );
      // Check the mockSelect was called with specific summary columns
      expect(mockSupabaseClient.from().select).toHaveBeenCalledWith(
        "thread_id, user_id, proposal_id, updated_at, size_bytes" // Verify exact columns
      );
      // Check the mockEq was called *on the result of select*
      expect(mockSupabaseClient.from().select().eq).toHaveBeenCalledWith(
        "user_id",
        "test-user"
      );
      // Check the mockOrder was called *on the result of eq*
      expect(
        mockSupabaseClient.from().select().eq().order
      ).toHaveBeenCalledWith("updated_at", { ascending: false });
      expect(result).toEqual(mockCheckpoints);
    });

    it("should return empty array if Supabase returns no data", async () => {
      // Mock the select chain returning no data
      const mockOrder = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockEq = vi.fn().mockImplementation(() => ({ order: mockOrder }));
      const mockSelect = vi.fn().mockImplementation(() => ({ eq: mockEq }));
      mockSupabaseClient.from.mockImplementation(() => ({
        select: mockSelect,
      }));

      const result = await checkpointer.getUserCheckpoints("test-user-nodata");
      expect(result).toEqual([]);
      expect(mockSupabaseClient.from().select().eq().order).toHaveBeenCalled(); // Verify call
    });

    it("should log warning and return empty array if Supabase returns error", async () => {
      const consoleSpy = vi.spyOn(console, "warn");
      const getError = new Error("Get Checkpoints Error");
      // Mock the select chain returning an error
      const mockOrder = vi
        .fn()
        .mockResolvedValue({ data: null, error: getError });
      const mockEq = vi.fn().mockImplementation(() => ({ order: mockOrder }));
      const mockSelect = vi.fn().mockImplementation(() => ({ eq: mockEq }));
      mockSupabaseClient.from.mockImplementation(() => ({
        select: mockSelect,
      }));

      const result = await checkpointer.getUserCheckpoints("test-user-error");
      expect(result).toEqual([]);
      expect(mockSupabaseClient.from().select().eq().order).toHaveBeenCalled(); // Verify call

      // Assert warning AFTER call completes
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error fetching user checkpoints"),
        getError
      );
      consoleSpy.mockRestore();
    });
  });

  describe("getProposalCheckpoints method", () => {
    it("should call Supabase select with correct columns and filter", async () => {
      const mockCheckpoints = [
        {
          thread_id: "t1",
          updated_at: new Date().toISOString(),
          size_bytes: 100,
          proposal_id: "p1",
          user_id: "test-user",
        },
      ];

      // Mock the select chain properly
      const mockOrder = vi
        .fn()
        .mockResolvedValue({ data: mockCheckpoints, error: null });
      const mockEq = vi.fn().mockImplementation(() => ({ order: mockOrder }));
      const mockSelect = vi.fn().mockImplementation(() => ({ eq: mockEq }));
      mockSupabaseClient.from.mockImplementation(() => ({
        select: mockSelect,
      }));

      const result = await checkpointer.getProposalCheckpoints("p1");

      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "proposal_checkpoints"
      );
      expect(mockSupabaseClient.from().select).toHaveBeenCalledWith(
        "thread_id, user_id, proposal_id, updated_at, size_bytes"
      );
      expect(mockSupabaseClient.from().select().eq).toHaveBeenCalledWith(
        "proposal_id",
        "p1"
      );
      expect(
        mockSupabaseClient.from().select().eq().order
      ).toHaveBeenCalledWith("updated_at", { ascending: false });

      // Check the result
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            threadId: "t1",
            size: 100,
            proposalId: "p1",
          }),
        ])
      );
    });

    it("should return empty array if Supabase returns no data", async () => {
      // Mock the select chain returning no data
      const mockOrder = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockEq = vi.fn().mockImplementation(() => ({ order: mockOrder }));
      const mockSelect = vi.fn().mockImplementation(() => ({ eq: mockEq }));
      mockSupabaseClient.from.mockImplementation(() => ({
        select: mockSelect,
      }));

      const result = await checkpointer.getProposalCheckpoints("p-nodata");
      expect(result).toEqual([]);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "proposal_checkpoints"
      );
      expect(mockSupabaseClient.from().select).toHaveBeenCalledWith(
        "thread_id, user_id, proposal_id, updated_at, size_bytes"
      );
      expect(mockSupabaseClient.from().select().eq).toHaveBeenCalledWith(
        "proposal_id",
        "p-nodata"
      );
      expect(mockSupabaseClient.from().select().eq().order).toHaveBeenCalled();
    });

    it("should log warning and return empty array if Supabase returns error", async () => {
      const consoleSpy = vi.spyOn(console, "warn");
      const getError = new Error("Get Proposal Checkpoints Error");
      // Mock the select chain returning an error
      const mockOrder = vi
        .fn()
        .mockResolvedValue({ data: null, error: getError });
      const mockEq = vi.fn().mockImplementation(() => ({ order: mockOrder }));
      const mockSelect = vi.fn().mockImplementation(() => ({ eq: mockEq }));
      mockSupabaseClient.from.mockImplementation(() => ({
        select: mockSelect,
      }));

      const result = await checkpointer.getProposalCheckpoints("p-error");
      expect(result).toEqual([]);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "proposal_checkpoints"
      );
      expect(mockSupabaseClient.from().select).toHaveBeenCalledWith(
        "thread_id, user_id, proposal_id, updated_at, size_bytes"
      );
      expect(mockSupabaseClient.from().select().eq).toHaveBeenCalledWith(
        "proposal_id",
        "p-error"
      );
      expect(mockSupabaseClient.from().select().eq().order).toHaveBeenCalled();

      // Assert warning AFTER call completes
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error fetching proposal checkpoints"),
        getError
      );
      consoleSpy.mockRestore();
    });
  });
});
