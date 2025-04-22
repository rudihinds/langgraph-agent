/**
 * Express server for the proposal generation API
 */

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import { Logger } from "./lib/logger.js";
import rfpRouter from "./api/rfp/index.js";
import { createProposalGenerationGraph } from "./agents/proposal-generation/graph.js";

// Initialize logger
const logger = Logger.getInstance();

// Set up file paths for configuration
const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, "..", "..", "langgraph.json");

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

// ===== LangGraph Integration =====
try {
  // Read the LangGraph configuration
  const configExists = fs.existsSync(configPath);
  if (configExists) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    logger.info(`LangGraph configuration loaded from: ${configPath}`);

    // Create the proposal generation graph
    const graph = createProposalGenerationGraph();

    // Add LangGraph endpoints
    app.post("/api/langgraph/run", async (req, res) => {
      try {
        const { input } = req.body;
        logger.info("Running LangGraph with input:", input);
        const result = await graph.invoke(input);
        res.json({ output: result });
      } catch (error) {
        logger.error("Error running graph:", error);
        res.status(500).json({ error: error.message });
      }
    });

    logger.info("LangGraph routes initialized at /api/langgraph/run");
  } else {
    logger.warn(`LangGraph configuration not found at: ${configPath}`);
  }
} catch (error) {
  logger.error(`Error initializing LangGraph: ${error.message}`);
}

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
  logger.info("  POST /api/langgraph/run");
});
