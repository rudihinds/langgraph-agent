import { PostgresCheckpointer } from "../postgres-checkpointer";
import { createClient } from "@supabase/supabase-js";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// Mock the Supabase client
vi.mock("@supabase/supabase-js", () => {
  return {
    createClient: vi.fn(() => mockSupabaseClient),
  };
});

// Mock the uuid module
vi.mock("uuid", () => {
  return {
    v4: vi.fn(() => "mocked-uuid"),
  };
});

// Mock our supabase-client module
vi.mock("../supabase-client", () => {
  return {
    createServerClient: vi.fn(() => mockSupabaseClient),
    generateThreadId: vi.fn(
      (proposalId, suffix) =>
        `proposal_${proposalId}${suffix ? `_${suffix}` : ""}`
    ),
    withErrorHandling: vi.fn(async (operation) => {
      const result = await operation();
      return result.data;
    }),
  };
});

// Create a mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(() => mockSupabaseClient),
  select: vi.fn(() => mockSupabaseClient),
  insert: vi.fn(() => Promise.resolve({ data: {}, error: null })),
  eq: vi.fn(() => mockSupabaseClient),
  order: vi.fn(() => mockSupabaseClient),
  limit: vi.fn(() => mockSupabaseClient),
  single: vi.fn(() => mockSupabaseClient),
  maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
  delete: vi.fn(() => Promise.resolve({ data: {}, error: null })),
};

