/**
 * Thread Management Service
 *
 * Handles operations related to LangGraph threads and their mappings to RFP documents
 * Implements proper authentication patterns following LangGraph best practices
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { Logger } from "../lib/logger.js";
import { v4 as uuidv4 } from "uuid";

// Initialize logger
const logger = Logger.getInstance();

// Thread mapping response from database function
interface ThreadMappingResponse {
  thread_id: string;
  is_new: boolean;
}

// Thread mapping data structure for API responses
export interface ThreadMapping {
  threadId: string;
  rfpId: string;
  userId: string;
  createdAt: string;
}

export class ThreadService {
  private supabase: SupabaseClient;
  private userId: string;

  /**
   * Create a new ThreadService instance
   *
   * @param supabase Authenticated Supabase client from the user's context
   * @param userId The authenticated user's ID
   */
  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase;
    this.userId = userId;

    // Verify we have the required parameters
    if (!supabase) {
      throw new Error("ThreadService requires a Supabase client");
    }

    if (!userId) {
      throw new Error("ThreadService requires a user ID");
    }

    logger.debug("ThreadService initialized", { userId });
  }

  /**
   * Get or create a thread mapping for an RFP document
   *
   * @param rfpId The RFP document ID to map to a thread
   * @returns Object containing threadId and isNew flag
   */
  async getOrCreateThreadForRFP(
    rfpId: string
  ): Promise<{ threadId: string; isNew: boolean }> {
    try {
      logger.info("Getting or creating thread for RFP", {
        rfpId,
        userId: this.userId,
      });

      // Validate inputs
      if (!rfpId) {
        throw new Error("RFP ID is required");
      }

      // Call the database function to get or create thread mapping
      const { data, error } = await this.supabase.rpc(
        "get_or_create_thread_mapping",
        {
          p_rfp_id: rfpId,
          p_user_id: this.userId,
        }
      );

      if (error) {
        logger.error("Error getting or creating thread mapping", {
          error,
          rfpId,
          userId: this.userId,
        });
        throw new Error(`Failed to get or create thread: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error("No thread mapping returned from database");
      }

      const response = data[0] as ThreadMappingResponse;

      // Log the result
      logger.info(
        response.is_new
          ? "Created new thread mapping"
          : "Retrieved existing thread mapping",
        {
          threadId: response.thread_id,
          rfpId,
          userId: this.userId,
          isNew: response.is_new,
        }
      );

      return {
        threadId: response.thread_id,
        isNew: response.is_new,
      };
    } catch (error) {
      logger.error("Thread mapping operation failed", {
        error,
        rfpId,
        userId: this.userId,
      });

      // Re-throw the error for handling in the API layer
      throw error;
    }
  }

  /**
   * Get all threads for the current user
   *
   * @returns Array of thread mappings with their associated RFP IDs
   */
  async getUserThreads(): Promise<ThreadMapping[]> {
    try {
      logger.info("Fetching user thread mappings", {
        userId: this.userId,
      });

      // Query the mappings table for all threads belonging to this user
      const { data, error } = await this.supabase
        .from("proposal_thread_mappings")
        .select("thread_id, rfp_id, created_at")
        .eq("user_id", this.userId)
        .order("created_at", { ascending: false });

      if (error) {
        logger.error("Error fetching thread mappings", {
          error,
          userId: this.userId,
        });
        throw new Error(`Failed to fetch thread mappings: ${error.message}`);
      }

      // Convert to camelCase for API responses
      const mappings: ThreadMapping[] = (data || []).map((item) => ({
        threadId: item.thread_id,
        rfpId: item.rfp_id,
        userId: this.userId,
        createdAt: item.created_at,
      }));

      logger.info("Thread mappings retrieved", {
        userId: this.userId,
        count: mappings.length,
      });

      return mappings;
    } catch (error) {
      logger.error("Failed to get user threads", {
        error,
        userId: this.userId,
      });

      // Re-throw the error for handling in the API layer
      throw error;
    }
  }

  /**
   * Delete a thread mapping
   *
   * @param threadId The thread ID to delete
   * @returns Boolean indicating success
   */
  async deleteThreadMapping(threadId: string): Promise<void> {
    try {
      logger.info("Deleting thread mapping", {
        threadId,
        userId: this.userId,
      });

      // Validate input
      if (!threadId) {
        throw new Error("Thread ID is required");
      }

      // Delete the mapping
      const { error } = await this.supabase
        .from("proposal_thread_mappings")
        .delete()
        .eq("thread_id", threadId)
        .eq("user_id", this.userId);

      if (error) {
        logger.error("Error deleting thread mapping", {
          error,
          threadId,
          userId: this.userId,
        });
        throw new Error(`Failed to delete thread mapping: ${error.message}`);
      }

      logger.info("Thread mapping deleted", {
        threadId,
        userId: this.userId,
      });
    } catch (error) {
      logger.error("Failed to delete thread mapping", {
        error,
        threadId,
        userId: this.userId,
      });

      // Re-throw the error for handling in the API layer
      throw error;
    }
  }

  /**
   * Get thread ID for an RFP if it exists
   *
   * @param rfpId The RFP document ID
   * @returns Thread ID if found, null otherwise
   */
  async getThreadIdForRFP(rfpId: string): Promise<string | null> {
    try {
      // Validate input
      if (!rfpId) {
        throw new Error("RFP ID is required");
      }

      // Query the database function to get the thread ID
      const { data, error } = await this.supabase.rpc("get_thread_for_rfp", {
        p_rfp_id: rfpId,
        p_user_id: this.userId,
      });

      if (error) {
        logger.error("Error getting thread for RFP", {
          error,
          rfpId,
          userId: this.userId,
        });
        throw new Error(`Failed to get thread for RFP: ${error.message}`);
      }

      // data will be the thread_id or null
      return data as string | null;
    } catch (error) {
      logger.error("Error in getThreadIdForRFP", {
        error,
        rfpId,
        userId: this.userId,
      });
      throw error;
    }
  }

  /**
   * Generate a properly formatted LangGraph thread ID
   *
   * @returns A new thread ID string
   */
  static generateThreadId(): string {
    // Create a thread ID with the format 'thread_<uuid without dashes>'
    return `thread_${uuidv4().replace(/-/g, "_")}`;
  }
}
