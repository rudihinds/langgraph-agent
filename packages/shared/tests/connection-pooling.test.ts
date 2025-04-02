import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PostgresCheckpointer } from "../src/checkpoint/PostgresCheckpointer";
import { SupabaseConnectionPool } from "../src/checkpoint/supabaseClient";
import { NamespaceMatchType } from "@langchain/langgraph";

// Mock the Supabase client
vi.mock("@supabase/supabase-js", () => {
  return {
    createClient: vi.fn(() => ({
      from: vi.fn(() => ({
        upsert: vi.fn(() => ({ error: null })),
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => ({
              data: {
                state: JSON.stringify({ test: "data" }),
                writes: JSON.stringify([{ id: 1 }]),
              },
              error: null,
            })),
          })),
          ilike: vi.fn(() => ({
            data: [{ namespace: "test1" }, { namespace: "test2" }],
            error: null,
          })),
        })),
      })),
    })),
  };
});

// Mock the SupabaseConnectionPool
vi.mock("../src/checkpoint/supabaseClient", () => {
  const mockGetClient = vi.fn(() => ({
    from: vi.fn(() => ({
      upsert: vi.fn(() => ({ error: null })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => ({
            data: {
              state: JSON.stringify({ test: "data" }),
              writes: JSON.stringify([{ id: 1 }]),
            },
            error: null,
          })),
        })),
        ilike: vi.fn(() => ({
          data: [{ namespace: "test1" }, { namespace: "test2" }],
          error: null,
        })),
      })),
    })),
  }));

  const mockReleaseClient = vi.fn();

  const mockGetInstance = vi.fn(() => ({
    getClient: mockGetClient,
    releaseClient: mockReleaseClient,
  }));

  return {
    SupabaseConnectionPool: {
      getInstance: mockGetInstance,
    },
  };
});

describe("PostgresCheckpointer with Connection Pooling", () => {
  let checkpointer: PostgresCheckpointer;
  let connectionPool: ReturnType<typeof SupabaseConnectionPool.getInstance>;

  beforeEach(() => {
    vi.clearAllMocks();

    connectionPool = SupabaseConnectionPool.getInstance();

    checkpointer = new PostgresCheckpointer({
      supabaseUrl: "https://test.supabase.co",
      supabaseKey: "test-key",
      userId: "test-user",
    });
  });

  describe("client management", () => {
    it("should get a client from the pool for each operation", async () => {
      // Perform a put operation
      await checkpointer.put({
        namespace: "proposal:123",
        state: { test: "data" },
        writes: null,
      });

      // Verify client was retrieved from pool
      expect(connectionPool.getClient).toHaveBeenCalledTimes(1);

      // Verify client was released back to pool
      expect(connectionPool.releaseClient).toHaveBeenCalledTimes(1);
    });

    it("should release the client even if an error occurs", async () => {
      // Mock an error from the database operation
      const mockClient = connectionPool.getClient();
      const mockFrom = vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({ error: { message: "Test error" } }),
      });

      // @ts-ignore - Mocking implementation details
      mockClient.from = mockFrom;

      // Attempt the operation which will throw
      await expect(
        checkpointer.put({
          namespace: "proposal:123",
          state: { test: "data" },
          writes: null,
        })
      ).rejects.toThrow("Failed to save checkpoint");

      // Verify client was still released
      expect(connectionPool.releaseClient).toHaveBeenCalledTimes(1);
    });
  });

  describe("batch operations", () => {
    it("should reuse a single client for the entire batch", async () => {
      // Perform a batch operation with multiple operations
      await checkpointer.executeBatch([
        {
          namespace: "proposal:123",
          state: { test: "data" },
          writes: null,
        },
        {
          namespace: "proposal:123",
        },
        {
          match: "test",
          matchType: NamespaceMatchType.PREFIX,
        },
      ]);

      // Verify client was retrieved only once for the entire batch
      expect(connectionPool.getClient).toHaveBeenCalledTimes(1);

      // Verify client was released once after the batch
      expect(connectionPool.releaseClient).toHaveBeenCalledTimes(1);
    });
  });
});
