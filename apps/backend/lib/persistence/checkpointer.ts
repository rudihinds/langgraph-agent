/**
 * Enhanced LangGraph Checkpointer implementation with OverallProposalState support
 */
import { BaseCheckpointSaver, Checkpoint } from "@langchain/langgraph";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { OverallProposalState } from "../../state/proposal.state";
import { withRetry } from "../utils/backoff";

/**
 * Configuration for the ProposalCheckpointer
 */
export interface ProposalCheckpointerConfig {
  // Supabase connection details
  supabaseUrl: string;
  supabaseKey: string;
  
  // Table configuration
  tableName?: string;
  sessionTableName?: string;
  
  // Retry configuration
  maxRetries?: number;
  retryDelayMs?: number;
  
  // Logging
  logger?: Console;
  
  // Context providers
  userIdGetter?: () => Promise<string | null>;
  proposalIdGetter?: (threadId: string) => Promise<string | null>;
}

/**
 * ProposalCheckpointer implements BaseCheckpointSaver interface for LangGraph
 * with enhanced support for OverallProposalState
 */
export class ProposalCheckpointer implements BaseCheckpointSaver {
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
  }: ProposalCheckpointerConfig) {
    // Initialize Supabase client
    this.supabase = createClient(supabaseUrl, supabaseKey);
    
    // Store configuration
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
   * Get a checkpoint by thread_id
   */
  async get(threadId: string): Promise<Checkpoint | null> {
    try {
      return await withRetry(
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

          return data.checkpoint_data as Checkpoint;
        },
        {
          maxRetries: this.maxRetries,
          initialDelayMs: this.retryDelayMs,
          logger: this.logger,
        }
      );
    } catch (error) {
      this.logger.error("Failed to get checkpoint after all retries", {
        threadId,
        error,
      });
      return null;
    }
  }

  /**
   * Store a checkpoint by thread_id
   */
  async put(threadId: string, checkpoint: Checkpoint): Promise<void> {
    try {
      // Get the associated user and proposal
      const userId = await this.userIdGetter();
      const proposalId = await this.proposalIdGetter(threadId);

      if (!userId || !proposalId) {
        throw new Error(
          "Cannot store checkpoint without user ID and proposal ID"
        );
      }

      // Add metadata to state if it contains OverallProposalState
      await this.enrichCheckpoint(checkpoint, userId, proposalId);
      
      // Store the checkpoint with retry logic
      await withRetry(
        async () => {
          // Use upsert to handle both insert and update
          const { error } = await this.supabase
            .from(this.tableName)
            .upsert(
              {
                thread_id: threadId,
                user_id: userId,
                proposal_id: proposalId,
                checkpoint_data: checkpoint,
                updated_at: new Date().toISOString(),
                size_bytes: Buffer.byteLength(JSON.stringify(checkpoint)),
                checkpoint_version: 'v1',
                state_type: 'OverallProposalState',
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
   * List all checkpoints for a user
   */
  async listUserCheckpoints(userId: string): Promise<{ thread_id: string; updated_at: string }[]> {
    try {
      return await withRetry(
        async () => {
          const { data, error } = await this.supabase
            .from(this.tableName)
            .select("thread_id, updated_at, proposal_id")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false });

          if (error) {
            throw new Error(`Error listing checkpoints: ${error.message}`);
          }

          return data;
        },
        {
          maxRetries: this.maxRetries,
          initialDelayMs: this.retryDelayMs,
          logger: this.logger,
        }
      );
    } catch (error) {
      this.logger.error("Failed to list checkpoints", {
        userId,
        error,
      });
      return [];
    }
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
      const { error } = await this.supabase
        .from(this.sessionTableName)
        .upsert(
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

  /**
   * Enhances a checkpoint with metadata if it contains OverallProposalState
   */
  private async enrichCheckpoint(
    checkpoint: Checkpoint,
    userId: string,
    proposalId: string
  ): Promise<void> {
    // Check if the checkpoint has OverallProposalState elements that need enrichment
    if (
      checkpoint && 
      typeof checkpoint === 'object' && 
      'values' in checkpoint &&
      checkpoint.values
    ) {
      // Look through all keys in values
      for (const [key, value] of Object.entries(checkpoint.values)) {
        // If we find an object that looks like our state structure, enhance it
        if (
          value && 
          typeof value === 'object' && 
          'rfpDocument' in value &&
          'sections' in value &&
          'activeThreadId' in value
        ) {
          const stateValue = value as unknown as OverallProposalState;
          
          // Ensure userId is set
          if (!stateValue.userId) {
            stateValue.userId = userId;
          }
          
          // Update the last updated timestamp
          stateValue.lastUpdatedAt = new Date().toISOString();
        }
      }
    }
  }
}