import express from "express";
import { Logger } from "../../lib/logger.js";
// DEPRECATED: These types are related to local checkpointer management, which is now handled by the LangGraph server.
// import {
//   BaseCheckpointSaver,
//   Checkpoint,
//   CheckpointMetadata,
// } from "@langchain/langgraph";
// DEPRECATED: This type is related to local graph instance, which is now handled by the LangGraph server.
// import type { CompiledStateGraph } from "@langchain/langgraph";
import { v4 as uuidv4 } from "uuid"; // May still be used if this API needs to generate thread identifiers for the LangGraph server or SDK.
// DEPRECATED: RunnableConfig is primarily used with local graph/checkpointer operations.
// import { RunnableConfig } from "@langchain/core/runnables";
// DEPRECATED: createCheckpointer is for local checkpointer instances. The lint error is pre-existing.
// import { createCheckpointer } from "@/services/[dep]checkpointer.service.js";
import { createServerClient } from "@supabase/ssr"; // Retained as user context might still be fetched here for LangGraph server.
import { Request, Response } from "express"; // Request and Response types are still needed for Express.
import { ENV } from "@/lib/config/env.js";

// Initialize logger using the singleton pattern
const logger = Logger.getInstance();

// DEPRECATED: This interface defines dependencies for a local graph and checkpointer,
// which are no longer managed by this Express server.
// interface LangGraphRouterDependencies {
//   graphInstance: CompiledStateGraph<any, any, any>;
//   checkpointerInstance: BaseCheckpointSaver;
// }

// DEPRECATED: ChannelVersions was used with local checkpointer operations.
// type ChannelVersions = any;

