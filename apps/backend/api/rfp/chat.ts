/**
 * Chat Router Module
 *
 * This module provides API endpoints for chat interactions with the proposal generation system.
 * It handles authentication token refresh notifications to clients via response headers.
 */
import express, { Request, Response } from "express";
import { Logger } from "../../lib/logger.js";
// import { getOrchestrator } from "../../services/[dep]orchestrator-factory.js"; // DEPRECATED
import { AuthenticatedRequest, AUTH_CONSTANTS } from "../../lib/types/auth.js";

// Initialize logger
const logger = Logger.getInstance();

// Create router
const router = express.Router();

/**
 * POST /api/rfp/chat
 *
 * Handles chat messages for a proposal and supports token refresh notification.
 *
 * This endpoint:
 * 1. Processes chat messages via the orchestrator service
 * 2. Sets X-Token-Refresh-Recommended header when token refresh is needed
 * 3. Returns AI responses to client chat messages
 *
 * @route POST /api/rfp/chat
 * @param {string} req.body.threadId - The thread ID of the proposal
 * @param {string} req.body.message - The user message
 * @returns {object} response - The AI response object
 * @returns {string} response.response - The text response from the AI
 * @returns {boolean} response.commandExecuted - Whether a command was executed during processing
 * @throws {400} - If threadId or message is missing
 * @throws {401} - If authentication fails (handled by auth middleware)
 * @throws {500} - If an error occurs during processing
 */
router.post("/", async (req: AuthenticatedRequest, res: Response) => {
  // TODO: Refactor this entire endpoint. Chat interactions are now primarily handled
  // by the client directly interacting with the LangGraph server.
  // This Express endpoint might become obsolete or serve a different purpose (e.g., proxying with enhanced logic).
  // For now, this endpoint will return a 503 Service Unavailable.

  const { threadId, message } = req.body;
  logger.warn("Attempt to use deprecated chat endpoint", { threadId, message });

  // Preserve token refresh header logic if it's still relevant for other potential uses of this path
  if (req.tokenRefreshRecommended === true) {
    res.setHeader(AUTH_CONSTANTS.REFRESH_HEADER, "true");
    logger.info(
      `Token refresh recommended for user ${req.user?.id} (accessed deprecated chat endpoint)`,
      {
        tokenExpiresIn: req.tokenExpiresIn,
        threadId,
      }
    );
  }

  return res.status(503).json({
    error: "Service Temporarily Unavailable",
    message:
      "The chat message processing system is currently under reconstruction to integrate with the new LangGraph server architecture. Client applications should interact directly with the LangGraph server for chat.",
  });

  /*
  try {
    const { threadId, message } = req.body;

    if (!threadId) {
      return res.status(400).json({ error: "Missing threadId" });
    }
    if (!message) {
      return res.status(400).json({ error: "Missing message" });
    }

    logger.info(`Processing chat message for thread ${threadId}`);

    if (req.tokenRefreshRecommended === true) {
      res.setHeader(AUTH_CONSTANTS.REFRESH_HEADER, "true");
      logger.info(`Token refresh recommended for user ${req.user?.id}`, {
        tokenExpiresIn: req.tokenExpiresIn,
        threadId,
      });
    }

    // DEPRECATED CODE:
    // const orchestratorService = await getOrchestrator();
    // const { response, commandExecuted } =
    //   await orchestratorService.processChatMessage(threadId, message);
    // return res.json({
    //   response,
    //   commandExecuted,
    // });

  } catch (error) {
    logger.error(`Error processing chat message: ${error.message}`);
    return res.status(500).json({
      error: "Failed to process chat message",
      message: error.message,
    });
  }
  */
});

export default router;
