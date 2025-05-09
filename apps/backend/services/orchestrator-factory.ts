import { Logger } from "../lib/logger.js";
import { OrchestratorService } from "./orchestrator.service.js";
import { createProposalGenerationGraph } from "../agents/proposal-generation/graph.js";
import { createCheckpointer } from "./checkpointer.service.js";
import { BaseCheckpointSaver } from "@langchain/langgraph";
import * as path from "path";
import { fileURLToPath } from "url";

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default dependency map path
const DEFAULT_DEPENDENCY_MAP_PATH = path.resolve(
  __dirname,
  "../config/dependencies.json"
);

// Initialize logger
const logger = Logger.getInstance();

// Store a singleton instance of the orchestrator to avoid re-creating graph/checkpointer on every call
let orchestratorInstance: OrchestratorService | null = null;

/**
 * Gets or creates a singleton OrchestratorService instance.
 * The instance is configured with the main proposal generation graph and a robust checkpointer.
 *
 * @param dependencyMapPath - Optional custom path to dependency map JSON file
 * @returns An initialized OrchestratorService instance.
 */
export async function getOrchestrator(
  dependencyMapPath: string = DEFAULT_DEPENDENCY_MAP_PATH
): Promise<OrchestratorService> {
  logger.info("[OrchestratorFactory] getOrchestrator called.");

  if (orchestratorInstance) {
    logger.info(
      "[OrchestratorFactory] Returning existing orchestrator instance."
    );
    return orchestratorInstance;
  }

  logger.info("[OrchestratorFactory] Creating new orchestrator instance...");

  try {
    logger.debug("[OrchestratorFactory] Creating proposal generation graph...");
    const graph = await createProposalGenerationGraph();
    logger.debug("[OrchestratorFactory] Proposal generation graph created.");

    logger.debug("[OrchestratorFactory] Creating checkpointer...");
    const checkpointer = await createCheckpointer("proposal-generation");
    logger.debug("[OrchestratorFactory] Checkpointer created.");

    if (!graph) {
      logger.error("[OrchestratorFactory] Failed to create the graph.");
      throw new Error("Failed to create the graph for OrchestratorService.");
    }
    if (!checkpointer) {
      logger.error("[OrchestratorFactory] Failed to create the checkpointer.");
      throw new Error(
        "Failed to create the checkpointer for OrchestratorService."
      );
    }

    logger.info("[OrchestratorFactory] Instantiating OrchestratorService...");
    orchestratorInstance = new OrchestratorService(
      graph,
      checkpointer,
      dependencyMapPath
    );
    logger.info(
      "[OrchestratorFactory] OrchestratorService instance created and cached."
    );
    return orchestratorInstance;
  } catch (error) {
    logger.error(
      "[OrchestratorFactory] Error creating OrchestratorService instance:",
      error
    );
    throw error;
  }
}
