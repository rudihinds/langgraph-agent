/**
 * Express route handler for resuming proposal generation after feedback
 *
 * This handler resumes the proposal generation process after user feedback
 * has been provided and processed.
 */

import { Request, Response } from "express";
import { z } from "zod";
import { Logger } from "../../../lib/logger.js";
import { OrchestratorService } from "../../../services/orchestrator.service.js";
import { createProposalAgentWithCheckpointer } from "../../../agents/proposal-agent/graph.js";

// Initialize logger
const logger = Logger.getInstance();

/**
 * Schema for validating the resume request
 */
const ResumeRequestSchema = z.object({
  threadId: z.string(),
  userId: z.string().optional(),
});

/**
 * Express handler for resuming after feedback
 */
export async function resumeAfterFeedback(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Parse and validate the request body
    const validation = ResumeRequestSchema.safeParse(req.body);

    if (!validation.success) {
      logger.warn("Invalid resume request data");
      res.status(400).json({
        error: "Invalid resume request data",
        details: validation.error.format(),
      });
      return;
    }

    const { threadId, userId } = validation.data;

    if (!threadId) {
      logger.warn("Missing threadId in resume request");
      res.status(400).json({ error: "Missing required parameter: threadId" });
      return;
    }

    // Create graph with appropriate checkpointer
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
      `Resuming proposal generation after feedback for thread ${threadId}`
    );

    // Resume proposal generation
    const updatedState =
      await orchestratorService.resumeAfterFeedback(threadId);

    logger.info(`Proposal generation resumed for thread ${threadId}`);

    res.json({
      threadId,
      state: updatedState,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error resuming proposal generation: ${errorMessage}`);

    res.status(500).json({
      error: `Failed to resume proposal generation: ${errorMessage}`,
    });
  }
}
