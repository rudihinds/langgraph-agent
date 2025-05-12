import express from "express";
import { Logger } from "../../lib/logger.js";
import feedbackRouter from "./feedback.js";
import resumeRouter from "./resume.js";
import interruptStatusRouter from "./interrupt-status.js";
import chatRouter from "./chat.js";
// import threadRouter from "./thread.js"; // Removed
import workflowRouter from "./workflow.js";
// import { startProposalGeneration } from "./express-handlers/start.js"; // Removed

// Initialize logger
const logger = Logger.getInstance();

// Create RFP router
const router = express.Router();

// Mount the new workflow router first for /api/rfp/workflow/init
router.use("/workflow", workflowRouter);

// Direct route handlers (like /start) might be deprecated or refactored
// if /workflow/init becomes the sole entry point for starting.
// router.post("/start", startProposalGeneration); // This is now obsolete and removed

// Sub-routers for other functionalities
router.use("/feedback", feedbackRouter);
router.use("/resume", resumeRouter);
router.use("/interrupt-status", interruptStatusRouter);
router.use("/chat", chatRouter);
// router.use("/thread", threadRouter); // This is now obsolete and removed

export default router;
