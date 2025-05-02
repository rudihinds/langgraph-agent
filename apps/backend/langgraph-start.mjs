#!/usr/bin/env node

/**
 * LangGraph Server Startup Script with Path Aliases (ESM Version)
 *
 * This script initializes path aliases before starting the LangGraph server.
 * It ensures that TypeScript path aliases like @/lib/* work at runtime.
 */
import { register } from "tsconfig-paths";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { spawn } from "child_process";
import * as fs from "fs";

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const tsconfigPath = resolve(__dirname, "tsconfig.json");

try {
  // Load tsconfig.json
  const tsconfigRaw = fs.readFileSync(tsconfigPath, "utf8");
  const tsconfig = JSON.parse(tsconfigRaw);

  // Create a more robust path mapping that explicitly handles .js extensions
  const paths = { ...tsconfig.compilerOptions.paths };
  const enhancedPaths = {};

  // Process each path to ensure .js extensions are properly handled
  Object.entries(paths).forEach(([key, value]) => {
    // Store the original path mapping
    enhancedPaths[key] = value;

    // If the key doesn't end with .js, add an additional mapping for .js extension
    if (!key.endsWith(".js*")) {
      const jsKey = key.endsWith("*") ? key.replace("*", ".js*") : `${key}.js`;
      enhancedPaths[jsKey] = value.map((path) =>
        path.endsWith("*") ? path : `${path}.js`
      );
    }
  });

  // Register the paths with explicit configuration
  register({
    baseUrl: resolve(__dirname, tsconfig.compilerOptions.baseUrl),
    paths: enhancedPaths,
    // Add explicit extension handling for ESM
    addMatchAll: true,
  });

  console.log("✅ TypeScript path aliases registered for runtime");
} catch (error) {
  console.error("❌ Failed to register TypeScript path aliases:", error);
  console.error("This might cause import errors with @/ path aliases.");
}

console.log("🚀 Starting LangGraph server...");

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
    cwd: resolve(__dirname, "../.."),
    env: {
      ...process.env,
      NODE_OPTIONS:
        "--experimental-specifier-resolution=node --experimental-modules",
    },
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
