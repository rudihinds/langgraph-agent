import express, { Request, Response, NextFunction } from "express";
import { Logger } from "../../lib/logger.js";
import { getOrchestrator } from "../../services/[dep]orchestrator-factory.js";
import { AuthenticatedRequest } from "../../lib/types/auth.js"; // Assuming auth middleware populates req.user

const router = express.Router();
const logger = Logger.getInstance();

/**
 * POST /api/rfp/workflow/init
 *
 * Initializes a new proposal workflow or retrieves details for an existing one.
 * Expects userId (from auth) and rfpId (from body).
 * Can also accept initialRfpData if starting a new workflow.
 */
router.post(
  "/init",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    logger.info("[API /rfp/workflow/init] Received request");
    try {
      const userId = req.user?.id; // Assuming userId is available from auth middleware
      const { rfpId } = req.body; // Removed initialRfpData

      if (!userId) {
        logger.warn("[API /rfp/workflow/init] Unauthorized: User ID missing");
        return res.status(401).json({ error: "Unauthorized: User ID missing" });
      }

      if (!rfpId) {
        logger.warn("[API /rfp/workflow/init] Bad Request: RFP ID missing");
        return res.status(400).json({ error: "RFP ID is required" });
      }

      logger.info(
        `[API /rfp/workflow/init] UserID: ${userId}, RFPID: ${rfpId}`
      );

      const orchestratorService = await getOrchestrator();
      const workflowContext =
        await orchestratorService.initOrGetProposalWorkflow(userId, rfpId);

      if (workflowContext.isNew) {
        logger.info(
          `[API /rfp/workflow/init] New workflow for threadId: ${workflowContext.threadId}. Starting graph invocation.`
        );
        // initialRfpData is no longer needed or checked here.
        // The orchestrator's startProposalGeneration (or equivalent) will handle
        // initiating the graph in a way that documentLoaderNode picks up the rfpId.

        // The call to startProposalGeneration will be adjusted.
        // It now needs the threadId determined by initOrGetProposalWorkflow.
        // Assuming startProposalGeneration is refactored to accept threadId, userId, rfpId
        // and to set up the initial graph state/message to trigger document loading.
        const { state: newWorkflowState } =
          await orchestratorService.startProposalGeneration(
            workflowContext.threadId, // Pass the determined threadId
            userId,
            rfpId
            // initialRfpData is removed
          );
        return res.status(201).json({
          threadId: workflowContext.threadId,
          state: newWorkflowState,
          isNew: true,
        });
      } else {
        logger.info(
          `[API /rfp/workflow/init] Existing workflow found for threadId: ${workflowContext.threadId}`
        );
        return res.status(200).json({
          threadId: workflowContext.threadId,
          state: workflowContext.initialState, // This is the checkpoint state
          isNew: false,
        });
      }
    } catch (error) {
      logger.error(
        "[API /rfp/workflow/init] Error initializing/getting workflow:",
        error
      );
      next(error); // Pass to global error handler
    }
  }
);

export default router;
