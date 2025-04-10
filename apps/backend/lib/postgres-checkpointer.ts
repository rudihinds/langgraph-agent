import { SupabaseClient } from "@supabase/supabase-js";
import {
  Checkpointer,
  Checkpoint,
  BaseCheckpoint,
  ListCheckpointsOptions,
  Thread,
} from "@langchain/langgraph";
import { v4 as uuidv4 } from "uuid";
import {
  createServerClient,
  generateThreadId,
  withErrorHandling,
} from "./supabase-client.js";
import type { Database } from "./database.types.js";

/**
 * Options for the PostgresCheckpointer
 */
export interface PostgresCheckpointerOptions {
  /** Custom Supabase client (optional) */
  client?: SupabaseClient<Database>;
  /** Flag to enable debug logging */
  debug?: boolean;
}

/**
 * PostgresCheckpointer implements LangGraph's Checkpointer interface
 * using Supabase PostgreSQL as the storage backend.
 */
export class PostgresCheckpointer implements Checkpointer {
  private client: SupabaseClient<Database>;
  private debug: boolean;

  /**
   * Creates a new PostgresCheckpointer instance
   * @param options - Configuration options
   */
  constructor(options: PostgresCheckpointerOptions = {}) {
    this.client = options.client || createServerClient();
    this.debug = options.debug || false;

    if (this.debug) {
      console.log("[PostgresCheckpointer] Initialized");
    }
  }

  /**
   * Creates a thread or returns an existing one with the given ID
   * @param threadId - Optional thread ID
   * @param metadata - Optional metadata to store with the thread
   * @returns The created or retrieved thread
   */
  async get_or_create_thread(
    threadId?: string,
    metadata?: Record<string, any>
  ): Promise<Thread> {
    try {
      const actualThreadId = threadId || uuidv4();

      if (this.debug) {
        console.log(
          `[PostgresCheckpointer] Getting or creating thread: ${actualThreadId}`
        );
      }

      // We don't explicitly create thread entries since they're implied by checkpoints
      // Just return a Thread object with the ID
      return {
        id: actualThreadId,
        metadata: metadata || {},
      };
    } catch (err) {
      console.error(
        "[PostgresCheckpointer] Failed to get or create thread:",
        err
      );
      throw err;
    }
  }

  /**
   * Lists all threads
   * @returns List of threads
   */
  async list_threads(): Promise<Thread[]> {
    try {
      if (this.debug) {
        console.log("[PostgresCheckpointer] Listing threads");
      }

      // Query unique thread_ids and their metadata from proposal_states
      const threads = await withErrorHandling(
        () =>
          this.client
            .from("proposal_states")
            .select("thread_id, metadata")
            .order("created_at", { ascending: false }),
        "Failed to list threads"
      );

      // Group by thread_id and collect unique threads with their metadata
      const uniqueThreads = new Map<string, Thread>();

      for (const row of threads) {
        if (!uniqueThreads.has(row.thread_id)) {
          uniqueThreads.set(row.thread_id, {
            id: row.thread_id,
            metadata: row.metadata || {},
          });
        }
      }

      return Array.from(uniqueThreads.values());
    } catch (err) {
      console.error("[PostgresCheckpointer] Failed to list threads:", err);
      throw err;
    }
  }

  /**
   * Stores a checkpoint in the database
   * @param checkpoint - The checkpoint to store
   * @returns The stored checkpoint
   */
  async create_checkpoint(checkpoint: BaseCheckpoint): Promise<Checkpoint> {
    try {
      if (this.debug) {
        console.log(
          `[PostgresCheckpointer] Creating checkpoint for thread ${checkpoint.thread_id}`
        );
      }

      // Extract the proposal_id from the thread_id if it follows our pattern
      let proposalId: string | null = null;
      if (checkpoint.thread_id.startsWith("proposal_")) {
        // Extract proposal_id from "proposal_{id}" or "proposal_{id}_{suffix}"
        const parts = checkpoint.thread_id.split("_");
        if (parts.length >= 2) {
          proposalId = parts[1];
        }
      }

      if (!proposalId) {
        throw new Error(
          `Invalid thread_id format: ${checkpoint.thread_id}. Expected format: proposal_{id} or proposal_{id}_{suffix}`
        );
      }

      // Store the checkpoint in the database
      const checkpointId = checkpoint.id || uuidv4();

      const checkpointRecord = {
        id: uuidv4(), // DB record id
        proposal_id: proposalId,
        thread_id: checkpoint.thread_id,
        checkpoint_id: checkpointId,
        parent_checkpoint_id: checkpoint.parent_id || null,
        metadata: checkpoint.metadata || null,
        values: checkpoint.values,
        next: checkpoint.next || [],
        tasks: checkpoint.tasks || [],
        config: checkpoint.config || null,
      };

      await withErrorHandling(
        () => this.client.from("proposal_states").insert(checkpointRecord),
        `Failed to store checkpoint ${checkpointId}`
      );

      return {
        ...checkpoint,
        id: checkpointId,
      };
    } catch (err) {
      console.error("[PostgresCheckpointer] Failed to create checkpoint:", err);
      throw err;
    }
  }

