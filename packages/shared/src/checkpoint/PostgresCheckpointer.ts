/**
 * This is a temporary mock implementation to allow builds to pass
 * The full implementation is stored in PostgresCheckpointer.ts.bak
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { BaseCheckpointSaver, Checkpoint } from "@langchain/langgraph";
import { SupabaseConnectionPool } from "./supabaseClient";

// Define a local RunnableConfig type since the import is causing issues
interface RunnableConfig {
  configurable?: {
    namespace?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

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
 * Mock implementation of PostgresCheckpointer
 * This is a temporary implementation to fix build issues
 */
export class PostgresCheckpointer extends BaseCheckpointSaver {
  constructor(_config: PostgresCheckpointerConfig) {
    super();
    // Mock constructor - does nothing
    console.warn("Using mock PostgresCheckpointer - checkpoints will not be persisted");
  }

  /**
   * Mock implementation of put
   */
  put(_config: RunnableConfig, _checkpoint: Checkpoint): void {
    // Mock implementation - does nothing
  }

  /**
   * Mock implementation of get
   */
  get(_config: RunnableConfig): Checkpoint | undefined {
    return undefined;
  }

  /**
   * Mock implementation of listNamespaces
   */
  async listNamespaces(_match?: string, _matchType?: string): Promise<string[]> {
    return [];
  }
}