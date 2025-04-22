/**
 * Express route handler for starting proposal generation
 *
 * This handler initiates the proposal generation process based on
 * the provided RFP content.
 */

import { Request, Response } from "express";
import { z } from "zod";
import * as path from "path";
import { fileURLToPath } from "url";
import { Logger } from "../../../lib/logger.js";
import { OrchestratorService } from "../../../services/orchestrator.service.js";
import { createProposalGenerationGraph } from "../../../agents/proposal-generation/index.js";

// Initialize logger
const logger = Logger.getInstance();

// Get current directory to build absolute paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Schema for validating the RFP start request
 */
const StartRequestSchema = z.union([
  // String format
  z.object({
    rfpContent: z.string(),
    userId: z.string().optional(),
  }),
  // Structured object format
  z.object({
    title: z.string(),
    description: z.string(),
    sections: z.array(z.string()).optional(),
    requirements: z.array(z.string()).optional(),
    userId: z.string().optional(),
  }),
]);

/**
 * Express handler for starting proposal generation
 */
export async function startProposalGeneration(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Parse and validate the request body
    const validation = StartRequestSchema.safeParse(req.body);

    if (!validation.success) {
      logger.warn("Invalid request data for starting proposal generation");
      res.status(400).json({
        error: "Invalid request data",
        details: validation.error.format(),
      });
      return;
    }

    const data = validation.data;

    // Extract userId
    const userId = "userId" in data ? data.userId : undefined;

    // Ensure userId is provided for graph creation
    if (!userId) {
      logger.error("userId is required for creating a graph with checkpointer");
      res.status(400).json({
        error: "userId is required for creating a graph with checkpointer",
      });
      return;
    }

    // Create graph with appropriate checkpointer (userId-based)
    const graph = createProposalGenerationGraph(userId);
    if (!graph.checkpointer) {
      logger.error("Failed to create graph with checkpointer");
      res.status(500).json({
        error: "Internal server error: Could not initialize checkpointer",
      });
      return;
    }

    // Define default dependency map path
    const defaultDependencyMapPath = path.resolve(
      __dirname,
      "../../../config/dependencies.json"
    );

    const orchestratorService = new OrchestratorService(
      graph,
      graph.checkpointer,
      defaultDependencyMapPath
    );

    logger.info(`Starting proposal generation for user ${userId}`);

    // Start the proposal generation with either format
    const { threadId, state } =
      await orchestratorService.startProposalGeneration(
        // If rfpContent exists, use string format; otherwise use structured format
        "rfpContent" in data ? data.rfpContent : data,
        userId
      );

    logger.info(`Proposal generation started. Thread ID: ${threadId}`);

    // Return the thread ID and initial state
    res.json({
      threadId,
      state,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error starting proposal generation: ${errorMessage}`);

    res.status(500).json({
      error: `Failed to start proposal generation: ${errorMessage}`,
    });
  }
}
