/**
 * RFP API Router
 *
 * This module configures and exports the Express router for RFP-related endpoints.
 * It applies authentication middleware to all routes.
 */

import express from "express";
import { Logger } from "../../lib/logger.js";
import { authMiddleware } from "../../lib/middleware/auth.js";

// Import route handlers
import chatRouter from "./chat.js";

// Initialize logger
const logger = Logger.getInstance();

// Create router
const router = express.Router();

// Apply authentication middleware to all RFP routes
router.use(authMiddleware);

// Log requests
router.use((req, res, next) => {
  logger.info(`RFP API Request: ${req.method} ${req.originalUrl}`);
  // Add user ID from auth middleware if available
  if (req.user) {
    logger.info(`Authenticated user: ${req.user.id}`);
  }
  next();
});

// Mount sub-routers
router.use("/chat", chatRouter);

// Export router
export default router;
