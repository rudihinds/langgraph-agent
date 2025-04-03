import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SupabaseConnectionPool,
  SupabasePoolConfig,
} from "../src/checkpoint/supabaseClient";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Mock the Supabase client
vi.mock("@supabase/supabase-js", () => {
  const mockClient = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({
          data: { user: { id: "test-user" } },
          error: null,
        }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
        getPublicUrl: vi
          .fn()
          .mockReturnValue({
            data: { publicUrl: "https://example.com/file.pdf" },
          }),
      }),
    },
  };

  return {
    createClient: vi.fn().mockImplementation(() => mockClient),
  };
});

describe("SupabaseConnectionPool", () => {
  const testConfig: SupabasePoolConfig = {
    supabaseUrl: "https://example.supabase.co",
    supabaseKey: "test-key",
    maxClients: 3,
    idleTimeoutMillis: 10000,
  };

  let pool: SupabaseConnectionPool;

  beforeEach(() => {
    // Reset the mocks
    vi.clearAllMocks();
    // Create a new pool for each test
    pool = new SupabaseConnectionPool(testConfig);
  });

  afterEach(() => {
    // Clean up after each test
    pool.dispose();
  });

  describe("constructor", () => {
    it("should initialize with the provided configuration", () => {
      expect(pool["config"].supabaseUrl).toBe(testConfig.supabaseUrl);
      expect(pool["config"].supabaseKey).toBe(testConfig.supabaseKey);
      expect(pool["config"].maxClients).toBe(testConfig.maxClients);
      expect(pool["config"].idleTimeoutMillis).toBe(
        testConfig.idleTimeoutMillis
      );
    });

    it("should use default values for optional configuration", () => {
      const minimalPool = new SupabaseConnectionPool({
        supabaseUrl: "https://example.supabase.co",
        supabaseKey: "test-key",
      });

      expect(minimalPool["config"].maxClients).toBe(10); // Default value
      expect(minimalPool["config"].idleTimeoutMillis).toBe(60000); // Default value

      // Clean up
      minimalPool.dispose();
    });
  });

  describe("getClient", () => {
    it("should create a new client when the pool is empty", () => {
      const client = pool.getClient();

      expect(createClient).toHaveBeenCalledWith(
        testConfig.supabaseUrl,
        testConfig.supabaseKey
      );
      expect(pool.size).toBe(1);
    });

    it("should reuse existing client when available", () => {
      // Get two clients
      const client1 = pool.getClient();
      const client2 = pool.getClient();

      // Should have created two clients
      expect(createClient).toHaveBeenCalledTimes(2);
      expect(pool.size).toBe(2);

      // Reset the mock to check if a third client is created
      vi.mocked(createClient).mockClear();

      // Release and get another client - should reuse an existing one
      pool.releaseClient(client1);
      const client3 = pool.getClient();

      // No new client should have been created
      expect(createClient).not.toHaveBeenCalled();
      expect(pool.size).toBe(2);
    });

    it("should create new clients up to the maxClients limit", () => {
      // Get clients up to the max (3 in our test config)
      const client1 = pool.getClient();
      const client2 = pool.getClient();
      const client3 = pool.getClient();

      expect(createClient).toHaveBeenCalledTimes(3);
      expect(pool.size).toBe(3);

      // Reset the mock
      vi.mocked(createClient).mockClear();

      // Try to get another client - should reuse the least recently used one
      const client4 = pool.getClient();

      // No new client should have been created since we're at the limit
      expect(createClient).not.toHaveBeenCalled();
      expect(pool.size).toBe(3);
    });

    it("should force create a new client when requested", () => {
      // Get one client normally
      const client1 = pool.getClient();
      expect(createClient).toHaveBeenCalledTimes(1);

      // Reset the mock
      vi.mocked(createClient).mockClear();

      // Force a new client
      const client2 = pool.getClient({ forceNew: true });

      // Should have created a new client
      expect(createClient).toHaveBeenCalledTimes(1);

      // But the pool size should still be 1 since forced clients aren't added to the pool
      expect(pool.size).toBe(1);
    });
  });

  describe("releaseClient", () => {
    it("should update the lastUsed time for a released client", () => {
      // Mock Date.now
      const realDateNow = Date.now;
      const mockDateNow = vi
        .fn()
        .mockReturnValueOnce(1000) // First call when getting client
        .mockReturnValueOnce(2000); // Second call when releasing client

      Date.now = mockDateNow;

      // Get a client
      const client = pool.getClient();

      // Find the entry in the pool
      const entries = Array.from(pool["pool"].entries());
      const initialTime = entries[0][1].lastUsed;
      expect(initialTime).toBe(1000);

      // Release the client
      pool.releaseClient(client);

      // Check if lastUsed was updated
      const updatedEntries = Array.from(pool["pool"].entries());
      const updatedTime = updatedEntries[0][1].lastUsed;
      expect(updatedTime).toBe(2000);

      // Restore Date.now
      Date.now = realDateNow;
    });

    it("should do nothing if the client is not in the pool", () => {
      // Create a client but not from our pool
      const externalClient = createClient(
        "https://external.supabase.co",
        "external-key"
      );

      // Try to release it
      pool.releaseClient(externalClient as SupabaseClient);

      // Pool should be empty
      expect(pool.size).toBe(0);
    });
  });

  describe("cleanup", () => {
    it("should remove idle clients", async () => {
      // Mock Date.now
      const realDateNow = Date.now;
      let mockTime = 1000;
      Date.now = vi.fn().mockImplementation(() => mockTime);

      // Get three clients with different lastUsed times
      const client1 = pool.getClient();
      mockTime = 2000;
      const client2 = pool.getClient();
      mockTime = 3000;
      const client3 = pool.getClient();

      expect(pool.size).toBe(3);

      // Simulate time passing - more than the idle timeout
      mockTime = 15000; // 15 seconds later

      // Manually run cleanup
      pool["cleanup"]();

      // Should have removed the two oldest clients, keeping only the newest one
      expect(pool.size).toBe(1);

      // Restore Date.now
      Date.now = realDateNow;
    });

    it("should keep at least one client", async () => {
      // Mock Date.now
      const realDateNow = Date.now;
      let mockTime = 1000;
      Date.now = vi.fn().mockImplementation(() => mockTime);

      // Get a client
      const client = pool.getClient();

      expect(pool.size).toBe(1);

      // Simulate time passing - more than the idle timeout
      mockTime = 15000; // 15 seconds later

      // Manually run cleanup
      pool["cleanup"]();

      // Should still have one client
      expect(pool.size).toBe(1);

      // Restore Date.now
      Date.now = realDateNow;
    });
  });

  describe("clear", () => {
    it("should remove all clients from the pool", () => {
      // Get a few clients
      const client1 = pool.getClient();
      const client2 = pool.getClient();

      expect(pool.size).toBe(2);

      // Clear the pool
      pool.clear();

      expect(pool.size).toBe(0);
    });
  });

  describe("dispose", () => {
    it("should clear the pool and cancel the cleanup interval", () => {
      // Spy on clearInterval
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");

      // Get a client
      const client = pool.getClient();

      expect(pool.size).toBe(1);
      expect(pool["cleanupInterval"]).not.toBeNull();

      // Dispose the pool
      pool.dispose();

      expect(pool.size).toBe(0);
      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(pool["cleanupInterval"]).toBeNull();

      // Restore the spy
      clearIntervalSpy.mockRestore();
    });
  });

  describe("getInstance", () => {
    it("should create a singleton instance on first call", () => {
      // Reset singleton before test
      SupabaseConnectionPool["instance"] = null;

      const instance1 = SupabaseConnectionPool.getInstance(testConfig);

      expect(instance1).toBeInstanceOf(SupabaseConnectionPool);
      expect(instance1["config"].supabaseUrl).toBe(testConfig.supabaseUrl);
    });

    it("should return the same instance on subsequent calls", () => {
      // Reset singleton before test
      SupabaseConnectionPool["instance"] = null;

      const instance1 = SupabaseConnectionPool.getInstance(testConfig);
      const instance2 = SupabaseConnectionPool.getInstance();

      expect(instance2).toBe(instance1);
    });

    it("should throw an error if config is not provided on first call", () => {
      // Reset singleton before test
      SupabaseConnectionPool["instance"] = null;

      expect(() => {
        SupabaseConnectionPool.getInstance();
      }).toThrow("Configuration is required for the first getInstance call");
    });
  });
});
