#!/usr/bin/env node

/**
 * LangGraph Server Startup Script with Path Aliases
 *
 * This script initializes path aliases before starting the LangGraph server.
 * It ensures that TypeScript path aliases like @/lib/* work at runtime.
 */

// Register path aliases from tsconfig.json
require("tsconfig-paths/register");

// Log success info
console.log("✅ TypeScript path aliases registered for runtime");
console.log("🚀 Starting LangGraph server...");

// Import and execute the LangGraph CLI
const { spawn } = require("child_process");
const path = require("path");

// Start LangGraph server with the same arguments passed to this script
const serverProcess = spawn(
  "npx",
  [
    "@langchain/langgraph-cli",
    "dev",
    "--port",
    "2024",
    "--config",
    "langgraph.json",
  ],
  {
    stdio: "inherit",
    cwd: path.resolve(__dirname, "../.."),
  }
);

// Forward exit signals to the LangGraph server
["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, () => {
    serverProcess.kill(signal);
  });
});

// Forward exit code from LangGraph server
serverProcess.on("exit", (code) => {
  process.exit(code);
});
