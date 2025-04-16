/**
 * SupabaseCheckpointer for LangGraph
 *
 * Implements LangGraph's Checkpointer interface to store and retrieve
 * checkpoint state from Supabase.
 */

import {
  BaseCheckpointSaver,
  Checkpoint,
  CheckpointMetadata,
} from "@langchain/langgraph";
import type { RunnableConfig } from "@langchain/core/runnables";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { withRetry } from "../utils/backoff.js";

/**
 * Configuration for the SupabaseCheckpointer
 */
export interface SupabaseCheckpointerConfig {
  supabaseUrl: string;
  supabaseKey: string;
  tableName?: string;
  sessionTableName?: string;
  maxRetries?: number;
  retryDelayMs?: number;
  logger?: Console;
  userIdGetter?: () => Promise<string | null>;
  proposalIdGetter?: (threadId: string) => Promise<string | null>;
}

// Schema for validating checkpoint data structure
const CheckpointSchema = z.object({
  thread_id: z.string().optional(),
  config: z.record(z.any()).optional(),
  state: z.record(z.any()),
});

/**
 * SupabaseCheckpointer implements a minimal subset of the BaseCheckpointSaver interface
 * providing persistence for checkpoints using Supabase
 */
export class SupabaseCheckpointer implements Partial<BaseCheckpointSaver> {
  private supabase: SupabaseClient;
  private tableName: string;
  private sessionTableName: string;
  private maxRetries: number;
  private retryDelayMs: number;
  private logger: Console;
  private userIdGetter: () => Promise<string | null>;
  private proposalIdGetter: (threadId: string) => Promise<string | null>;

  constructor({
    supabaseUrl,
    supabaseKey,
    tableName = "proposal_checkpoints",
    sessionTableName = "proposal_sessions",
    maxRetries = 3,
    retryDelayMs = 500,
    logger = console,
    userIdGetter = async () => null,
    proposalIdGetter = async () => null,
  }: SupabaseCheckpointerConfig) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.tableName = tableName;
    this.sessionTableName = sessionTableName;
    this.maxRetries = maxRetries;
    this.retryDelayMs = retryDelayMs;
    this.logger = logger;
    this.userIdGetter = userIdGetter;
    this.proposalIdGetter = proposalIdGetter;
  }

  /**
   * Generate a consistent thread ID with optional prefix
   */
  public static generateThreadId(
    proposalId: string,
    componentName: string = "proposal"
  ): string {
    return `${componentName}_${proposalId}_${Date.now()}`;
  }

  /**
   * Get a checkpoint by thread_id from config
   */
  async get(config: RunnableConfig): Promise<Checkpoint | undefined> {
    const threadId = config?.configurable?.thread_id as string;
    if (!threadId) {
      this.logger.warn("No thread_id provided in config");
      return undefined;
    }

    try {
      const result = await withRetry(
        async () => {
          const { data, error } = await this.supabase
            .from(this.tableName)
            .select("checkpoint_data")
            .eq("thread_id", threadId)
            .single();

          if (error) {
            // Only throw on errors other than not found
            if (error.code !== "PGRST116") {
              throw new Error(`Error fetching checkpoint: ${error.message}`);
            }
            return null;
          }

          if (!data || !data.checkpoint_data) {
            return null;
          }

          try {
            // Validate schema if possible
            CheckpointSchema.parse(data.checkpoint_data);
            return data.checkpoint_data as Checkpoint;
          } catch (validationError) {
            this.logger.warn("Invalid checkpoint data format", { threadId });
            return data.checkpoint_data as Checkpoint;
          }
        },
        {
          maxRetries: this.maxRetries,
          initialDelayMs: this.retryDelayMs,
          logger: this.logger,
        }
      );

      return result || undefined;
    } catch (error) {
      this.logger.error("Failed to get checkpoint after all retries", {
        threadId,
        error,
      });
      return undefined;
    }
  }

  /**
   * Store a checkpoint by thread_id
   *
   * Note: _metadata and _newVersions parameters are unused but required by the interface
   */
  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _metadata: CheckpointMetadata,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _newVersions: any
  ): Promise<RunnableConfig> {
    const threadId = config?.configurable?.thread_id as string;
    if (!threadId) {
      throw new Error("No thread_id provided in config");
    }

    try {
      // Get the associated user and proposal
      const userId = await this.userIdGetter();
      const proposalId = await this.proposalIdGetter(threadId);

      if (!userId || !proposalId) {
        throw new Error(
          "Cannot store checkpoint without user ID and proposal ID"
        );
      }

      // Store the checkpoint with retry logic
      await withRetry(
        async () => {
          // Use upsert to handle both insert and update
          const { error } = await this.supabase.from(this.tableName).upsert(
            {
              thread_id: threadId,
              user_id: userId,
              proposal_id: proposalId,
              checkpoint_data: checkpoint,
              updated_at: new Date().toISOString(),
              size_bytes: Buffer.byteLength(JSON.stringify(checkpoint)),
            },
            { onConflict: "thread_id, user_id" }
          );

          if (error) {
            throw new Error(`Error storing checkpoint: ${error.message}`);
          }

          // Also update session tracking
          await this.updateSessionActivity(threadId, userId, proposalId);
        },
        {
          maxRetries: this.maxRetries,
          initialDelayMs: this.retryDelayMs,
          logger: this.logger,
        }
      );

      // Return the config as required by BaseCheckpointSaver interface
      return config;
    } catch (error) {
      this.logger.error("Failed to store checkpoint after all retries", {
        threadId,
        error,
      });
      throw error;
    }
  }

  /**
   * Delete a checkpoint by thread_id
   */
  async delete(threadId: string): Promise<void> {
    try {
      await withRetry(
        async () => {
          const { error } = await this.supabase
            .from(this.tableName)
            .delete()
            .eq("thread_id", threadId);

          if (error) {
            throw new Error(`Error deleting checkpoint: ${error.message}`);
          }
        },
        {
          maxRetries: this.maxRetries,
          initialDelayMs: this.retryDelayMs,
          logger: this.logger,
        }
      );
    } catch (error) {
      this.logger.error("Failed to delete checkpoint after all retries", {
        threadId,
        error,
      });
      // Don't throw on deletion errors to avoid blocking the application
    }
  }

  /**
   * List namespaces (required by BaseCheckpointSaver interface)
   *
   * Note: Parameters are unused but required by the interface
   */
  async listNamespaces(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _match?: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _matchType?: string
  ): Promise<string[]> {
    return [];
  }

  /**
   * Update session activity tracking
   */
  private async updateSessionActivity(
    threadId: string,
    userId: string,
    proposalId: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase.from(this.sessionTableName).upsert(
        {
          thread_id: threadId,
          user_id: userId,
          proposal_id: proposalId,
          last_activity: new Date().toISOString(),
        },
        { onConflict: "thread_id" }
      );

      if (error) {
        this.logger.warn("Error updating session activity", {
          threadId,
          error: error.message,
        });
      }
    } catch (error) {
      this.logger.warn("Failed to update session activity", {
        threadId,
        error,
      });
    }
  }
}