  /**
   * Lists all checkpoints for a thread
   * @param threadId - The thread ID
   * @param options - Options for listing checkpoints
   * @returns List of checkpoints
   */
  async list_checkpoints(
    threadId: string,
    options?: ListCheckpointsOptions
  ): Promise<Checkpoint[]> {
    try {
      if (this.debug) {
        console.log(
          `[PostgresCheckpointer] Listing checkpoints for thread ${threadId}`
        );
      }

      let query = this.client
        .from("proposal_states")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: options?.ascending ?? false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const checkpoints = await withErrorHandling(
        () => query,
        `Failed to list checkpoints for thread ${threadId}`
      );

      return checkpoints.map((row) => ({
        id: row.checkpoint_id,
        thread_id: row.thread_id,
        parent_id: row.parent_checkpoint_id,
        values: row.values,
        metadata: row.metadata || {},
        next: row.next || [],
        tasks: row.tasks || [],
        config: row.config || {},
      }));
    } catch (err) {
      console.error("[PostgresCheckpointer] Failed to list checkpoints:", err);
      throw err;
    }
  }

  /**
   * Retrieves a specific checkpoint by ID
   * @param threadId - The thread ID
   * @param checkpointId - The checkpoint ID
   * @returns The requested checkpoint or null if not found
   */
  async get_checkpoint(
    threadId: string,
    checkpointId: string
  ): Promise<Checkpoint | null> {
    try {
      if (this.debug) {
        console.log(
          `[PostgresCheckpointer] Getting checkpoint ${checkpointId} for thread ${threadId}`
        );
      }

      const { data, error } = await this.client
        .from("proposal_states")
        .select("*")
        .eq("thread_id", threadId)
        .eq("checkpoint_id", checkpointId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to get checkpoint: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      return {
        id: data.checkpoint_id,
        thread_id: data.thread_id,
        parent_id: data.parent_checkpoint_id,
        values: data.values,
        metadata: data.metadata || {},
        next: data.next || [],
        tasks: data.tasks || [],
        config: data.config || {},
      };
    } catch (err) {
      console.error("[PostgresCheckpointer] Failed to get checkpoint:", err);
      throw err;
    }
  }

  /**
   * Deletes a thread and all its checkpoints
   * @param threadId - The thread ID to delete
   */
  async delete_thread(threadId: string): Promise<void> {
    try {
      if (this.debug) {
        console.log(`[PostgresCheckpointer] Deleting thread ${threadId}`);
      }

      await withErrorHandling(
        () =>
          this.client
            .from("proposal_states")
            .delete()
            .eq("thread_id", threadId),
        `Failed to delete thread ${threadId}`
      );
    } catch (err) {
      console.error("[PostgresCheckpointer] Failed to delete thread:", err);
      throw err;
    }
  }

  /**
   * Retrieves the most recent checkpoint for a thread
   * @param threadId - The thread ID
   * @returns The most recent checkpoint or null if none exists
   */
  async get_latest_checkpoint(threadId: string): Promise<Checkpoint | null> {
    try {
      if (this.debug) {
        console.log(
          `[PostgresCheckpointer] Getting latest checkpoint for thread ${threadId}`
        );
      }

      const { data, error } = await this.client
        .from("proposal_states")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to get latest checkpoint: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      return {
        id: data.checkpoint_id,
        thread_id: data.thread_id,
        parent_id: data.parent_checkpoint_id,
        values: data.values,
        metadata: data.metadata || {},
        next: data.next || [],
        tasks: data.tasks || [],
        config: data.config || {},
      };
    } catch (err) {
      console.error(
        "[PostgresCheckpointer] Failed to get latest checkpoint:",
        err
      );
      throw err;
    }
  }
}
