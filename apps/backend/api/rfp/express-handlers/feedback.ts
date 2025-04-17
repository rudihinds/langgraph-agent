/**
 * Express route handler for submitting user feedback during interrupts
 *
 * This handler accepts feedback from users during HITL interrupts
 * and updates the proposal state accordingly.
 */

import { Request, Response } from "express";
import { z } from "zod";
import { Logger } from "../../../lib/logger.js";
import { OrchestratorService } from "../../../services/orchestrator.service.js";
import { createProposalAgentWithCheckpointer } from "../../../agents/proposal-agent/graph.js";
import { FeedbackType, UserFeedback } from "../../../lib/types/feedback.js";

// Initialize logger
const logger = Logger.getInstance();

/**
 * Schema for validating the feedback request
 */
const FeedbackSchema = z.object({
  threadId: z.string(),
  feedback: z
    .object({
      type: z.nativeEnum(FeedbackType),
      comments: z.string().optional(),
      specificEdits: z.record(z.unknown()).optional(),
      timestamp: z.string(),
    })
    .refine((data): data is UserFeedback => true),
  userId: z.string().optional(),
});

/**
 * Express handler for submitting user feedback
 */
export async function submitFeedback(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Parse and validate the request body
    const validation = FeedbackSchema.safeParse(req.body);

    if (!validation.success) {
      logger.info("Invalid feedback submission");
      res.status(400).json({
        error: "Invalid feedback submission",
        details: validation.error.format(),
      });
      return;
    }

    const { threadId, feedback, userId } = validation.data;

    if (!threadId) {
      logger.warn("Missing threadId in feedback request");
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
      `Processing user feedback for thread ${threadId}: ${feedback.type}`
    );

    // Submit feedback to the orchestrator
    const updatedState = await orchestratorService.submitFeedback(
      threadId,
      feedback
    );

    logger.info(`Successfully processed feedback for thread ${threadId}`);

    res.json({
      threadId,
      state: updatedState,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error processing feedback: ${errorMessage}`);

    res.status(500).json({
      error: `Failed to process feedback: ${errorMessage}`,
    });
  }
}
