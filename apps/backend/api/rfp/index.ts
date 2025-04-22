import express from "express";
import { Logger } from "../../lib/logger.js";
import feedbackRouter from "./feedback.js";
import resumeRouter from "./resume.js";
import interruptStatusRouter from "./interrupt-status.js";
import chatRouter from "./chat.js";
import { startProposalGeneration } from "./express-handlers/start.js";

// Initialize logger
const logger = Logger.getInstance();

// Create RFP router
const router = express.Router();

// Direct route handlers
router.post("/start", startProposalGeneration);

// Sub-routers for more complex endpoints
router.use("/feedback", feedbackRouter);
router.use("/resume", resumeRouter);
router.use("/interrupt-status", interruptStatusRouter);
router.use("/chat", chatRouter);

export default router;
