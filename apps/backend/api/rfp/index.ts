import express from "express";
import { Logger } from "../../lib/logger.js";
import feedbackRouter from "./feedback.js";
import resumeRouter from "./resume.js";
import interruptStatusRouter from "./interrupt-status.js";

// Initialize logger
const logger = Logger.getInstance();

// Create RFP router
const router = express.Router();

// Route handlers
router.use("/feedback", feedbackRouter);
router.use("/resume", resumeRouter);
router.use("/interrupt-status", interruptStatusRouter);

export default router;
