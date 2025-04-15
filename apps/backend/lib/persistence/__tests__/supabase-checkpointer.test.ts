/**
 * Unit tests for SupabaseCheckpointer
 */
import { SupabaseCheckpointer } from "../supabase-checkpointer.js";
import { createClient } from "@supabase/supabase-js";
import { withRetry } from "../../utils/backoff.js";
import { Checkpoint, CheckpointMetadata } from "@langchain/langgraph";

// Mock @supabase/supabase-js
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
  }),
}));

// Mock withRetry helper - update to match the actual signature with metadata and versions
jest.mock("../../utils/backoff.js", () => ({
  withRetry: jest.fn().mockImplementation((fn, options) => fn()),
}));

// Helper to create valid Checkpoint objects for testing
function createMockCheckpoint(overrides = {}): Checkpoint {
  return {
    id: "checkpoint-id",
    config: {},
    state: { foo: "bar" },
    ...(overrides as any),
  };
}

// Helper to create valid CheckpointMetadata objects for testing
function createMockMetadata(overrides = {}): CheckpointMetadata {
  return {
    source: "input",
    step: 1,
    writes: {},
    parents: {},
    ...overrides,
  };
}

// Helper to create valid ChannelVersions objects (plain object)
function createMockVersions(overrides = {}): Record<string, string> {
  return {
    ...overrides,
  };
}

