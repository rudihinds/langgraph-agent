/**
 * Checkpointer service for the proposal agent
 *
 * This service provides factory functions for creating properly configured
 * checkpointer instances for LangGraph-based agents.
 */

import {
  createRobustCheckpointer,
  RobustCheckpointerOptions,
} from "../lib/persistence/robust-checkpointer.js";
import { BaseCheckpointSaver } from "@langchain/langgraph";
import { ENV } from "../lib/config/env.js";

/**
 * Create a properly configured checkpointer for a given component.
 *
 * @param componentName The name of the component using the checkpointer (e.g., "research", "writing")
 * @returns A LangGraph-compatible checkpointer
 */
export async function createCheckpointer(
  componentName: string = "proposal"
): Promise<BaseCheckpointSaver> {
  // The RobustCheckpointerOptions interface might evolve.
  // For now, we pass an empty object, assuming robust-checkpointer
  // primarily relies on ENV vars for DB connection and has defaults for other options.
  // If robust-checkpointer needs specific options derived from componentName or req,
  // they can be constructed here.
  const robustCheckpointerOptions: RobustCheckpointerOptions = {
    // threadId will be part of RunnableConfig, not a checkpointer construction option here.
    // useFallback can be true by default or configurable if needed.
    // fallbackLogLevel can be set if specific logging is desired.
  };

  console.info(
    `[CheckpointerService] Requesting checkpointer for component: ${componentName} in ${ENV.NODE_ENV} environment.`
  );

  // Directly call and return createRobustCheckpointer
  // It handles its own logging regarding Supabase/Memory fallback.
  return createRobustCheckpointer(robustCheckpointerOptions);
}

// Removed generateThreadId function as it's redundant with the one in lib/utils/threads.ts
// and the OrchestratorService is responsible for constructing the meaningful thread_id.
