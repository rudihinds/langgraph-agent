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

    it("should call Supabase with correct parameters", async () => {
      // Mock successful response
      mockSupabaseClient.single.mockResolvedValue({
        data: { checkpoint_data: { state: { foo: "bar" } } },
        error: null,
      });

      const config = { configurable: { thread_id: "test-thread-id" } };
      await checkpointer.get(config);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "proposal_checkpoints"
      );
      expect(mockSupabaseClient.select).toHaveBeenCalledWith("checkpoint_data");
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith(
        "thread_id",
        "test-thread-id"
      );
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
  });

  describe("listNamespaces method", () => {
    it("should return an empty array", async () => {
      const result = await checkpointer.listNamespaces();
      expect(result).toEqual([]);
    });
  });
});
