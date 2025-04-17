import express from "express";
import { z } from "zod";
import { Logger } from "../../lib/logger.js";
import { getOrchestrator } from "../../services/orchestrator-factory.js";

// Initialize logger
const logger = Logger.getInstance();

const router = express.Router();

/**
 * @description Get route to check if a proposal generation has been interrupted
 * @param proposalId - The ID of the proposal to check
 * @returns {Object} - Object indicating if the proposal generation is interrupted and the state if interrupted
 */
router.get("/", async (req, res) => {
  try {
    // Validate proposalId
    const querySchema = z.object({
      proposalId: z.string().min(1, "ProposalId is required"),
    });

    const result = querySchema.safeParse(req.query);
    if (!result.success) {
      logger.error("Invalid proposalId in interrupt status request", {
        error: result.error.issues,
      });
      return res.status(400).json({
        error: "Invalid request parameters",
        details: result.error.issues,
      });
    }

    const { proposalId } = result.data;
    logger.info("Checking interrupt status for proposal", { proposalId });

    // Get the orchestrator
    const orchestrator = getOrchestrator(proposalId);

    // Get the interrupt status and return it directly - the test expects this exact format
    const status = await orchestrator.getInterruptStatus(proposalId);
    return res.status(200).json(status);
  } catch (error) {
    logger.error("Failed to check interrupt status", { error });
    return res.status(500).json({
      error: "Failed to check interrupt status",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
