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
import { ENV } from "../lib/config/env.js";

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
  // Use in-memory checkpointer in the following cases:
  // 1. In development mode (unless Supabase is properly configured)
  // 2. Supabase is not configured (regardless of environment)
  const shouldUseInMemory =
    (ENV.isDevelopment() && !ENV.isSupabaseConfigured()) ||
    !ENV.isSupabaseConfigured();

  // Get configuration from environment
  const checkpointTable = ENV.CHECKPOINTER_TABLE_NAME;

  if (shouldUseInMemory) {
    if (!ENV.isSupabaseConfigured()) {
      console.warn(
        `Supabase not configured in ${ENV.NODE_ENV} environment. Using in-memory checkpointer (data will not be persisted).`
      );
    } else if (ENV.isDevelopment()) {
      console.info(
        "Using in-memory checkpointer in development mode. Set NODE_ENV=production to use Supabase checkpointer."
      );
    }

    const memoryCheckpointer = new InMemoryCheckpointer();
    return new MemoryLangGraphCheckpointer(memoryCheckpointer);
  }

  // Using Supabase in production mode (or when explicitly configured in development)
  console.info(
    `Using Supabase checkpointer in ${ENV.NODE_ENV} environment for ${componentName}`
  );

  // Try to get the user ID from the request if provided
  let userId = ENV.TEST_USER_ID || "anonymous";

  if (req) {
    try {
      // Try to get user from Supabase auth
      const supabase = createServerClient(
        ENV.SUPABASE_URL,
        ENV.SUPABASE_ANON_KEY,
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

  // Session table and retry settings - could be moved to the ENV object in the future
  const sessionTable =
    process.env.CHECKPOINTER_SESSION_TABLE_NAME || "proposal_sessions";
  const maxRetries = parseInt(process.env.CHECKPOINTER_MAX_RETRIES || "3");
  const retryDelayMs = parseInt(
    process.env.CHECKPOINTER_RETRY_DELAY_MS || "500"
  );

  // Create the Supabase checkpointer with proper configuration
  const supabaseCheckpointer = new SupabaseCheckpointer({
    supabaseUrl: ENV.SUPABASE_URL,
    supabaseKey: ENV.SUPABASE_SERVICE_ROLE_KEY,
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
