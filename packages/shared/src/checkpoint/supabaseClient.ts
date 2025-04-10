/**
 * Supabase client connection pool
 *
 * This module provides a connection pool for Supabase clients to improve
 * performance and reliability by reusing connections.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Configuration for the Supabase connection pool
 */
export interface SupabasePoolConfig {
  /**
   * Supabase URL
   */
  supabaseUrl: string;

  /**
   * Supabase API key
   */
  supabaseKey: string;

  /**
   * Maximum number of clients in the pool
   * @default 10
   */
  maxClients?: number;

  /**
   * Time in milliseconds after which idle clients are released
   * @default 60000 (1 minute)
   */
  idleTimeoutMillis?: number;
}

/**
 * Connection pool for Supabase clients
 */
export class SupabaseConnectionPool {
  private pool: Map<string, { client: SupabaseClient; lastUsed: number }> =
    new Map();
  private config: Required<SupabasePoolConfig>;
  private cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Create a new Supabase connection pool
   *
   * @param config Pool configuration
   */
  constructor(config: SupabasePoolConfig) {
    this.config = {
      maxClients: 10,
      idleTimeoutMillis: 60000, // 1 minute
      ...config,
    };

    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Get a client from the pool or create a new one
   *
   * @param options Additional options
   * @returns Supabase client
   */
  getClient(options?: { forceNew?: boolean }): SupabaseClient {
    const now = Date.now();

    // Force new client if requested
    if (options?.forceNew) {
      return this.createClient();
    }

    // Check if we have an available client
    if (this.pool.size < this.config.maxClients) {
      // Create a new client if we haven't reached the limit
      const client = this.createClient();
      const id = `client-${this.pool.size + 1}`;
      this.pool.set(id, { client, lastUsed: now });
      return client;
    }

    // Find the least recently used client
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    for (const [id, { lastUsed }] of this.pool.entries()) {
      if (lastUsed < oldestTime) {
        oldestTime = lastUsed;
        oldestId = id;
      }
    }

    if (oldestId) {
      // Update last used time
      const entry = this.pool.get(oldestId)!;
      entry.lastUsed = now;
      return entry.client;
    }

    // Should never reach here, but just in case
    return this.createClient();
  }

  /**
   * Release a client back to the pool
   *
   * @param client The client to release
   */
  releaseClient(client: SupabaseClient): void {
    // Find the client in the pool
    for (const [id, entry] of this.pool.entries()) {
      if (entry.client === client) {
        // Update last used time
        entry.lastUsed = Date.now();
        break;
      }
    }
  }

  /**
   * Clear all clients from the pool
   */
  clear(): void {
    this.pool.clear();
  }

  /**
   * Get the current pool size
   */
  get size(): number {
    return this.pool.size;
  }

  /**
   * Start the cleanup interval
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(
      () => {
        this.cleanup();
      },
      Math.max(this.config.idleTimeoutMillis / 2, 5000)
    );
  }

  /**
   * Clean up idle clients
   */
  private cleanup(): void {
    const now = Date.now();
    const threshold = now - this.config.idleTimeoutMillis;

    // Keep at least one client in the pool
    if (this.pool.size <= 1) {
      return;
    }

    // Find idle clients
    const toRemove: string[] = [];

    for (const [id, { lastUsed }] of this.pool.entries()) {
      if (lastUsed < threshold) {
        toRemove.push(id);
      }
    }

    // Remove idle clients, but keep at least one
    for (let i = 0; i < Math.min(toRemove.length, this.pool.size - 1); i++) {
      this.pool.delete(toRemove[i]);
    }
  }

  /**
   * Create a new Supabase client
   */
  private createClient(): SupabaseClient {
    return createClient(this.config.supabaseUrl, this.config.supabaseKey);
  }

  /**
   * Clean up resources when the pool is no longer needed
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.pool.clear();
  }

  /**
   * Create a singleton connection pool instance
   */
  private static instance: SupabaseConnectionPool | null = null;

  /**
   * Get or create the global connection pool
   *
   * @param config Pool configuration (required only on first call)
   * @returns The global connection pool instance
   */
  static getInstance(config?: SupabasePoolConfig): SupabaseConnectionPool {
    if (!SupabaseConnectionPool.instance && !config) {
      throw new Error(
        "Configuration is required for the first getInstance call"
      );
    }

    if (!SupabaseConnectionPool.instance && config) {
      SupabaseConnectionPool.instance = new SupabaseConnectionPool(config);
    }

    return SupabaseConnectionPool.instance!;
  }
}
