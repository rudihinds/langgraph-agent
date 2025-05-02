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
import { createClient } from "@supabase/supabase-js";
import { ENV } from "../config/env.js";
import { ThreadService } from "../../services/thread.service.js";

// Initialize logger
const logger = Logger.getInstance();

/**
 * Thread validation configuration
 */
interface ThreadValidationConfig {
  /** Whether to enable thread validation */
  enabled: boolean;
  /** Whether to return a specific error for invalid thread IDs */
  strictErrorHandling: boolean;
  /** Whether to automatically create thread mappings for missing thread IDs */
  autoCreateMappings: boolean;
}

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
  threadValidation?: ThreadValidationConfig;
}): LangGraphServer {
  const port = options?.port || 2024;
  const host = options?.host || "localhost";
  const verbose = options?.verbose || false;

  // Default thread validation config
  const threadValidation = options?.threadValidation || {
    enabled: true,
    strictErrorHandling: true,
    autoCreateMappings: false,
  };

  logger.info(`Initializing authenticated LangGraph server on ${host}:${port}`);

  try {
    // Import LangGraphServer
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { LangGraphServer } = require("@langchain/langgraph-sdk");

    // Create the server with our custom auth handler and thread validation
    const server = new LangGraphServer({
      port,
      host,
      verbose,
      auth: langGraphAuth,
      // Configure interrupt handling
      allowInterrupts: true,
      // Add request interceptor with thread validation if enabled
      requestInterceptor: threadValidation.enabled
        ? createThreadValidator(threadValidation)
        : undefined,
    });

    // Enhanced error handling
    server.on("error", (error) => {
      logger.error("LangGraph server error:", error);

      // Log additional context if available
      if (error.request) {
        logger.error("Request details:", {
          path: error.request.url,
          method: error.request.method,
          headers: Object.fromEntries(error.request.headers.entries()),
        });
      }

      // Log specific error types
      if (error.message?.includes("thread_id")) {
        logger.error(
          "Thread ID error - possible invalid thread or authentication issue"
        );
      } else if (error.message?.includes("interrupt")) {
        logger.error("Interrupt handling error");
      } else if (error.message?.includes("checkpoint")) {
        logger.error("Checkpoint or state persistence error");
      }
    });

    return server;
  } catch (error) {
    logger.error("Failed to import LangGraph server:", error);
    throw new Error(
      "Failed to import LangGraphServer from @langchain/langgraph-sdk. Make sure the package is installed."
    );
  }
}

/**
 * Creates a request interceptor that validates thread IDs
 *
 * @param config Thread validation configuration
 * @returns Request interceptor function
 */
function createThreadValidator(config: ThreadValidationConfig) {
  return async (request: Request) => {
    try {
      // Get thread ID from the request
      const url = new URL(request.url);
      const pathParts = url.pathname.split("/");

      // Check if this is a thread-related request that needs validation
      const isThreadRequest =
        pathParts.includes("threads") ||
        url.searchParams.has("thread_id") ||
        url.searchParams.has("configurable.thread_id");

      if (!isThreadRequest) {
        return request; // No validation needed
      }

      // Extract thread ID from URL - check path or query params
      let threadId = pathParts.includes("threads")
        ? pathParts[pathParts.indexOf("threads") + 1]
        : url.searchParams.get("thread_id") ||
          url.searchParams.get("configurable.thread_id");

      if (!threadId) {
        // If thread ID is missing and required, throw an error
        if (config.strictErrorHandling) {
          throw new Error("Missing thread_id for thread operation");
        }
        return request; // Let request proceed without validation
      }

      // Get authentication token from request
      const authHeader = request.headers.get("authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        if (config.strictErrorHandling) {
          throw new Error(
            "Missing or invalid authorization token for thread validation"
          );
        }
        return request; // Let request proceed without validation
      }

      const token = authHeader.split(" ")[1];

      // Create supabase client and thread service
      const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      // Get user from token
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError || !userData.user) {
        if (config.strictErrorHandling) {
          throw new Error(
            `Authentication error: ${userError?.message || "Invalid token"}`
          );
        }
        return request; // Let request proceed without validation
      }

      // Validate thread belongs to user
      const threadService = new ThreadService(supabase, userData.user.id);
      const threads = await threadService.getUserThreads();
      const threadExists = threads.some((t) => t.threadId === threadId);

      if (!threadExists) {
        if (config.autoCreateMappings) {
          // If enabled, create a mapping for this thread
          logger.info(`Auto-creating thread mapping for thread ${threadId}`);
          // We'd need an RFP ID to create a proper mapping
          // This is just a placeholder for the feature
        } else if (config.strictErrorHandling) {
          // Otherwise reject if strict error handling is enabled
          throw new Error(
            `Thread ${threadId} not found for user ${userData.user.id}`
          );
        }
      }

      // Add user ID context to the request for use by handlers
      // Create a new request with modified headers
      const headers = new Headers(request.headers);
      headers.set("X-User-ID", userData.user.id);

      return new Request(request.url, {
        method: request.method,
        headers,
        body: request.body,
        cache: request.cache,
        credentials: request.credentials,
        integrity: request.integrity,
        keepalive: request.keepalive,
        mode: request.mode,
        redirect: request.redirect,
        referrer: request.referrer,
        referrerPolicy: request.referrerPolicy,
        signal: request.signal,
      });
    } catch (error) {
      logger.error("Thread validation error:", error);
      // In case of validation error, we return the original request
      // The error will be handled by the server's auth handler
      return request;
    }
  };
}

/**
 * Authenticated LangGraph server instance with default configuration
 */
export const authenticatedLangGraphServer = createAuthenticatedLangGraphServer({
  threadValidation: {
    enabled: true,
    strictErrorHandling: process.env.NODE_ENV === "production",
    autoCreateMappings: process.env.NODE_ENV !== "production",
  },
});
