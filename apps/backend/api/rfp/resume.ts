import express from "express";
import { z } from "zod";
import { Logger } from "../../lib/logger.js";
// import { getOrchestrator } from "../../services/[dep]orchestrator-factory.js"; // DEPRECATED

// Initialize logger
const logger = Logger.getInstance();

const router = express.Router();

// Input validation schema for POST endpoint
const resumeSchema = z.object({
  threadId: z.string().min(1, "ThreadId is required"),
});

/**
 * @description Post route to resume proposal generation after feedback submission
 * @param proposalId - The ID of the proposal to resume
 * @returns {Object} - Object indicating resume status and detailed state information
 */
router.post("/", async (req, res) => {
  // TODO: Refactor this entire endpoint. Resuming a graph is now handled by the
  // LangGraph server when the client sends new input/events to a thread after an interrupt.
  // This Express endpoint might become obsolete or serve a different purpose related to application state.
  // For now, this endpoint will return a 503 Service Unavailable.

  logger.warn("Attempt to use deprecated resume endpoint", { body: req.body });
  return res.status(503).json({
    error: "Service Temporarily Unavailable",
    message:
      "The resume functionality is currently under reconstruction to integrate with the new LangGraph server architecture. Client applications should interact directly with the LangGraph server to resume threads.",
  });

  /*
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

    const { threadId } = result.data;
    logger.info("Resuming proposal generation", { threadId });

    // DEPRECATED CODE:
    // const orchestrator = await getOrchestrator();
    // const resumeResult = await orchestrator.resumeAfterFeedback(threadId);
    // const interruptStatus = await orchestrator.getInterruptStatus(threadId);
    // return res.status(200).json({
    //   success: true,
    //   message: resumeResult.message,
    //   status: resumeResult.status,
    //   interrupted: interruptStatus.interrupted,
    //   interruptData: interruptStatus.interruptData,
    // });

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
  */
});

export default router;
