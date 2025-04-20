import { Logger } from "../lib/logger.js";
import { OrchestratorService } from "./orchestrator.service.js";
import { createProposalAgentWithCheckpointer } from "../agents/proposal-agent/graph.js";
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

/**
 * Gets or creates an OrchestratorService instance for a specific proposal
 *
 * @param proposalId - The ID of the proposal to manage
 * @param dependencyMapPath - Optional custom path to dependency map JSON file
 * @returns An initialized OrchestratorService instance with the appropriate graph and checkpointer
 */
export function getOrchestrator(
  proposalId: string,
  dependencyMapPath: string = DEFAULT_DEPENDENCY_MAP_PATH
): OrchestratorService {
  if (!proposalId) {
    logger.error("proposalId is required to create an orchestrator");
    throw new Error("proposalId is required to create an orchestrator");
  }

  // Create the graph with the appropriate checkpointer
  const graph = createProposalAgentWithCheckpointer(proposalId);

  // Explicitly cast the checkpointer to the correct type
  // This cast is necessary because the checkpointer might be undefined in some test scenarios
  const checkpointer = graph.checkpointer as BaseCheckpointSaver;

  if (!checkpointer) {
    logger.error("Failed to create checkpointer for proposal", { proposalId });
    throw new Error(
      `Failed to create checkpointer for proposal: ${proposalId}`
    );
  }

  // Return a new orchestrator instance with dependency map path
  return new OrchestratorService(graph, checkpointer, dependencyMapPath);
}
