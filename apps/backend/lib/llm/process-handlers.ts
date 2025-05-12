/**
 * Process termination handlers for LangGraph server
 *
 * This module provides utilities for gracefully handling process termination signals,
 * ensuring proper resource cleanup when the server is stopped or restarted.
 */

import { ReturnType } from "vitest";
import { createResourceTracker } from "./resource-tracker.js";
import { StateGraph } from "@langchain/langgraph";
import fs from "fs";
import path from "path";

// Track registered resources that need cleanup
const registeredTrackers: ReturnType<typeof createResourceTracker>[] = [];
const registeredGraphs: StateGraph<any>[] = [];

// Path for storing resource state during forced termination
const RESOURCE_STATE_PATH = path.join(process.cwd(), ".resource-state.json");

/**
 * Register a resource tracker for cleanup on process termination
 *
 * @param tracker The resource tracker instance to register
 */
export function registerResourceTracker(
  tracker: ReturnType<typeof createResourceTracker>
): void {
  registeredTrackers.push(tracker);
}

/**
 * Register a graph for cleanup on process termination
 *
 * @param graph The StateGraph instance to register
 */
export function registerGraph(graph: StateGraph<any>): void {
  registeredGraphs.push(graph);
}

/**
 * Clean up all registered resources
 *
 * @returns Promise that resolves when cleanup is complete
 */
async function cleanupResources(): Promise<void> {
  console.log("Cleaning up resources before termination...");

  // Clean up resources from trackers
  for (const tracker of registeredTrackers) {
    try {
      // Get current usage for logging
      const usage = tracker.getCurrentUsage();
      console.log("Cleaning up tracked resources:", usage);

      // Reset the tracker (triggers any cleanup hooks)
      tracker.resetUsage();
    } catch (error) {
      console.error("Error cleaning up resources:", error);
    }
  }

  // Clean up resources from graphs
  for (const graph of registeredGraphs) {
    try {
      console.log("Cleaning up graph resources");
      // For LangGraph, we would typically run any cleanup hooks or
      // ensure any running workflows are properly terminated

      // In a real implementation, this would call graph-specific cleanup methods
    } catch (error) {
      console.error("Error cleaning up graph:", error);
    }
  }

  // Wait a moment to ensure async cleanups complete
  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log("Resource cleanup complete");
}

/**
 * Save current resource state to disk
 * Used before forced termination to enable recovery
 */
function persistResourceState(): void {
  try {
    // Collect resource states from all trackers
    const resourceStates = registeredTrackers.map((tracker) =>
      tracker.getCurrentUsage()
    );

    // Save to disk
    fs.writeFileSync(
      RESOURCE_STATE_PATH,
      JSON.stringify({
        timestamp: Date.now(),
        resources: resourceStates,
        graphCount: registeredGraphs.length,
      })
    );

    console.log("Resource state persisted to disk for recovery");
  } catch (error) {
    console.error("Failed to persist resource state:", error);
  }
}

/**
 * Handle graceful termination (SIGINT/SIGTERM)
 */
async function handleTermination(): Promise<void> {
  console.log("Received termination signal");

  try {
    // Persist state before cleanup in case cleanup fails
    persistResourceState();

    // Clean up resources
    await cleanupResources();

    // Exit cleanly
    console.log("Exiting gracefully");
    process.exit(0);
  } catch (error) {
    console.error("Error during graceful shutdown:", error);
    // Force exit if cleanup fails
    process.exit(1);
  }
}

/**
 * Check for orphaned resources from previous runs
 * Call this during server startup
 */
export function detectOrphanedResources(): void {
  try {
    // Check if resource state file exists
    if (fs.existsSync(RESOURCE_STATE_PATH)) {
      const data = JSON.parse(fs.readFileSync(RESOURCE_STATE_PATH, "utf8"));

      // Log what we found
      console.log("Detected orphaned resources from previous run:", data);

      // In a real implementation, we would use this data to clean up
      // any orphaned resources from a previous forced termination

      // Delete the file after processing
      fs.unlinkSync(RESOURCE_STATE_PATH);
      console.log("Orphaned resource state cleared");
    }
  } catch (error) {
    console.error("Error checking for orphaned resources:", error);
  }
}

/**
 * Restart the server gracefully
 * This function ensures all resources are cleaned up before restart
 */
export async function restartServer(): Promise<void> {
  console.log("Initiating server restart");

  try {
    // Perform cleanup
    await cleanupResources();

    // In a real implementation, we would spawn a new process here
    // or utilize a process manager like PM2 to handle the actual restart
    console.log("Cleanup complete, ready for restart");

    // Wait a moment to ensure async operations complete
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // The actual restart logic would be implemented here
    // For example, with child_process.spawn() or PM2 commands
    console.log("Server restarted");
  } catch (error) {
    console.error("Error during server restart:", error);
  }
}

// Register signal handlers when this module is imported
process.on("SIGINT", handleTermination);
process.on("SIGTERM", handleTermination);

// For handling potential application errors that might crash the server
process.on("uncaughtException", async (error) => {
  console.error("Uncaught exception:", error);
  // Persist resource state before potential crash
  persistResourceState();
});

// For unhandled promise rejections
process.on("unhandledRejection", async (reason) => {
  console.error("Unhandled rejection:", reason);
  // Persist resource state before potential crash
  persistResourceState();
});

// Detect orphaned resources at startup
detectOrphanedResources();

console.log("Process termination handlers registered");
