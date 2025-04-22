/**
 * Chat router for the proposal generation API
 * Handles chat interactions with the proposal generation system
 */
import express from "express";
import { Logger } from "../../lib/logger.js";
import { getOrchestrator } from "../../services/orchestrator-factory.js";

// Initialize logger
const logger = Logger.getInstance();

// Create router
const router = express.Router();

/**
 * POST /api/rfp/chat
 *
 * Handles chat messages for a proposal
 *
 * @param {string} threadId - The thread ID of the proposal
 * @param {string} message - The user message
 * @returns {object} The AI response and command execution status
 */
router.post("/", async (req, res) => {
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

    // Get orchestrator service
    const orchestratorService = getOrchestrator(threadId);

    // Process the chat message using the orchestrator
    const { response, commandExecuted } =
      await orchestratorService.processChatMessage(threadId, message);

    // Return response to client
    return res.json({
      response,
      commandExecuted,
    });
  } catch (error) {
    logger.error(`Error processing chat message: ${error}`);
    return res.status(500).json({
      error: "Failed to process chat message",
      message: error.message,
    });
  }
});

export default router;
