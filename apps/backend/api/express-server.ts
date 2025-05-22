/**
 * Express server configuration for the Proposal Generator API.
 *
 * This file initializes and configures the Express application,
 * setting up middleware, routes, and error handling.
 */

import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { Logger } from "../lib/logger.js";
import { authMiddleware } from "../lib/middleware/auth.js";
import rfpRouter from "./rfp/index.js";

// Initialize logger
const logger = Logger.getInstance();

// Create Express application with explicit type
const app: Application = express();

// Apply security middleware
app.use(helmet());

// Configure CORS - in production, this should be more restrictive
app.use(cors());

// Apply cookie parser middleware
app.use(cookieParser());

// Parse request bodies
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Apply authentication middleware specifically to /rfp routes
app.use("/rfp", authMiddleware);

// Mount the RFP router
app.use("/rfp", rfpRouter);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Info endpoint for LangGraph client
app.get("/info", (req, res) => {
  res.json({
    status: "ok",
    name: "LangGraph Agent API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// Global error handler
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error(`Error processing request: ${err.message}`, err);

    // Don't expose internal error details in production
    res.status(500).json({
      error: "Internal server error",
      message:
        process.env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : err.message,
    });
  }
);

// 404 handler for unmatched routes
app.use((req, res) => {
  logger.info(`Route not found: ${req.method} ${req.url}`);
  res.status(404).json({
    error: "Not found",
    message: "The requested endpoint does not exist",
  });
});

// Export the configured app
export { app };