// DEPRECATED: This function's primary role was to set up routes interacting with local graph/checkpointer instances.
// Its parameters `graphInstance` and `checkpointerInstance` are no longer supplied locally as these
// components are managed by the LangGraph server.
// Consider refactoring or removing this router if its routes are fully superseded by direct SDK interaction
// with the LangGraph server.
export function createLangGraphRouter(
  // DEPRECATED: graphInstance and checkpointerInstance are no longer passed locally.
  // { graphInstance, checkpointerInstance }: LangGraphRouterDependencies
  _DEPRECATED_params: {} // Using a placeholder for original params to avoid unused variable errors.
                         // The function signature should be updated based on its revised purpose, if any.
): express.Router {
  const router = express.Router();

  // GET /info
  // This endpoint provides general assistant information and may still be relevant
  // for client SDKs to discover assistant capabilities.
  router.get("/info", (req, res) => {
    logger.info("GET /info called");
    res.status(200).json({
      assistant_id: "proposal-generation", // TODO: Make dynamic if needed, e.g., from config
      name: "Proposal Agent",
    });
  });

  // POST /threads
  // DEPRECATED: Direct local thread creation and checkpointing are now handled by the LangGraph server.
  // This endpoint's logic for local checkpoint creation is deprecated.
  // If the SDK still calls this endpoint, it might expect a `thread_id` in response.
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

    // --- DEPRECATED BLOCK: Local Thread and Checkpoint Creation ---
    // The following code block was responsible for creating a thread and its initial checkpoint
    // using a local checkpointer instance. This functionality is now superseded by the
    // LangGraph server, which manages graph execution and state persistence.
    /*
    try {
      const assistantId = req.body.assistant_id;
      const threadMetadataFromRequest = req.body.metadata || {};
      logger.info(`Attempting to create thread for assistant: ${assistantId}`, {
        metadata: threadMetadataFromRequest,
      });

      // --- Get Authenticated User ID ---
      // This logic for fetching userId was part of the local checkpoint creation.
      // If user context needs to be passed to the LangGraph server, it should be handled
      // in the new workflow that interacts with the LangGraph server.
      let userId = ENV.TEST_USER_ID || "anonymous";
      try {
        const supabase = createServerClient(
          ENV.SUPABASE_URL!,
          ENV.SUPABASE_ANON_KEY!,
          {
            cookies: {
              get(key: string) { return req.cookies[key]; },
              set(key: string, value: string, options: any) { res.cookie(key, value, options); },
              remove(key: string, options: any) { res.clearCookie(key, options); },
            },
          }
        );
        const { data: { user }, error: authError } = await supabase.auth.getUser();
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
      }
      // --- End Get Authenticated User ID ---

      const threadId = uuidv4(); // Locally generated threadId
      const config: RunnableConfig = { // RunnableConfig for local checkpointer
        configurable: {
          thread_id: threadId,
          // thread_metadata: { ...threadMetadataFromRequest, userId }, // Example of including userId
        },
      };

      const initialCheckpoint: Checkpoint = {
        v: 1,
        id: uuidv4(),
        ts: new Date().toISOString(),
        channel_values: { __root__: null },
        channel_versions: {},
        versions_seen: {},
        pending_sends: [],
      };

      const initialMetadata: CheckpointMetadata = {
        source: "input",
        step: -1,
        writes: {},
        parents: {},
        // thread_metadata: { ...threadMetadataFromRequest, userId },
      };

      const initialChannelVersions: ChannelVersions = {};

      // DEPRECATED: Usage of local createCheckpointer
      const checkpointer = await createCheckpointer("langgraph-api-thread-init");

      // DEPRECATED: Usage of local checkpointer.put()
      await checkpointer.put(
        config,
        initialCheckpoint,
        initialMetadata,
        initialChannelVersions
      );
      logger.debug("Used standardized checkpointerInstance.put(config, checkpoint, metadata, versions)");

      logger.info(`Successfully created initial checkpoint for thread: ${threadId}`);

      res.status(200).json({ thread_id: threadId }); // Original response
    } catch (error) {
      logger.error("Error creating thread:", error);
      res.status(500).json({ error: "Failed to create thread" });
    }
    */
    // --- END DEPRECATED BLOCK ---

    // New behavior: Acknowledge thread creation request.
    // The actual thread and state are managed by the LangGraph server.
    // This API might still generate a `thread_id` if the client SDK expects it immediately.
    const threadId = uuidv4(); // Generate a thread_id as SDKs might expect it.
    logger.info(
      `POST /threads: Responding with thread_id ${threadId}. Actual thread management is on LangGraph server.`
    );
    res.status(201).json({ // Using 201 Created as a thread identifier is notionally created.
      thread_id: threadId,
      message: "Thread identifier created. Further operations via LangGraph server.",
    });
  });

  // GET /threads/:thread_id/state
  // DEPRECATED: Fetching state directly via this API using a local checkpointer is deprecated.
  // State should be retrieved using the LangGraph SDK, which interacts with the LangGraph server.
  router.get("/threads/:thread_id/state", async (req, res, next) => {
    const { thread_id } = req.params;
    const endpoint = `GET /threads/${thread_id}/state`;
    logger.info(`${endpoint} request received`);

    // --- DEPRECATED BLOCK: Local State Fetching ---
    // The following code block attempted to fetch state using a local checkpointer instance.
    // This is no longer applicable as state is managed by the LangGraph server.
    /*
    try {
      // DEPRECATED: checkpointerInstance is no longer available locally.
      // if (!checkpointerInstance) { // This check refers to the deprecated local instance
      //   logger.error(`${endpoint}: Checkpointer not available in router`);
      //   throw new Error("Checkpointer not available");
      // }

      // DEPRECATED: RunnableConfig for local checkpointer
      // const config: RunnableConfig = { configurable: { thread_id } };

      logger.info(`${endpoint}: Attempting to fetch state (local logic deprecated)...`);
      // DEPRECATED: checkpointerInstance.get() is for local checkpointer.
      // const checkpointSaved = await checkpointerInstance.get(config);
      // logger.debug("Used standardized checkpointerInstance.get(config)");

      // if (checkpointSaved) {
      //   logger.info(`${endpoint}: State found (local logic deprecated)`);
      //   res.json(checkpointSaved); // This would have returned locally stored state.
      // } else {
      //   logger.warn(`${endpoint}: Thread state not found (local logic deprecated)`);
      //   res.status(404).json({ error: "Thread state not found" });
      // }
    } catch (error) {
      logger.error(`${endpoint}: Error in deprecated state fetching logic:`, error);
      next(error); // Pass error to Express error handler
    }
    */
    // --- END DEPRECATED BLOCK ---

    logger.warn(
      `${endpoint}: Local state fetching is deprecated. Client should use LangGraph SDK to get state from LangGraph server.`
    );
    res.status(501).json({
      error: "Not Implemented: State fetching is handled by the LangGraph server. Use LangGraph SDK.",
    });
  });

  // POST /threads/:thread_id/runs
  // DEPRECATED: Graph invocation is now handled by the LangGraph server.
  // Clients should use the LangGraph SDK to start runs on the LangGraph server.
  router.post("/threads/:thread_id/runs", (req, res) => {
    const { thread_id } = req.params;
    logger.info(`POST /threads/${thread_id}/runs called`, { body: req.body });
    logger.warn(
      `POST /threads/${thread_id}/runs: Local graph invocation is deprecated. Use LangGraph server/SDK.`
    );
    // Original TODO: Implement graph invocation using standardized checkpointerInstance and graphInstance
    // New Status: This functionality is now managed by the LangGraph server.
    res.status(501).json({
      error: "Not Implemented: Graph invocation is handled by the LangGraph server. Use LangGraph SDK.",
    });
  });

  return router;
}

// Remove the default export of the router instance
// export default router;
