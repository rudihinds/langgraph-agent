/**
 * Custom LangGraph server startup script with authentication
 *
 * This script initializes and starts a LangGraph server with Supabase authentication.
 * It loads graphs from the configuration and applies our custom auth handler.
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { Logger } from "./lib/logger.js";
import { authenticatedLangGraphServer } from "./lib/supabase/langgraph-server.js";
import { registerAgentGraphs } from "./register-agent-graphs.js";

// Initialize logger
const logger = Logger.getInstance();

// Load environment variables
dotenv.config();

// Get the directory name for resolving paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");

// Log startup information
logger.info("Starting authenticated LangGraph server");

async function startServer() {
  try {
    // Load configuration
    const configPath = path.join(projectRoot, "langgraph.json");
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }

    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    logger.info(`Loaded configuration from ${configPath}`);

    // Register graphs with the server
    await registerAgentGraphs(authenticatedLangGraphServer, config.graphs);

    // Start the server
    await authenticatedLangGraphServer.start();
    logger.info(
      `Authenticated LangGraph server running on port ${authenticatedLangGraphServer.port}`
    );
  } catch (error) {
    logger.error("Failed to start LangGraph server:", error);
    process.exit(1);
  }
}

// Start the server
startServer();
