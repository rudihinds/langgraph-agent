import express from "express";
import { Logger } from "../../lib/logger.js";
import {
  BaseCheckpointSaver,
  Checkpoint,
  CheckpointMetadata,
} from "@langchain/langgraph";
import type { CompiledStateGraph } from "@langchain/langgraph";
import { v4 as uuidv4 } from "uuid";
import { RunnableConfig } from "@langchain/core/runnables";
import { createCheckpointer } from "@/services/[dep]checkpointer.service.js";
import { createServerClient } from "@supabase/ssr";
import { Request, Response } from "express";
import { ENV } from "@/lib/config/env.js";

// Initialize logger using the singleton pattern
const logger = Logger.getInstance();

// Define types for the instances passed in
interface LangGraphRouterDependencies {
  graphInstance: CompiledStateGraph<any, any, any>;
  checkpointerInstance: BaseCheckpointSaver;
}

// Placeholder for ChannelVersions until import path is resolved
// We will use 'any' for now
type ChannelVersions = any;

export function createLangGraphRouter({
  graphInstance,
  checkpointerInstance,
}: LangGraphRouterDependencies): express.Router {
  // Create LangGraph router
  const router = express.Router();

  // GET /info
  router.get("/info", (req, res) => {
    logger.info("GET /info called");
    res.status(200).json({
      assistant_id: "proposal-agent", // TODO: Make dynamic if needed
      name: "Proposal Agent",
    });
  });

  // POST /threads
  router.post("/threads", async (req, res) => {
    logger.info("POST /threads request received", { body: req.body });

    if (!req.body?.assistant_id) {
      logger.warn("POST /threads: assistant_id missing in request body.", {
        body: req.body,
      });
      return res
        .status(400)
        .json({ error: "Missing assistant_id in request body" });
    }

    try {
      const assistantId = req.body.assistant_id;
      const threadMetadataFromRequest = req.body.metadata || {}; // Capture incoming metadata
      logger.info(`Attempting to create thread for assistant: ${assistantId}`, {
        metadata: threadMetadataFromRequest,
      });

      // --- Get Authenticated User ID ---
      let userId = ENV.TEST_USER_ID || "anonymous"; // Default/fallback
      try {
        // Ensure cookie-parser middleware is used in your Express app
        const supabase = createServerClient(
          ENV.SUPABASE_URL!,
          ENV.SUPABASE_ANON_KEY!,
          {
            cookies: {
              get(key: string) {
                return req.cookies[key];
              },
              set(key: string, value: string, options: any) {
                // Note: Setting cookies might not be directly needed here
                // but is part of the required interface for server client
                res.cookie(key, value, options);
              },
              remove(key: string, options: any) {
                // Note: Removing cookies might not be directly needed here
                res.clearCookie(key, options);
              },
            },
          }
        );
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError) {
          logger.warn("Auth error getting user:", authError.message);
        } else if (user?.id) {
          userId = user.id;
          logger.info(`Authenticated user ID found: ${userId}`);
        } else {
          logger.warn("No authenticated user found, using default/anonymous.");
        }
      } catch (error: any) {
        logger.error("Error fetching user ID:", error.message);
        // Proceed with default/anonymous userId
      }
      // --- End Get Authenticated User ID ---

      const threadId = uuidv4();
      const config: RunnableConfig = {
        configurable: {
          thread_id: threadId,
          // Pass thread-level metadata if needed by the graph/checkpointer
          // thread_metadata: threadMetadataFromRequest,
        },
      };

      // Create an initial checkpoint
      const initialCheckpoint: Checkpoint = {
        v: 1,
        id: uuidv4(), // Checkpoint's own ID
        ts: new Date().toISOString(),
        channel_values: { __root__: null }, // LangGraph expects a non-empty initial state usually
        channel_versions: {}, // Initial channel versions
        versions_seen: {},
        pending_sends: [],
      };

      // Define initial metadata for the checkpoint write operation
      const initialMetadata: CheckpointMetadata = {
        source: "input", // Use 'input' for initial state creation
        step: -1,
        writes: {},
        parents: {},
        // Incorporate thread-level metadata if the checkpointer schema supports it
        // thread_metadata: threadMetadataFromRequest,
      };

      // Initial channel versions (empty for new thread)
      const initialChannelVersions: ChannelVersions = {}; // Using placeholder type

      // Use the correct factory function to create the checkpointer
      const checkpointer = await createCheckpointer(
        "langgraph-api-thread-init"
      ); // Use a descriptive name

      // Use the standardized 4-argument put() method for all checkpointers
      await checkpointer.put(
        config,
        initialCheckpoint,
        initialMetadata,
        initialChannelVersions
      );
      logger.debug(
        "Used standardized checkpointerInstance.put(config, checkpoint, metadata, versions)"
      );

      logger.info(
        `Successfully created initial checkpoint for thread: ${threadId}`
      );

      // Return the standard response expected by the SDK
      res.status(200).json({ thread_id: threadId });
    } catch (error) {
      logger.error("Error creating thread:", error);
      res.status(500).json({ error: "Failed to create thread" });
    }
  });

  // GET /threads/:thread_id/state
  router.get("/threads/:thread_id/state", async (req, res, next) => {
    const { thread_id } = req.params;
    const endpoint = `GET /threads/${thread_id}/state`;
    logger.info(`${endpoint} request received`);

    try {
      if (!checkpointerInstance) {
        logger.error(`${endpoint}: Checkpointer not available in router`);
        throw new Error("Checkpointer not available");
      }

      const config: RunnableConfig = { configurable: { thread_id } };

      logger.info(`${endpoint}: Fetching state...`);
      // Standardized get() returns CheckpointSaved | null
      const checkpointSaved = await checkpointerInstance.get(config);
      logger.debug("Used standardized checkpointerInstance.get(config)");

      if (checkpointSaved) {
        logger.info(`${endpoint}: State found`);
        // Respond with the channel_values from the checkpoint, or the whole checkpoint if SDK expects it
        // LangGraph SDK typically expects the full Checkpoint object for /state endpoint.
        res.json(checkpointSaved); // Send the whole Checkpoint object
      } else {
        logger.warn(`${endpoint}: Thread state not found`);
        res.status(404).json({ error: "Thread state not found" });
      }
    } catch (error) {
      logger.error(`${endpoint}: Error fetching state:`, error);
      next(error); // Pass error to Express error handler
    }
  });

  // POST /threads/:thread_id/runs
  router.post("/threads/:thread_id/runs", (req, res) => {
    const { thread_id } = req.params;
    logger.info(`POST /threads/${thread_id}/runs called`, { body: req.body });
    // TODO: Implement graph invocation using standardized checkpointerInstance and graphInstance
    res.status(501).json({ error: "Not Implemented" });
  });

  return router;
}

// Remove the default export of the router instance
// export default router;
