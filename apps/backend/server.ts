/**
 * Express server for the proposal generation API
 */

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { Logger } from "./lib/logger.js";
import rfpRouter from "./api/rfp/index.js";

// Initialize logger
const logger = Logger.getInstance();

// Create Express application
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Mount routers
app.use("/api/rfp", rfpRouter);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handler
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error(`Error processing request: ${err.stack || err.message}`);
    res.status(500).json({
      error: "Internal Server Error",
      message:
        process.env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : err.message,
    });
  }
);

// 404 handler
app.use((req, res) => {
  logger.info(`Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    error: "Not Found",
    message: "The requested endpoint does not exist",
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`Server running at http://localhost:${PORT}`);
  logger.info("Available endpoints:");
  logger.info("  GET /api/health");
  logger.info("  POST /api/rfp/start");
  logger.info("  POST /api/rfp/feedback");
  logger.info("  POST /api/rfp/resume");
  logger.info("  GET /api/rfp/interrupt-status");
});
