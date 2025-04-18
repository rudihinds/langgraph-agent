/**
 * Express API Server for Proposal Generator
 *
 * This file implements the API layer as specified in AGENT_ARCHITECTURE.md.
 * It serves as the interface between the frontend UI and the Orchestrator Service.
 */

import express from "express";
import { Router } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { Logger } from "../lib/logger.js";

// Import route handlers
import { getInterruptStatus } from "./rfp/express-handlers/interrupt-status.js";
import { submitFeedback } from "./rfp/express-handlers/feedback.js";
import { resumeAfterFeedback } from "./rfp/express-handlers/resume.js";
import { startProposalGeneration } from "./rfp/express-handlers/start.js";

// Initialize logger
const logger = Logger.getInstance();

// Create Express app
const app = express();

// Configure middleware
app.use(cors());
app.use(bodyParser.json());

// Create router for RFP-related endpoints
const rfpRouter = Router();

// Set up RFP routes
rfpRouter.post("/start", startProposalGeneration);
rfpRouter.get("/interrupt-status", getInterruptStatus);
rfpRouter.post("/feedback", submitFeedback);
rfpRouter.post("/resume", resumeAfterFeedback);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Service is running" });
});

// Mount RFP router
app.use("/api/rfp", rfpRouter);

/**
 * Initialize the Express server
 *
 * @param port The port to listen on
 * @returns The Express server instance
 */
export function initializeServer(port = 3001) {
  return app.listen(port, () => {
    logger.info(`API server running on port ${port}`);
    logger.info("Available endpoints:");
    logger.info("- GET /api/health");
    logger.info("- POST /api/rfp/start");
    logger.info("- GET /api/rfp/interrupt-status");
    logger.info("- POST /api/rfp/feedback");
    logger.info("- POST /api/rfp/resume");
  });
}

// Export app for testing
export { app };

// Start server if this file is run directly
if (process.env.NODE_ENV !== "test") {
  const port = parseInt(process.env.PORT || "3001", 10);
  initializeServer(port);
}
