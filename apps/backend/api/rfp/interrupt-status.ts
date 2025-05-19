import express from "express";
import { z } from "zod";
import { Logger } from "../../lib/logger.js";
import { getOrchestrator } from "../../services/[dep]orchestrator-factory.js";

// Initialize logger
const logger = Logger.getInstance();

const router = express.Router();

/**
 * @description Get route to check if a proposal generation has been interrupted
 * @param threadId - The ID of the thread to check (from URL path)
 * @returns {Object} - Object indicating if the proposal generation is interrupted and the state if interrupted
 */
router.get("/:threadId", async (req, res) => {
  try {
    // Validate threadId from path parameters
    const paramSchema = z.object({
      threadId: z.string().min(1, "ThreadId is required"),
    });

    const result = paramSchema.safeParse(req.params);
    if (!result.success) {
      logger.error("Invalid threadId in interrupt status request", {
        error: result.error.issues,
      });
      return res.status(400).json({
        error: "Invalid request parameters",
        details: result.error.issues,
      });
    }

    const { threadId } = result.data;
    logger.info("Checking interrupt status for thread", { threadId });

    // Get the orchestrator
    const orchestrator = await getOrchestrator();

    // Get the interrupt status and return it directly - use threadId
    const status = await orchestrator.getInterruptStatus(threadId);
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
