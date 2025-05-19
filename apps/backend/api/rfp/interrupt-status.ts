import express from "express";
import { z } from "zod";
import { Logger } from "../../lib/logger.js";
// import { getOrchestrator } from "../../services/[dep]orchestrator-factory.js"; // DEPRECATED

// Initialize logger
const logger = Logger.getInstance();

const router = express.Router();

/**
 * @description Get route to check if a proposal generation has been interrupted
 * @param threadId - The ID of the thread to check (from URL path)
 * @returns {Object} - Object indicating if the proposal generation is interrupted and the state if interrupted
 */
router.get("/:threadId", async (req, res) => {
  // TODO: Refactor this entire endpoint. Interrupt status is now managed by the
  // LangGraph server. The client should get this information directly from the
  // LangGraph server's state or events.
  // This Express endpoint is likely obsolete for the main proposal flow.
  // For now, this endpoint will return a 503 Service Unavailable.

  const { threadId } = req.params;
  logger.warn("Attempt to use deprecated interrupt-status endpoint", {
    threadId,
  });
  return res.status(503).json({
    error: "Service Temporarily Unavailable",
    message:
      "The interrupt status check is currently under reconstruction to integrate with the new LangGraph server architecture. Client applications should obtain interrupt status directly from the LangGraph server.",
  });

  /*
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

    // DEPRECATED CODE:
    // const orchestrator = await getOrchestrator();
    // const status = await orchestrator.getInterruptStatus(threadId);
    // return res.status(200).json(status);

  } catch (error) {
    logger.error("Failed to check interrupt status", { error });
    return res.status(500).json({
      error: "Failed to check interrupt status",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
  */
});

export default router;
