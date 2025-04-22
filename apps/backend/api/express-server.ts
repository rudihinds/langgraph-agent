/**
 * Express server configuration for the Proposal Generator API.
 *
 * This file initializes and configures the Express application,
 * setting up middleware, routes, and error handling.
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { Logger } from "../lib/logger.js";
import rfpRouter from "./rfp/index.js";

// Initialize logger
const logger = Logger.getInstance();

// Create Express application
const app = express();

// Apply security middleware
app.use(helmet());

// Configure CORS - in production, this should be more restrictive
app.use(cors());

// Parse request bodies
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Mount the RFP router
app.use("/api/rfp", rfpRouter);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
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

// If this file is being executed directly, start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log("Available endpoints:");
    console.log("- GET /api/health - Health check");
    console.log("- POST /api/rfp/start - Start proposal generation");
    console.log("- POST /api/rfp/feedback - Submit feedback");
    console.log("- POST /api/rfp/resume - Resume after feedback");
    console.log("- GET /api/rfp/interrupt-status - Check interrupt status");
  });
}
