import express from "express";
import { z } from "zod";
import { Logger } from "../../lib/logger.js";
import { getOrchestrator } from "../../services/orchestrator-factory.js";

// Initialize logger
const logger = Logger.getInstance();

const router = express.Router();

// Input validation schema for POST endpoint
const resumeSchema = z.object({
  proposalId: z.string().min(1, "ProposalId is required"),
});

/**
 * @description Post route to resume proposal generation after feedback submission
 * @param proposalId - The ID of the proposal to resume
 * @returns {Object} - Object indicating resume status and detailed state information
 */
router.post("/", async (req, res) => {
  try {
    // Validate request body
    const result = resumeSchema.safeParse(req.body);
    if (!result.success) {
      logger.error("Invalid request to resume proposal", {
        error: result.error.issues,
      });
      return res.status(400).json({
        error: "Invalid request",
        details: result.error.issues,
      });
    }

    const { proposalId } = result.data;
    logger.info("Resuming proposal generation", { proposalId });

    // Get orchestrator and resume execution
    const orchestrator = getOrchestrator(proposalId);

    // Use the updated resumeAfterFeedback method
    const resumeResult = await orchestrator.resumeAfterFeedback(proposalId);

    // Get the current interrupt status after resuming (in case we hit another interrupt)
    const interruptStatus = await orchestrator.getInterruptStatus(proposalId);

    // Return a detailed response with both resume result and current interrupt state
    return res.status(200).json({
      success: true,
      message: resumeResult.message,
      status: resumeResult.status,
      interrupted: interruptStatus.interrupted,
      interruptData: interruptStatus.interruptData,
    });
  } catch (error) {
    logger.error("Failed to resume proposal generation", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return res.status(500).json({
      error: "Failed to resume proposal generation",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
