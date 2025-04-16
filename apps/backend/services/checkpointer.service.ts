/**
 * Checkpointer service for the proposal agent
 *
 * This service provides factory functions for creating properly configured
 * checkpointer instances for LangGraph-based agents.
 */

import { SupabaseCheckpointer } from "../lib/persistence/supabase-checkpointer.js";
import { LangGraphCheckpointer } from "../lib/persistence/langgraph-adapter.js";
import { InMemoryCheckpointer } from "../lib/persistence/memory-checkpointer.js";
import { MemoryLangGraphCheckpointer } from "../lib/persistence/memory-adapter.js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import path from "path";
import dotenv from "dotenv";

// Ensure environment variables are loaded
// This is mainly for direct imports without going through the main script
if (
  typeof process !== "undefined" &&
  process.env &&
  !process.env.SUPABASE_URL
) {
  try {
    // Try to load from root .env when imported directly
    const rootPath = path.resolve(process.cwd(), "../../../.env");
    dotenv.config({ path: rootPath });
    // Local .env as fallback
    dotenv.config();
  } catch (e) {
    // Silently fail if no dotenv - might be loaded elsewhere
  }
}

// Types for the request object (could be Express or Next.js)
interface RequestLike {
  cookies: {
    get: (name: string) => { name: string; value: string } | undefined;
  };
  headers: {
    get: (name: string) => string | null;
  };
}

/**
 * Create a properly configured checkpointer for a given component and request
 *
 * @param componentName The name of the component using the checkpointer (e.g., "research", "writing")
 * @param req The request object (Express or Next.js)
 * @param proposalId Optional specific proposal ID
 * @returns A LangGraph-compatible checkpointer
 */
export async function createCheckpointer(
  componentName: string = "proposal",
  req?: RequestLike,
  proposalId?: string
) {
  const hasSupabaseConfig =
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.SUPABASE_URL !== "https://your-project.supabase.co" &&
    process.env.SUPABASE_SERVICE_ROLE_KEY !== "your-service-role-key";

  // Get configuration from environment
  const checkpointTable =
    process.env.CHECKPOINTER_TABLE_NAME || "proposal_checkpoints";
  const sessionTable =
    process.env.CHECKPOINTER_SESSION_TABLE_NAME || "proposal_sessions";
  const maxRetries = parseInt(process.env.CHECKPOINTER_MAX_RETRIES || "3");
  const retryDelayMs = parseInt(
    process.env.CHECKPOINTER_RETRY_DELAY_MS || "500"
  );

  if (!hasSupabaseConfig) {
    // Use in-memory implementation for testing and development
    console.warn(
      "No valid Supabase configuration found. Using in-memory checkpointer (data will not be persisted)."
    );
    const memoryCheckpointer = new InMemoryCheckpointer();
    return new MemoryLangGraphCheckpointer(memoryCheckpointer);
  }

  // Try to get the user ID from the request if provided
  let userId = process.env.TEST_USER_ID || "anonymous";

  if (req) {
    try {
      // Try to get user from Supabase auth
      const supabase = createServerClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!,
        { cookies: () => cookies() }
      );

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id) {
        userId = user.id;
      }
    } catch (error) {
      console.warn("Failed to get authenticated user ID:", error);
      // Fall back to the test user ID or anonymous
    }
  }

  // Create the Supabase checkpointer with proper configuration
  const supabaseCheckpointer = new SupabaseCheckpointer({
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    tableName: checkpointTable,
    sessionTableName: sessionTable,
    maxRetries,
    retryDelayMs,
    userIdGetter: async () => userId,
    proposalIdGetter: async (threadId: string) => {
      // If a specific proposal ID was provided, use it
      if (proposalId) {
        return proposalId;
      }

      // Otherwise, try to extract it from the thread ID
      const parts = threadId.split("_");
      return parts.length > 1 ? parts[1] : "anonymous-proposal";
    },
  });

  // Wrap with the LangGraph adapter
  return new LangGraphCheckpointer(supabaseCheckpointer);
}

/**
 * Generate a unique thread ID for a proposal and component
 *
 * @param proposalId The proposal ID
 * @param componentName Optional component name (default: "proposal")
 * @returns A unique thread ID
 */
export function generateThreadId(
  proposalId: string,
  componentName: string = "proposal"
): string {
  return `${componentName}_${proposalId}_${Date.now()}`;
}