describe("PostgresCheckpointer", () => {
  let checkpointer: PostgresCheckpointer;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create a new checkpointer for each test
    checkpointer = new PostgresCheckpointer({ debug: true });

    // Setup default mock behavior
    mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.from.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.insert.mockResolvedValue({ data: {}, error: null });
    mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.order.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.limit.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });
  });

  describe("get_or_create_thread", () => {
    it("should return a thread with the provided ID", async () => {
      const thread = await checkpointer.get_or_create_thread("test-thread");

      expect(thread).toEqual({
        id: "test-thread",
        metadata: {},
      });
    });

    it("should generate a UUID if no thread ID is provided", async () => {
      const thread = await checkpointer.get_or_create_thread();

      expect(thread).toEqual({
        id: "mocked-uuid",
        metadata: {},
      });
    });

    it("should include metadata if provided", async () => {
      const metadata = { foo: "bar" };
      const thread = await checkpointer.get_or_create_thread(
        "test-thread",
        metadata
      );

      expect(thread).toEqual({
        id: "test-thread",
        metadata,
      });
    });
  });

  describe("list_threads", () => {
    it("should return a list of unique threads", async () => {
      mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);
      mockSupabaseClient.from.mockReturnValue(mockSupabaseClient);
      mockSupabaseClient.order.mockReturnValue(mockSupabaseClient);

      // Mock the database response
      const mockThreads = [
        { thread_id: "thread1", metadata: { foo: "bar" } },
        { thread_id: "thread2", metadata: null },
        { thread_id: "thread1", metadata: { foo: "baz" } }, // Duplicate ID
      ];

      mockSupabaseClient.select.mockResolvedValue({
        data: mockThreads,
        error: null,
      });

      const threads = await checkpointer.list_threads();

      // Should call the correct Supabase methods
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("proposal_states");
      expect(mockSupabaseClient.select).toHaveBeenCalledWith(
        "thread_id, metadata"
      );
      expect(mockSupabaseClient.order).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });

      // Should return unique threads
      expect(threads).toHaveLength(2);
      expect(threads[0]).toEqual({
        id: "thread1",
        metadata: { foo: "bar" },
      });
      expect(threads[1]).toEqual({
        id: "thread2",
        metadata: {},
      });
    });
  });

  describe("create_checkpoint", () => {
    it("should store a checkpoint and return it with an ID", async () => {
      const checkpoint = {
        thread_id: "proposal_123",
        values: { foo: "bar" },
        parent_id: "parent-checkpoint",
        metadata: { test: true },
        next: ["next-node"],
        tasks: [{ id: "task1" }],
        config: { test: "config" },
      };

      mockSupabaseClient.insert.mockResolvedValue({ data: {}, error: null });

      const result = await checkpointer.create_checkpoint(checkpoint);

      // Should call the correct Supabase methods
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("proposal_states");
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          proposal_id: "123",
          thread_id: "proposal_123",
          checkpoint_id: "mocked-uuid",
          parent_checkpoint_id: "parent-checkpoint",
          metadata: { test: true },
          values: { foo: "bar" },
          next: ["next-node"],
          tasks: [{ id: "task1" }],
          config: { test: "config" },
        })
      );

      // Should return the checkpoint with an ID
      expect(result).toEqual({
        ...checkpoint,
        id: "mocked-uuid",
      });
    });

    it("should throw an error for invalid thread ID format", async () => {
      const checkpoint = {
        thread_id: "invalid-format",
        values: { foo: "bar" },
      };

      await expect(checkpointer.create_checkpoint(checkpoint)).rejects.toThrow(
        "Invalid thread_id format: invalid-format"
      );
    });
  });

  describe("list_checkpoints", () => {
    it("should return a list of checkpoints for a thread", async () => {
      // Mock the database response
      const mockCheckpoints = [
        {
          checkpoint_id: "cp1",
          thread_id: "thread1",
          parent_checkpoint_id: null,
          values: { foo: "bar" },
          metadata: { test: true },
          next: ["next-node"],
          tasks: [{ id: "task1" }],
          config: { test: "config" },
        },
        {
          checkpoint_id: "cp2",
          thread_id: "thread1",
          parent_checkpoint_id: "cp1",
          values: { foo: "baz" },
          metadata: null,
          next: [],
          tasks: [],
          config: null,
        },
      ];

      mockSupabaseClient.select.mockResolvedValue({
        data: mockCheckpoints,
        error: null,
      });

      const checkpoints = await checkpointer.list_checkpoints("thread1");

      // Should call the correct Supabase methods
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("proposal_states");
      expect(mockSupabaseClient.select).toHaveBeenCalledWith("*");
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith(
        "thread_id",
        "thread1"
      );
      expect(mockSupabaseClient.order).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });

      // Should return formatted checkpoints
      expect(checkpoints).toHaveLength(2);
      expect(checkpoints[0]).toEqual({
        id: "cp1",
        thread_id: "thread1",
        parent_id: null,
        values: { foo: "bar" },
        metadata: { test: true },
        next: ["next-node"],
        tasks: [{ id: "task1" }],
        config: { test: "config" },
      });
      expect(checkpoints[1]).toEqual({
        id: "cp2",
        thread_id: "thread1",
        parent_id: "cp1",
        values: { foo: "baz" },
        metadata: {},
        next: [],
        tasks: [],
        config: {},
      });
    });

    it("should respect limit option", async () => {
      await checkpointer.list_checkpoints("thread1", { limit: 5 });

      expect(mockSupabaseClient.limit).toHaveBeenCalledWith(5);
    });

    it("should respect ascending option", async () => {
      await checkpointer.list_checkpoints("thread1", { ascending: true });

      expect(mockSupabaseClient.order).toHaveBeenCalledWith("created_at", {
        ascending: true,
      });
    });
  });

  describe("get_checkpoint", () => {
    it("should return null if checkpoint not found", async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      const checkpoint = await checkpointer.get_checkpoint(
        "thread1",
        "checkpoint1"
      );

      expect(checkpoint).toBeNull();
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("proposal_states");
      expect(mockSupabaseClient.select).toHaveBeenCalledWith("*");
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith(
        "thread_id",
        "thread1"
      );
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith(
        "checkpoint_id",
        "checkpoint1"
      );
    });

    it("should return formatted checkpoint if found", async () => {
      const mockCheckpoint = {
        checkpoint_id: "checkpoint1",
        thread_id: "thread1",
        parent_checkpoint_id: "parent1",
        values: { foo: "bar" },
        metadata: { test: true },
        next: ["next-node"],
        tasks: [{ id: "task1" }],
        config: { test: "config" },
      };

      mockSupabaseClient.maybeSingle.mockResolvedValue({
        data: mockCheckpoint,
        error: null,
      });

      const checkpoint = await checkpointer.get_checkpoint(
        "thread1",
        "checkpoint1"
      );

      expect(checkpoint).toEqual({
        id: "checkpoint1",
        thread_id: "thread1",
        parent_id: "parent1",
        values: { foo: "bar" },
        metadata: { test: true },
        next: ["next-node"],
        tasks: [{ id: "task1" }],
        config: { test: "config" },
      });
    });

    it("should throw if database returns an error", async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      });

      await expect(
        checkpointer.get_checkpoint("thread1", "checkpoint1")
      ).rejects.toThrow("Failed to get checkpoint: Database error");
    });
  });

  describe("delete_thread", () => {
    it("should delete all checkpoints for a thread", async () => {
      mockSupabaseClient.delete.mockResolvedValue({ data: {}, error: null });

      await checkpointer.delete_thread("thread1");

      expect(mockSupabaseClient.from).toHaveBeenCalledWith("proposal_states");
      expect(mockSupabaseClient.delete).toHaveBeenCalled();
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith(
        "thread_id",
        "thread1"
      );
    });
  });

  describe("get_latest_checkpoint", () => {
    it("should return the most recent checkpoint for a thread", async () => {
      const mockCheckpoint = {
        checkpoint_id: "checkpoint1",
        thread_id: "thread1",
        parent_checkpoint_id: "parent1",
        values: { foo: "bar" },
        metadata: { test: true },
        next: ["next-node"],
        tasks: [{ id: "task1" }],
        config: { test: "config" },
      };

      mockSupabaseClient.maybeSingle.mockResolvedValue({
        data: mockCheckpoint,
        error: null,
      });

      const checkpoint = await checkpointer.get_latest_checkpoint("thread1");

      expect(mockSupabaseClient.from).toHaveBeenCalledWith("proposal_states");
      expect(mockSupabaseClient.select).toHaveBeenCalledWith("*");
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith(
        "thread_id",
        "thread1"
      );
      expect(mockSupabaseClient.order).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });
      expect(mockSupabaseClient.limit).toHaveBeenCalledWith(1);

      expect(checkpoint).toEqual({
        id: "checkpoint1",
        thread_id: "thread1",
        parent_id: "parent1",
        values: { foo: "bar" },
        metadata: { test: true },
        next: ["next-node"],
        tasks: [{ id: "task1" }],
        config: { test: "config" },
      });
    });

    it("should return null if no checkpoints exist", async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      const checkpoint = await checkpointer.get_latest_checkpoint("thread1");

      expect(checkpoint).toBeNull();
    });
  });
});
