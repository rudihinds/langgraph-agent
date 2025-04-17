/**
 * Express route handler for starting proposal generation
 *
 * This handler initiates the proposal generation process based on
 * the provided RFP content.
 */

import { Request, Response } from "express";
import { z } from "zod";
import { Logger } from "../../../lib/logger.js";
import { OrchestratorService } from "../../../services/orchestrator.service.js";
import { createProposalAgentWithCheckpointer } from "../../../agents/proposal-agent/graph.js";

// Initialize logger
const logger = Logger.getInstance();

/**
 * Schema for validating the RFP start request
 */
const StartRequestSchema = z.object({
  rfpContent: z.string(),
  userId: z.string().optional(),
});

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

    const { rfpContent, userId } = validation.data;

    // Create graph with appropriate checkpointer (userId-based if provided)
    const graph = createProposalAgentWithCheckpointer(userId);
    if (!graph.checkpointer) {
      logger.error("Failed to create graph with checkpointer");
      res.status(500).json({
        error: "Internal server error: Could not initialize checkpointer",
      });
      return;
    }

    const orchestratorService = new OrchestratorService(
      graph,
      graph.checkpointer
    );

    logger.info(
      `Starting proposal generation for user ${userId || "anonymous"}`
    );

    // Start the proposal generation
    const { threadId, state } =
      await orchestratorService.startProposalGeneration(rfpContent, userId);

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
