/**
 * DEPRECATED: This service is no longer used in the main proposal flow.
 * The LangGraph server manages its own singleton checkpointer.
 * Safe to delete if not used elsewhere.
 */

// import {
//   createRobustCheckpointer,
//   RobustCheckpointerOptions,
// } from "../lib/persistence/robust-checkpointer.js";
// import { BaseCheckpointSaver } from "@langchain/langgraph";
// import { ENV } from "../lib/config/env.js";
//
// /**
//  * Create a properly configured checkpointer for a given component.
//  *
//  * @param componentName The name of the component using the checkpointer (e.g., "research", "writing")
//  * @returns A LangGraph-compatible checkpointer
//  */
// export async function createCheckpointer(
//   componentName: string = "proposal"
// ): Promise<BaseCheckpointSaver> {
//   const robustCheckpointerOptions: RobustCheckpointerOptions = {};
//   console.info(
//     `[CheckpointerService] Requesting checkpointer for component: ${componentName} in ${ENV.NODE_ENV} environment.`
//   );
//   return createRobustCheckpointer(robustCheckpointerOptions);
// }

// Removed generateThreadId function as it's redundant with the one in lib/utils/threads.ts
// and the OrchestratorService is responsible for constructing the meaningful thread_id.
