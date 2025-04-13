/**
 * SupabaseCheckpointer for LangGraph
 * 
 * Implements LangGraph's Checkpointer interface to store and retrieve
 * checkpoint state from Supabase.
 */

import { Checkpoint, Checkpointer } from "@langchain/langgraph";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

/**
 * Configuration for the SupabaseCheckpointer
 */
export interface SupabaseCheckpointerConfig {
  supabaseUrl: string;
  supabaseKey: string;
  tableName?: string;
  sessionTableName?: string;
  maxRetries?: number;
  retryDelay?: number;
  logger?: Console;
  userIdGetter?: () => Promise<string | null>;
  proposalIdGetter?: (threadId: string) => Promise<string | null>;
}

/**
 * SupabaseCheckpointer implements LangGraph's Checkpointer interface
 * to store and retrieve checkpoint state from Supabase
 */
export class SupabaseCheckpointer implements Checkpointer {
  private supabase: SupabaseClient;
  private tableName: string;
  private sessionTableName: string;
  private maxRetries: number;
  private retryDelay: number;
  private logger: Console;
  private userIdGetter: () => Promise<string | null>;
  private proposalIdGetter: (threadId: string) => Promise<string | null>;

  constructor({
    supabaseUrl,
    supabaseKey,
    tableName = "proposal_checkpoints",
    sessionTableName = "proposal_sessions",
    maxRetries = 3,
    retryDelay = 500,
    logger = console,
    userIdGetter = async () => null,
    proposalIdGetter = async () => null,
  }: SupabaseCheckpointerConfig) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.tableName = tableName;
    this.sessionTableName = sessionTableName;
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
    this.logger = logger;
    this.userIdGetter = userIdGetter;
    this.proposalIdGetter = proposalIdGetter;
  }

  /**
   * Generate a consistent thread ID with optional prefix
   */
  public static generateThreadId(
    proposalId: string,
    componentName: string = "research"
  ): string {
    // Create a hash of the proposalId for shorter IDs
    const hash = createHash("sha256")
      .update(proposalId)
      .digest("hex")
      .substring(0, 10);
    
    return `${componentName}_${hash}_${Date.now()}`;
  }

  /**
   * Get a checkpoint by thread_id
   */
  async get(threadId: string): Promise<Checkpoint | null> {
    try {
      let attempt = 0;
      
      while (attempt < this.maxRetries) {
        try {
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
        } catch (error) {
          attempt++;
          if (attempt >= this.maxRetries) {
            throw error;
          }
          
          // Exponential backoff
          await new Promise(resolve => 
            setTimeout(resolve, this.retryDelay * Math.pow(2, attempt - 1))
          );
        }
      }
      
      return null;
    } catch (error) {
      this.logger.error("Failed to get checkpoint after retries", {
        threadId,
        error,
      });
      // Return null instead of throwing to allow LangGraph to continue
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

      let attempt = 0;
      
      while (attempt < this.maxRetries) {
        try {
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
              },
              { onConflict: "thread_id, user_id" }
            );

          if (error) {
            throw new Error(`Error storing checkpoint: ${error.message}`);
          }

          // Also update session tracking
          await this.updateSessionActivity(threadId, userId, proposalId);
          
          // Success, exit retry loop
          break;
        } catch (error) {
          attempt++;
          if (attempt >= this.maxRetries) {
            throw error;
          }
          
          // Exponential backoff
          await new Promise(resolve => 
            setTimeout(resolve, this.retryDelay * Math.pow(2, attempt - 1))
          );
        }
      }
    } catch (error) {
      this.logger.error("Failed to store checkpoint after retries", {
        threadId,
        error,
      });
      // Throw to notify LangGraph of persistence failure
      throw error;
    }
  }

  /**
   * Delete a checkpoint by thread_id
   */
  async delete(threadId: string): Promise<void> {
    try {
      let attempt = 0;
      
      while (attempt < this.maxRetries) {
        try {
          const { error } = await this.supabase
            .from(this.tableName)
            .delete()
            .eq("thread_id", threadId);

          if (error) {
            throw new Error(`Error deleting checkpoint: ${error.message}`);
          }
          
          // Success, exit retry loop
          break;
        } catch (error) {
          attempt++;
          if (attempt >= this.maxRetries) {
            throw error;
          }
          
          // Exponential backoff
          await new Promise(resolve => 
            setTimeout(resolve, this.retryDelay * Math.pow(2, attempt - 1))
          );
        }
      }
    } catch (error) {
      this.logger.error("Failed to delete checkpoint after retries", {
        threadId,
        error,
      });
      // Don't throw on deletion errors to avoid blocking the application
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
}