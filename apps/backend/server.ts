/**
 * Express server for the proposal generation API
 * Manually implements endpoints compatible with LangGraph SDK
 */

import express, { RequestHandler } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { Request, Response, NextFunction } from "express"; // Import Express types
import { BaseCheckpointSaver } from "@langchain/langgraph"; // Needed for type checking
import type { CompiledStateGraph } from "@langchain/langgraph"; // Needed for type checking
import { createServer } from "http";
import { Logger } from "@/lib/logger.js";
import { createProposalGenerationGraph } from "@/agents/proposal-generation/graph.js";
import rfpRouter from "./api/rfp/index.js";
import { createLangGraphRouter } from "./api/langgraph/index.js"; // Import the factory function
import cookieParser from "cookie-parser"; // Import cookie-parser
import helmet from "helmet";
import { app } from "./api/express-server.js"; // Import the configured app

// Initialize logger
const logger = Logger.getInstance();

// --- Global instances (will be initialized async) ---
let graphInstance: CompiledStateGraph<any, any, any> | null = null;

// Middleware

// Enable CORS
// TODO: Configure allowed origins properly for production
app.use(cors({ origin: true, credentials: true }));

// Logging middleware (before body parsing)
app.use((req, res, next) => {
  // Log basic request info and headers
  logger.info(`Request Received: ${req.method} ${req.url}`);
  logger.debug("Request Headers:", req.headers);
  // Cannot easily log body here without consuming the stream
  next();
});

// Body Parsing Middleware
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// Logging middleware (after body parsing)
app.use((req, res, next) => {
  // Log the parsed body (if any)
  logger.debug("Request Body (after bodyParser.json):", req.body);
  next();
});

// ===== Initialize LangGraph Components =====
async function initializeLangGraph() {
  try {
    logger.info(
      "Initializing LangGraph components for Express server (graph only)..."
    );
    graphInstance = await createProposalGenerationGraph();
    logger.info(
      "Proposal generation graph object created (potentially for schema or direct calls if any remain)."
    );
    logger.info(
      "Express server's LangGraph-related initializations complete (if any are still needed)."
    );

    // Ensure instances are not null before proceeding
    if (!graphInstance) {
      throw new Error("Graph failed to initialize.");
    }

    // --- Mount Routers AFTER initialization ---
    logger.info("Mounting API routers...");

    // Mount other specific routers first
    app.use("/api/rfp", rfpRouter);
    logger.info("Mounted /api/rfp router.");

    // LangGraph API is now handled by the LangGraph server
    logger.info("LangGraph API is handled by the LangGraph server.");

    // Health check can be mounted any time
    app.get("/api/health", (req, res) => {
      logger.info("GET /api/health called");
      res.status(200).json({ status: "ok" });
    });
    logger.info("Mounted /api/health route.");

    // --- Mount Final Middleware AFTER all other routes ---

    // Catch-all for 404 Not Found (should be after all specific routers)
    app.use((req, res, next) => {
      if (!res.headersSent) {
        logger.warn(`404 Not Found: ${req.method} ${req.originalUrl}`);
        res.status(404).json({ error: "Not Found" });
      }
    });

    // Global Error Handling Middleware (should be the very last middleware)
    app.use(
      (
        err: Error,
        req: Request,
        res: Response,
        next: NextFunction // Although unused, it's required for Express error middleware signature
      ) => {
        logger.error("Unhandled Express error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Internal Server Error" });
        }
      }
    );
    logger.info("Final 404 and error handling middleware configured.");
  } catch (error) {
    logger.error("FATAL: Failed during initialization or router setup:", error);
    process.exit(1); // Exit if critical initialization fails
  }
}

// --- Start Server AFTER Initialization ---
async function startServer() {
  await initializeLangGraph(); // Wait for initialization and router mounting

  const PORT = process.env.PORT || 3001; // Use a single consistent port
  const server = createServer(app); // Use the imported and augmented Express app

  server.listen(PORT, () => {
    logger.info(`Server running at http://localhost:${PORT}`);
    logger.info("Available base API paths:");
    logger.info("- /api/health (from express-server)");
    logger.info("- /api/rfp (from express-server)");
    logger.info("- /api/langgraph (mounted in server.ts)");
  });
}

// --- Run the Server Start Process ---
startServer().catch((err) => {
  logger.error("Failed to start server:", err);
  process.exit(1);
});
