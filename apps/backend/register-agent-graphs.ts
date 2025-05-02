/**
 * Utilities for registering agent graphs with LangGraph server
 */

import path from "path";
import { fileURLToPath } from "url";
import { Logger } from "./lib/logger.js";

// Initialize logger
const logger = Logger.getInstance();

// Get the directory name for resolving paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define LangGraphServer interface to avoid import errors
interface LangGraphServer {
  addGraph: (name: string, graph: any) => void;
}

/**
 * Dynamically imports and registers agent graphs with LangGraph server
 *
 * @param server LangGraph server instance
 * @param graphConfig Configuration object with graph names and module paths
 */
export async function registerAgentGraphs(
  server: LangGraphServer,
  graphConfig: Record<string, string>
) {
  // Track successfully registered graphs
  const registeredGraphs: string[] = [];
  const failedGraphs: Array<{ name: string; error: string }> = [];

  for (const [graphName, modulePath] of Object.entries(graphConfig)) {
    try {
      logger.info(`Registering graph: ${graphName} from ${modulePath}`);

      // Parse the module path and export name
      const [importPath, exportName] = modulePath.split(":");

      // Import the module dynamically
      const module = await import(path.resolve(__dirname, "../..", importPath));

      // Get the graph factory function
      const graphFactory = module[exportName];

      if (typeof graphFactory !== "function") {
        throw new Error(
          `Export '${exportName}' is not a function in module '${importPath}'`
        );
      }

      // Create and register the graph
      const graph = graphFactory();
      server.addGraph(graphName, graph);

      registeredGraphs.push(graphName);
      logger.info(`✅ Registered graph: ${graphName}`);
    } catch (error: any) {
      logger.error(`❌ Failed to register graph '${graphName}':`, error);
      failedGraphs.push({
        name: graphName,
        error: error?.message || "Unknown error",
      });
    }
  }

  // Log registration summary
  logger.info(`Registered ${registeredGraphs.length} graphs successfully`);

  if (failedGraphs.length > 0) {
    logger.warn(`Failed to register ${failedGraphs.length} graphs`);
    for (const { name, error } of failedGraphs) {
      logger.warn(`  - ${name}: ${error}`);
    }
  }

  return {
    registered: registeredGraphs,
    failed: failedGraphs,
  };
}
