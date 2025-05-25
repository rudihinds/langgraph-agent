import express from "express";
import { Logger } from "../../lib/logger.js";
import proposalThreadsRouter from "./proposalThreads.js";

// Initialize logger
const logger = Logger.getInstance();

// Create RFP router
const router = express.Router();

// Active routes - proposal thread management
router.use("/proposal_threads", proposalThreadsRouter);

export default router;
