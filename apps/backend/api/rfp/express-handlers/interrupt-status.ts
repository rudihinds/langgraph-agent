/**
 * Express route handler for checking interrupt status
 *
 * This handler provides detailed information about the current interrupt
 * status including the reason for interruption, content being evaluated,
 * and any evaluation results.
 * 
 * Note: This function should eventually work with an existing graph instance
 * instead of creating a new one for each request.
 */

import { Request, Response } from "express";
import { z } from "zod";
import { Logger } from "../../../lib/logger.js";
import { OrchestratorService } from "../../../services/orchestrator.service.js";
import { createProposalAgentWithCheckpointer } from "../../../agents/proposal-agent/graph.js";

// Initialize logger
const logger = Logger.getInstance();

/**
 * Schema for validating the status request query parameters
 */
const StatusRequestSchema = z.object({
  threadId: z.string(),
});

/**
 * Express handler for getting interrupt status
 */
export async function getInterruptStatus(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Get the threadId from query params
    const threadId = req.query.threadId as string;

    // Validate the threadId
    const validation = StatusRequestSchema.safeParse({ threadId });

    if (!validation.success) {
      logger.info("Missing or invalid required parameter: threadId");
      res.status(400).json({
        error: "Missing or invalid required parameter: threadId",
        details: validation.error.format(),
      });
      return;
    }

    // Create graph and orchestrator service
    const graph = createProposalAgentWithCheckpointer();

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

    logger.info(`Checking interrupt status for thread ${threadId}`);

    // Check if the thread is currently interrupted
    const isInterrupted = await orchestratorService.detectInterrupt(threadId);

    if (!isInterrupted) {
      logger.info(`No active interrupt found for thread ${threadId}`);
      res.json({
        interrupted: false,
        message: "No active interrupt found for this thread",
      });
      return;
    }

    // Get detailed interrupt information
    const interruptDetails =
      await orchestratorService.getInterruptDetails(threadId);

    logger.info(
      `Retrieved interrupt details for thread ${threadId}: ${interruptDetails?.reason}`
    );

    // Return the interrupt details
    res.json({
      interrupted: true,
      details: interruptDetails,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error checking interrupt status: ${errorMessage}`);

    res.status(500).json({
      error: `Failed to check interrupt status: ${errorMessage}`,
    });
  }
}
