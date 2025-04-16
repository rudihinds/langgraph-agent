/**
 * Checkpointer Factory
 *
 * This module provides factory functions for creating properly configured
 * checkpointer instances for LangGraph state persistence.
 */
import { createClient } from "@supabase/supabase-js";
import { BaseCheckpointSaver } from "@langchain/langgraph";
import { InMemoryCheckpointer } from "./memory-checkpointer.js";
import { SupabaseCheckpointer } from "./supabase-checkpointer.js";
import { LangGraphCheckpointer } from "./langgraph-adapter.js";
import { MemoryLangGraphCheckpointer } from "./memory-adapter.js";
import { ENV } from "../config/env.js";
// Importing Database type is not necessary for the factory functionality

/**
 * Options for creating a checkpointer
 */
export interface CheckpointerOptions {
  userId: string;
  proposalId?: string;
  tableName?: string;
  useInMemory?: boolean;
}

/**
 * Create a checkpointer instance
 *
 * @param options - Checkpointer configuration options
 * @returns A checkpointer instance
 */
export function createCheckpointer(
  options: CheckpointerOptions
): BaseCheckpointSaver {
  const { userId, proposalId, tableName, useInMemory = false } = options;
  const tableName1 = tableName || ENV.CHECKPOINTER_TABLE_NAME;

  // Use in-memory checkpointer if explicitly requested or if Supabase is not configured
  if (useInMemory || !ENV.isSupabaseConfigured()) {
    if (!useInMemory && !ENV.isSupabaseConfigured()) {
      console.warn(
        "Supabase not configured. Falling back to in-memory checkpointer."
      );
    }
    // Create in-memory checkpointer and wrap with LangGraph adapter
    const inMemoryCheckpointer = new InMemoryCheckpointer();
    return new MemoryLangGraphCheckpointer(inMemoryCheckpointer);
  }

  // Create Supabase client with service role key for admin access
  const supabaseClient = createClient(
    ENV.SUPABASE_URL,
    ENV.SUPABASE_SERVICE_ROLE_KEY
  );

  // Create Supabase checkpointer with proper configuration
  const supabaseCheckpointer = new SupabaseCheckpointer({
    client: supabaseClient,
    tableName: tableName1,
    userIdGetter: async () => userId,
    proposalIdGetter: async () => proposalId || null,
  });

  // Wrap with the LangGraph adapter
  return new LangGraphCheckpointer(supabaseCheckpointer);
}

/**
 * Generate a unique thread ID
 *
 * @param prefix - Optional prefix for the thread ID
 * @returns A unique thread ID
 */
export function generateThreadId(prefix = "thread"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}
