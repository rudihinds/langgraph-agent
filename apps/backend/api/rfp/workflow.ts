import express, { Request, Response, NextFunction } from "express";
import { Logger } from "../../lib/logger.js";

import { AuthenticatedRequest } from "../../lib/types/auth.js";

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
    // TODO: Refactor or remove this endpoint. The primary flow for initializing a new proposal thread
    // when rfpId is known is now handled by the frontend (StreamProvider) generating a UUID,
    // calling POST /api/rfp/proposal_threads to record the association, and then using that UUID
    // as the thread_id for the LangGraph server. This endpoint's original responsibilities
    // (deterministic thread_id creation, graph invocation via orchestrator) are either handled
    // differently or are no longer the Express backend's role for this specific flow.
    // For now, this endpoint will return a 503 Service Unavailable.

    const { rfpId } = req.body;
    const userId = req.user?.id;
    logger.warn("Attempt to use deprecated workflow/init endpoint", {
      userId,
      rfpId,
    });

    return res.status(503).json({
      error: "Service Temporarily Unavailable",
      message:
        "The workflow initialization system is currently under reconstruction. Please ensure your client is using the latest flow involving POST /api/rfp/proposal_threads for new thread associations.",
    });

    /*
    logger.info("[API /rfp/workflow/init] Received request");
    try {
      const userId = req.user?.id; 
      const { rfpId } = req.body; 

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

      // DEPRECATED CODE:
      // const orchestratorService = await getOrchestrator();
      // const workflowContext =
      //   await orchestratorService.initOrGetProposalWorkflow(userId, rfpId);
      // if (workflowContext.isNew) {
      //   logger.info(
      //     `[API /rfp/workflow/init] New workflow for threadId: ${workflowContext.threadId}. Starting graph invocation.`
      //   );
      //   const { state: newWorkflowState } =
      //     await orchestratorService.startProposalGeneration(
      //       workflowContext.threadId, 
      //       userId,
      //       rfpId
      //     );
      //   return res.status(201).json({
      //     threadId: workflowContext.threadId,
      //     state: newWorkflowState,
      //     isNew: true,
      //   });
      // } else {
      //   logger.info(
      //     `[API /rfp/workflow/init] Existing workflow found for threadId: ${workflowContext.threadId}`
      //   );
      //   return res.status(200).json({
      //     threadId: workflowContext.threadId,
      //     state: workflowContext.initialState, 
      //     isNew: false,
      //   });
      // }

    } catch (error) {
      logger.error(
        "[API /rfp/workflow/init] Error initializing/getting workflow:",
        error
      );
      next(error); 
    }
    */
  }
);

export default router;
