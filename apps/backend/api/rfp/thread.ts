/**
 * RFP Thread API Endpoints
 *
 * Handles operations related to thread management for RFP documents,
 * implementing LangGraph's authentication best practices.
 */

import { Router } from "express";
import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { SupabaseClient } from "@supabase/supabase-js";
import { ThreadService } from "../../services/thread.service.js";
import { Logger } from "../../lib/logger.js";
import { requireAuth } from "../../lib/middleware/auth.js";

// Extend the Express Request type to include auth properties
interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email?: string;
  };
  supabase: SupabaseClient;
  tokenExpiresIn?: number;
  tokenRefreshRecommended?: boolean;
}

// Initialize logger
const logger = Logger.getInstance();

// Request schema for getting or creating a thread
const GetOrCreateThreadSchema = z.object({
  rfpId: z.string().uuid({
    message: "RFP ID must be a valid UUID",
  }),
});

// Response schema for thread operations
const ThreadResponseSchema = z.object({
  threadId: z.string(),
  isNew: z.boolean().optional(),
});

// Create router
const router = Router();

/**
 * Manual validation middleware to validate request parameters
 */
function validateRfpId(req: Request, res: Response, next: NextFunction) {
  try {
    // Validate the rfpId parameter
    const { rfpId } = req.params;

    // Check if rfpId is provided
    if (!rfpId) {
      return res.status(400).json({
        error: "Missing parameter",
        message: "RFP ID is required",
      });
    }

    // Check if rfpId is a valid UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(rfpId)) {
      return res.status(400).json({
        error: "Invalid parameter",
        message: "RFP ID must be a valid UUID",
      });
    }

    // Validation passed
    next();
  } catch (error) {
    logger.error("Validation error", { error });
    res.status(400).json({
      error: "Validation error",
      message:
        error instanceof Error ? error.message : "Unknown validation error",
    });
  }
}

/**
 * GET /api/rfp/thread/:rfpId
 *
 * Get or create a thread for an RFP document
 */
router.get(
  "/:rfpId",
  requireAuth,
  validateRfpId,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { rfpId } = req.params;

      // Get authenticated user and Supabase client from request
      // These are attached by the requireAuth middleware
      const userId = req.user.id;
      const supabase = req.supabase;

      // Create thread service with authenticated context
      const threadService = new ThreadService(supabase, userId);

      // Get or create thread mapping
      const result = await threadService.getOrCreateThreadForRFP(rfpId);

      // Add token refresh header if needed
      if (req.tokenRefreshRecommended) {
        res.setHeader("X-Token-Refresh-Recommended", "true");
      }

      // Return thread ID and whether it's new
      return res.status(200).json({
        threadId: result.threadId,
        isNew: result.isNew,
      });
    } catch (error) {
      logger.error("Error in get thread endpoint", {
        error,
        rfpId: req.params.rfpId,
        userId: req.user?.id,
      });
      next(error);
    }
  }
);

/**
 * GET /api/rfp/thread
 *
 * Get all threads for the current user
 */
router.get(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Get authenticated user and Supabase client from request
      const userId = req.user.id;
      const supabase = req.supabase;

      // Create thread service with authenticated context
      const threadService = new ThreadService(supabase, userId);

      // Get all threads for this user
      const threads = await threadService.getUserThreads();

      // Add token refresh header if needed
      if (req.tokenRefreshRecommended) {
        res.setHeader("X-Token-Refresh-Recommended", "true");
      }

      // Return the threads
      return res.status(200).json({ threads });
    } catch (error) {
      logger.error("Error in get threads endpoint", {
        error,
        userId: req.user?.id,
      });
      next(error);
    }
  }
);

/**
 * DELETE /api/rfp/thread/:threadId
 *
 * Delete a thread mapping
 */
router.delete(
  "/:threadId",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { threadId } = req.params;

      // Get authenticated user and Supabase client from request
      const userId = req.user.id;
      const supabase = req.supabase;

      // Create thread service with authenticated context
      const threadService = new ThreadService(supabase, userId);

      // Delete the thread mapping
      await threadService.deleteThreadMapping(threadId);

      // Add token refresh header if needed
      if (req.tokenRefreshRecommended) {
        res.setHeader("X-Token-Refresh-Recommended", "true");
      }

      // Return success
      return res.status(200).json({ success: true });
    } catch (error) {
      logger.error("Error in delete thread endpoint", {
        error,
        threadId: req.params.threadId,
        userId: req.user?.id,
      });
      next(error);
    }
  }
);

export default router;
