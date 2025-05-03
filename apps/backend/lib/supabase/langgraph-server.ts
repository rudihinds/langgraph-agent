/**
 * LangGraph server configuration with Supabase authentication
 *
 * This file exports a function to create a LangGraph server with custom authentication.
 */

// Typing for LangGraphServer
interface LangGraphServer {
  port: number;
  static: (path: string) => void;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  addGraph: (name: string, graph: any) => void;
  on: (event: string, callback: (error: any) => void) => void;
}

// Import modules
import { Logger } from "../logger.js";
import { langGraphAuth } from "../middleware/langraph-auth.js";

// Initialize logger
const logger = Logger.getInstance();

/**
 * Creates and configures a LangGraph server with authentication
 *
 * @param options Server configuration options
 * @returns Configured LangGraph server
 */
export function createAuthenticatedLangGraphServer(options?: {
  port?: number;
  host?: string;
  verbose?: boolean;
}): LangGraphServer {
  const port = options?.port || 2024;
  const host = options?.host || "localhost";
  const verbose = options?.verbose || false;

  logger.info(`Initializing authenticated LangGraph server on ${host}:${port}`);

  try {
    // Use require to bypass TypeScript module resolution
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { LangGraphServer } = require("@langchain/langgraph-sdk/server");

    // Create the server with our custom auth handler
    const server = new LangGraphServer({
      port,
      host,
      verbose,
      auth: langGraphAuth,
    });

    // Add error handling
    server.on("error", (error) => {
      logger.error("LangGraph server error:", error);
    });

    return server;
  } catch (error) {
    logger.error("Failed to import LangGraph server:", error);
    throw new Error(
      "Failed to import LangGraphServer from @langchain/langgraph-sdk/server. Make sure the package is installed."
    );
  }
}

/**
 * Authenticated LangGraph server instance
 */
export const authenticatedLangGraphServer =
  createAuthenticatedLangGraphServer();
