/**
 * Supabase Checkpointer
 *
 * An implementation of checkpoint storage that persists
 * checkpoints in a Supabase database.
 */
import { SupabaseClient } from "@supabase/supabase-js";
// Note: We don't import BaseCheckpointSaver here as this is our basic implementation
// The adapter classes handle the LangGraph interface compatibility

interface CheckpointRecord {
  id: string;
  thread_id: string;
  user_id: string;
  proposal_id?: string;
  data: unknown;
  created_at: string;
  updated_at: string;
  size_bytes?: number;
}

/**
 * Options for configuring the SupabaseCheckpointer
 */
export interface SupabaseCheckpointerOptions {
  /** Supabase client instance */
  client: SupabaseClient;
  /** Table name to store checkpoints in */
  tableName: string;
  /** Table name to store session data in */
  sessionTableName?: string;
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Initial delay between retries in ms */
  retryDelayMs?: number;
  /** Function to get the current user ID */
  userIdGetter: () => Promise<string>;
  /** Function to get the proposal ID for a thread */
  proposalIdGetter: (threadId: string) => Promise<string | null>;
}

/**
 * Checkpointer implementation that stores checkpoints in Supabase
 */
export class SupabaseCheckpointer {
  private client: SupabaseClient;
  private tableName: string;
  private sessionTableName: string;
  private maxRetries: number;
  private retryDelayMs: number;
  private userIdGetter: () => Promise<string>;
  private proposalIdGetter: (threadId: string) => Promise<string | null>;

  /**
   * Create a new SupabaseCheckpointer
   *
   * @param options Configuration options or individual parameters
   */
  constructor(options: SupabaseCheckpointerOptions);
  constructor(
    clientOrOptions: SupabaseClient | SupabaseCheckpointerOptions,
    userId?: string,
    proposalId?: string,
    tableName?: string
  ) {
    // Handle options object constructor
    if (typeof clientOrOptions !== "function" && "client" in clientOrOptions) {
      const options = clientOrOptions as SupabaseCheckpointerOptions;
      this.client = options.client;
      this.tableName = options.tableName;
      this.sessionTableName = options.sessionTableName || "proposal_sessions";
      this.maxRetries = options.maxRetries || 3;
      this.retryDelayMs = options.retryDelayMs || 500;
      this.userIdGetter = options.userIdGetter;
      this.proposalIdGetter = options.proposalIdGetter;
    }
    // Handle individual parameters constructor (legacy)
    else {
      this.client = clientOrOptions as SupabaseClient;
      this.tableName = tableName || "proposal_checkpoints";
      this.sessionTableName = "proposal_sessions";
      this.maxRetries = 3;
      this.retryDelayMs = 500;

      const userIdValue = userId || "anonymous";
      this.userIdGetter = async () => userIdValue;

      const proposalIdValue = proposalId;
      this.proposalIdGetter = async () => proposalIdValue || null;
    }
  }

  /**
   * Store a checkpoint in Supabase
   *
   * @param threadId - Thread ID to store the checkpoint under
   * @param checkpoint - Checkpoint data to store
   * @returns The stored checkpoint
   */
  async put(threadId: string, checkpoint: unknown): Promise<unknown> {
    const stringifiedData = JSON.stringify(checkpoint);
    const sizeBytes = new TextEncoder().encode(stringifiedData).length;
    const userId = await this.userIdGetter();
    const proposalId = await this.proposalIdGetter(threadId);

    const { data, error } = await this.client.from(this.tableName).upsert(
      {
        thread_id: threadId,
        user_id: userId,
        proposal_id: proposalId,
        checkpoint_data: checkpoint,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "thread_id" }
    );

    if (error) {
      throw new Error(`Failed to store checkpoint: ${error.message}`);
    }

    return checkpoint;
  }

  /**
   * Retrieve a checkpoint from Supabase
   *
   * @param threadId - Thread ID to retrieve the checkpoint for
   * @returns The checkpoint data, or null if not found
   */
  async get(threadId: string): Promise<unknown> {
    const userId = await this.userIdGetter();

    const { data, error } = await this.client
      .from(this.tableName)
      .select("checkpoint_data")
      .eq("thread_id", threadId)
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // PGRST116 is the error code for "no rows returned"
        return null;
      }
      throw new Error(`Failed to retrieve checkpoint: ${error.message}`);
    }

    return data?.checkpoint_data || null;
  }

  /**
   * List all thread IDs with checkpoints for the current user
   *
   * @returns Array of thread IDs
   */
  async list(): Promise<string[]> {
    const userId = await this.userIdGetter();

    const query = this.client
      .from(this.tableName)
      .select("thread_id")
      .eq("user_id", userId);

    // Add proposal filter if available from a recent threadId
    const proposalId = await this.proposalIdGetter("recent");
    if (proposalId) {
      query.eq("proposal_id", proposalId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list checkpoints: ${error.message}`);
    }

    return data.map((record) => record.thread_id);
  }

  /**
   * List checkpoint namespaces matching a pattern
   *
   * @param match Optional pattern to match
   * @param matchType Optional type of matching to perform
   * @returns Array of namespace strings
   */
  async listNamespaces(match?: string, matchType?: string): Promise<string[]> {
    // For basic implementation, namespaces are the same as thread IDs
    return this.list();
  }

  /**
   * Delete a checkpoint from Supabase
   *
   * @param threadId - Thread ID to delete the checkpoint for
   */
  async delete(threadId: string): Promise<void> {
    const userId = await this.userIdGetter();

    const { error } = await this.client
      .from(this.tableName)
      .delete()
      .eq("thread_id", threadId)
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to delete checkpoint: ${error.message}`);
    }
  }
}
