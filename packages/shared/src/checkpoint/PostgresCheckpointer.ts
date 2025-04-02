/**
 * PostgresCheckpointer for Supabase integration
 *
 * This implementation provides a checkpoint adapter for LangGraph that persists
 * state in a Supabase PostgreSQL database. It implements the BaseCheckpointSaver
 * interface from LangGraph.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import {
  BaseCheckpointSaver,
  CheckpointTuple,
  NamespaceMatchType,
  PendingWrite,
  PutOperation,
  GetOperation,
  ListNamespacesOperation,
  OperationResults,
} from "@langchain/langgraph";
import { SupabaseConnectionPool } from "./supabaseClient";

/**
 * Configuration options for PostgresCheckpointer
 */
export interface PostgresCheckpointerConfig {
  /**
   * Supabase URL (e.g., 'https://your-project-id.supabase.co')
   */
  supabaseUrl: string;

  /**
   * Supabase service role key or anon key with proper permissions
   */
  supabaseKey: string;

  /**
   * Optional table name (defaults to 'proposal_checkpoints')
   */
  tableName?: string;

  /**
   * Optional user ID for row-level security
   */
  userId?: string;

  /**
   * Optional existing connection pool
   */
  connectionPool?: SupabaseConnectionPool;
}

/**
 * A checkpoint saver that uses Supabase PostgreSQL for persistence
 * Implements BaseCheckpointSaver interface from LangGraph
 */
export class PostgresCheckpointer implements BaseCheckpointSaver {
  private connectionPool: SupabaseConnectionPool;
  private tableName: string;
  private userId?: string;

  /**
   * Create a new PostgresCheckpointer
   * @param config PostgresCheckpointerConfig
   */
  constructor(config: PostgresCheckpointerConfig) {
    // Use provided connection pool or create a new one
    this.connectionPool =
      config.connectionPool ||
      SupabaseConnectionPool.getInstance({
        supabaseUrl: config.supabaseUrl,
        supabaseKey: config.supabaseKey,
      });
    this.tableName = config.tableName || "proposal_checkpoints";
    this.userId = config.userId;
  }

  /**
   * Get a Supabase client from the connection pool
   * @returns SupabaseClient
   */
  private getClient(): SupabaseClient {
    return this.connectionPool.getClient();
  }

  /**
   * Release a Supabase client back to the connection pool
   * @param client SupabaseClient
   */
  private releaseClient(client: SupabaseClient): void {
    this.connectionPool.releaseClient(client);
  }

  /**
   * Put a checkpoint tuple into storage
   * @param op PutOperation
   * @returns Promise<void>
   */
  async put(op: PutOperation): Promise<void> {
    const { namespace, state, writes } = op;
    const client = this.getClient();

    try {
      // Serialize writes if present
      const serializedWrites = writes ? JSON.stringify(writes) : null;

      // Extract proposal_id from namespace if it's in the expected format
      // Expected format: proposal:{proposal_id}
      const proposalId = this.extractProposalId(namespace);

      // Base record to insert/update
      const record = {
        namespace,
        state: JSON.stringify(state),
        writes: serializedWrites,
        updated_at: new Date().toISOString(),
        user_id: this.userId || null,
        proposal_id: proposalId,
      };

      // Insert or update the record
      const { error } = await client.from(this.tableName).upsert(record, {
        onConflict: "namespace",
        ignoreDuplicates: false,
      });

      if (error) {
        throw new Error(`Failed to save checkpoint: ${error.message}`);
      }
    } finally {
      // Always release the client back to the pool
      this.releaseClient(client);
    }
  }

  /**
   * Get a checkpoint tuple from storage
   * @param op GetOperation
   * @returns Promise<CheckpointTuple | null>
   */
  async get(op: GetOperation): Promise<CheckpointTuple | null> {
    const { namespace } = op;
    const client = this.getClient();

    try {
      const { data, error } = await client
        .from(this.tableName)
        .select("state, writes")
        .eq("namespace", namespace)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to retrieve checkpoint: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      // Parse the state and writes
      const state = JSON.parse(data.state);
      const writes = data.writes
        ? (JSON.parse(data.writes) as PendingWrite[])
        : null;

      return { namespace, state, writes };
    } finally {
      // Always release the client back to the pool
      this.releaseClient(client);
    }
  }

  /**
   * List namespaces that match the given criteria
   * @param op ListNamespacesOperation
   * @returns Promise<string[]>
   */
  async listNamespaces(op: ListNamespacesOperation): Promise<string[]> {
    const { match, matchType } = op;
    const client = this.getClient();

    try {
      // Base query
      let query = client.from(this.tableName).select("namespace");

      // Apply user_id filter if available
      if (this.userId) {
        query = query.eq("user_id", this.userId);
      }

      // Apply namespace matching based on matchType
      if (match) {
        switch (matchType) {
          case NamespaceMatchType.EXACT:
            query = query.eq("namespace", match);
            break;
          case NamespaceMatchType.PREFIX:
            query = query.ilike("namespace", `${match}%`);
            break;
          case NamespaceMatchType.SUFFIX:
            query = query.ilike("namespace", `%${match}`);
            break;
          case NamespaceMatchType.CONTAINS:
            query = query.ilike("namespace", `%${match}%`);
            break;
        }
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to list namespaces: ${error.message}`);
      }

      return data.map((item) => item.namespace);
    } finally {
      // Always release the client back to the pool
      this.releaseClient(client);
    }
  }

  /**
   * Extract proposal ID from namespace string
   * @param namespace The namespace string
   * @returns The proposal ID or null if not found
   */
  private extractProposalId(namespace: string): string | null {
    // Expected format: proposal:{proposal_id}
    const match = namespace.match(/^proposal:([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }

  /**
   * Execute multiple operations in batch
   * @param operations Array of PutOperation, GetOperation, or ListNamespacesOperation
   * @returns Promise<OperationResults>
   */
  async executeBatch(
    operations: Array<PutOperation | GetOperation | ListNamespacesOperation>
  ): Promise<OperationResults> {
    const results: OperationResults = {
      puts: [],
      gets: [],
      listNamespaces: [],
    };

    const client = this.getClient();

    try {
      // Execute operations sequentially
      // Note: In a production implementation, this could be optimized with batching
      for (const op of operations) {
        if ("state" in op) {
          // It's a PutOperation
          await this.put(op);
          results.puts.push(undefined);
        } else if ("namespace" in op && !("match" in op)) {
          // It's a GetOperation
          const result = await this.get(op);
          results.gets.push(result);
        } else if ("match" in op) {
          // It's a ListNamespacesOperation
          const result = await this.listNamespaces(op);
          results.listNamespaces.push(result);
        }
      }

      return results;
    } finally {
      // Always release the client back to the pool
      this.releaseClient(client);
    }
  }
}