describe("SupabaseCheckpointer", () => {
  let checkpointer: SupabaseCheckpointer;
  let mockSupabaseClient: any;
  let mockUserIdGetter: jest.Mock;
  let mockProposalIdGetter: jest.Mock;
  let mockLogger: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Set up mock Supabase client
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabaseClient);

    // Set up mock getters
    mockUserIdGetter = jest.fn().mockResolvedValue("test-user-id");
    mockProposalIdGetter = jest.fn().mockResolvedValue("test-proposal-id");

    // Set up mock logger
    mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
    };

    // Initialize the checkpointer with mocked dependencies
    checkpointer = new SupabaseCheckpointer({
      supabaseUrl: "https://example.supabase.co",
      supabaseKey: "test-key",
      userIdGetter: mockUserIdGetter,
      proposalIdGetter: mockProposalIdGetter,
      logger: mockLogger as any,
    });
  });

  describe("generateThreadId", () => {
    it("should generate thread ID with correct format", () => {
      const proposalId = "proposal-123";
      const componentName = "test";

      const threadId = SupabaseCheckpointer.generateThreadId(
        proposalId,
        componentName
      );

      expect(threadId).toMatch(
        new RegExp(`^${componentName}_${proposalId}_\\d+$`)
      );
    });

    it("should use default component name if not provided", () => {
      const proposalId = "proposal-123";

      const threadId = SupabaseCheckpointer.generateThreadId(proposalId);

      expect(threadId).toMatch(new RegExp(`^proposal_${proposalId}_\\d+$`));
    });
  });

  describe("get", () => {
    it("should return undefined when thread_id is not in config", async () => {
      const result = await checkpointer.get({});

      expect(result).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "No thread_id provided in config"
      );
    });

    it("should fetch checkpoint data from Supabase", async () => {
      const mockCheckpoint = createMockCheckpoint();

      mockSupabaseClient.single.mockResolvedValue({
        data: { checkpoint_data: mockCheckpoint },
        error: null,
      });

      const config = {
        configurable: {
          thread_id: "test-thread",
        },
      };

      const result = await checkpointer.get(config);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "proposal_checkpoints"
      );
      expect(mockSupabaseClient.select).toHaveBeenCalledWith("checkpoint_data");
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith(
        "thread_id",
        "test-thread"
      );
      expect(result).toEqual(mockCheckpoint);
    });

    it("should return undefined when checkpoint is not found", async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { code: "PGRST116", message: "Not found" },
      });

      const config = {
        configurable: {
          thread_id: "test-thread",
        },
      };

      const result = await checkpointer.get(config);

      expect(result).toBeUndefined();
    });

    it("should handle Supabase errors correctly", async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { code: "OTHER_ERROR", message: "Database error" },
      });

      const config = {
        configurable: {
          thread_id: "test-thread",
        },
      };

      // We're expecting the error to be caught internally
      const result = await checkpointer.get(config);

      expect(result).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to get checkpoint after all retries",
        expect.objectContaining({
          threadId: "test-thread",
          error: expect.any(Error),
        })
      );
    });

    it("should validate checkpoint data structure", async () => {
      // Invalid checkpoint data (missing required state field)
      const invalidCheckpoint = {
        id: "checkpoint-id",
        // Missing other required fields
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: { checkpoint_data: invalidCheckpoint },
        error: null,
      });

      const config = {
        configurable: {
          thread_id: "test-thread",
        },
      };

      // Should log warning but still return the data
      const result = await checkpointer.get(config);

      expect(result).toEqual(invalidCheckpoint);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Invalid checkpoint data format",
        expect.objectContaining({
          threadId: "test-thread",
        })
      );
    });

    it("should use retry mechanism for transient errors", async () => {
      const mockCheckpoint = createMockCheckpoint();

      mockSupabaseClient.single.mockResolvedValue({
        data: { checkpoint_data: mockCheckpoint },
        error: null,
      });

      const config = {
        configurable: {
          thread_id: "test-thread",
        },
      };

      await checkpointer.get(config);

      // Check that withRetry was called with the right parameters
      expect(withRetry).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          maxRetries: 3,
          initialDelayMs: 500,
          logger: mockLogger,
        })
      );
    });
  });

  describe("put", () => {
    it("should throw error when thread_id is not in config", async () => {
      await expect(
        checkpointer.put(
          {},
          createMockCheckpoint(),
          createMockMetadata(),
          createMockVersions()
        )
      ).rejects.toThrow("No thread_id provided in config");
    });

    it("should store checkpoint data to Supabase", async () => {
      mockSupabaseClient.upsert.mockResolvedValue({ error: null });

      const mockCheckpoint = createMockCheckpoint();
      const config = {
        configurable: {
          thread_id: "test-thread",
        },
      };
      const mockMetadata = createMockMetadata();
      const mockVersions = createMockVersions();

      await checkpointer.put(
        config,
        mockCheckpoint,
        mockMetadata,
        mockVersions
      );

      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "proposal_checkpoints"
      );
      expect(mockSupabaseClient.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          thread_id: "test-thread",
          user_id: "test-user-id",
          proposal_id: "test-proposal-id",
          checkpoint_data: mockCheckpoint,
          size_bytes: expect.any(Number),
        }),
        { onConflict: "thread_id, user_id" }
      );
    });

    it("should update session activity after storing checkpoint", async () => {
      mockSupabaseClient.upsert.mockResolvedValue({ error: null });

      const mockCheckpoint = createMockCheckpoint();
      const config = {
        configurable: {
          thread_id: "test-thread",
        },
      };
      const mockMetadata = createMockMetadata();
      const mockVersions = createMockVersions();

      await checkpointer.put(
        config,
        mockCheckpoint,
        mockMetadata,
        mockVersions
      );

      // First call is to the checkpoints table, second call is to sessions table
      expect(mockSupabaseClient.from).toHaveBeenNthCalledWith(
        2,
        "proposal_sessions"
      );
      expect(mockSupabaseClient.upsert).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          thread_id: "test-thread",
          user_id: "test-user-id",
          proposal_id: "test-proposal-id",
          last_activity: expect.any(String),
        }),
        { onConflict: "thread_id" }
      );
    });

    it("should throw error when user ID is not available", async () => {
      mockUserIdGetter.mockResolvedValue(null);

      const mockCheckpoint = createMockCheckpoint();
      const config = {
        configurable: {
          thread_id: "test-thread",
        },
      };
      const mockMetadata = createMockMetadata();
      const mockVersions = createMockVersions();

      await expect(
        checkpointer.put(config, mockCheckpoint, mockMetadata, mockVersions)
      ).rejects.toThrow(
        "Cannot store checkpoint without user ID and proposal ID"
      );
    });

    it("should throw error when proposal ID is not available", async () => {
      mockProposalIdGetter.mockResolvedValue(null);

      const mockCheckpoint = createMockCheckpoint();
      const config = {
        configurable: {
          thread_id: "test-thread",
        },
      };
      const mockMetadata = createMockMetadata();
      const mockVersions = createMockVersions();

      await expect(
        checkpointer.put(config, mockCheckpoint, mockMetadata, mockVersions)
      ).rejects.toThrow(
        "Cannot store checkpoint without user ID and proposal ID"
      );
    });

    it("should handle Supabase errors when storing checkpoint", async () => {
      // Simulate a database error
      mockSupabaseClient.upsert.mockResolvedValueOnce({
        error: { message: "Database error" },
      });

      const mockCheckpoint = createMockCheckpoint();
      const config = {
        configurable: {
          thread_id: "test-thread",
        },
      };
      const mockMetadata = createMockMetadata();
      const mockVersions = createMockVersions();

      await expect(
        checkpointer.put(config, mockCheckpoint, mockMetadata, mockVersions)
      ).rejects.toThrow("Error storing checkpoint: Database error");

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to store checkpoint after all retries",
        expect.objectContaining({
          threadId: "test-thread",
          error: expect.any(Error),
        })
      );
    });

    it("should handle session activity update errors gracefully", async () => {
      // First upsert succeeds (checkpoint)
      mockSupabaseClient.upsert.mockResolvedValueOnce({ error: null });

      // Second upsert fails (session)
      mockSupabaseClient.upsert.mockResolvedValueOnce({
        error: { message: "Session error" },
      });

      const mockCheckpoint = createMockCheckpoint();
      const config = {
        configurable: {
          thread_id: "test-thread",
        },
      };
      const mockMetadata = createMockMetadata();
      const mockVersions = createMockVersions();

      // Should not throw despite session error
      await checkpointer.put(
        config,
        mockCheckpoint,
        mockMetadata,
        mockVersions
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Error updating session activity",
        expect.objectContaining({
          threadId: "test-thread",
          error: "Session error",
        })
      );
    });
  });

  describe("delete", () => {
    it("should delete checkpoint from Supabase", async () => {
      mockSupabaseClient.delete.mockResolvedValue({ error: null });

      await checkpointer.delete("test-thread");

      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "proposal_checkpoints"
      );
      expect(mockSupabaseClient.delete).toHaveBeenCalled();
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith(
        "thread_id",
        "test-thread"
      );
    });

    it("should handle Supabase errors when deleting checkpoint", async () => {
      // Simulate a database error
      mockSupabaseClient.delete.mockResolvedValue({
        error: { message: "Delete error" },
      });

      // Should not throw despite delete error
      await checkpointer.delete("test-thread");

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to delete checkpoint after all retries",
        expect.objectContaining({
          threadId: "test-thread",
          error: expect.any(Error),
        })
      );
    });

    it("should use retry mechanism for delete operations", async () => {
      mockSupabaseClient.delete.mockResolvedValue({ error: null });

      await checkpointer.delete("test-thread");

      // Check that withRetry was called with the right parameters
      expect(withRetry).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          maxRetries: 3,
          initialDelayMs: 500,
          logger: mockLogger,
        })
      );
    });
  });

  describe("listNamespaces", () => {
    it("should return an empty array", async () => {
      const result = await checkpointer.listNamespaces();
      expect(result).toEqual([]);
    });

    it("should accept optional parameters", async () => {
      const result = await checkpointer.listNamespaces("test", "prefix");
      expect(result).toEqual([]);
    });
  });
});
