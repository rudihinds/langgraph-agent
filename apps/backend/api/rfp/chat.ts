/**
 * Chat Router Module
 *
 * This module provides API endpoints for chat interactions with the proposal generation system.
 * It handles authentication token refresh notifications to clients via response headers.
 */
import express, { Request, Response } from "express";
import { Logger } from "../../lib/logger.js";
import { getOrchestrator } from "../../services/[dep]orchestrator-factory.js";
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
  try {
    const { threadId, message } = req.body;

    // Validate required fields
    if (!threadId) {
      return res.status(400).json({ error: "Missing threadId" });
    }

    if (!message) {
      return res.status(400).json({ error: "Missing message" });
    }

    logger.info(`Processing chat message for thread ${threadId}`);

    // Add token refresh header if recommended
    // This informs the client that their token will expire soon and should be refreshed
    if (req.tokenRefreshRecommended === true) {
      res.setHeader(AUTH_CONSTANTS.REFRESH_HEADER, "true");
      logger.info(`Token refresh recommended for user ${req.user?.id}`, {
        tokenExpiresIn: req.tokenExpiresIn,
        threadId,
      });
    }

    // Get orchestrator service
    const orchestratorService = await getOrchestrator();

    // Process the chat message using the orchestrator
    const { response, commandExecuted } =
      await orchestratorService.processChatMessage(threadId, message);

    // Return response to client
    return res.json({
      response,
      commandExecuted,
    });
  } catch (error) {
    logger.error(`Error processing chat message: ${error.message}`);
    return res.status(500).json({
      error: "Failed to process chat message",
      message: error.message,
    });
  }
});

export default router;
