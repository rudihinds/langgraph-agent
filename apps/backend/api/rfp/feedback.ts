import express from "express";
import { z } from "zod";
import { Logger } from "../../lib/logger.js";
import { getOrchestrator } from "../../services/orchestrator-factory.js";
import { FeedbackType } from "../../lib/types/feedback.js";

// Initialize logger
const logger = Logger.getInstance();

const router = express.Router();

// Validation schema for feedback
const feedbackSchema = z
  .object({
    threadId: z.string().min(1, "ThreadId is required"),
    feedbackType: z.enum(
      [FeedbackType.APPROVE, FeedbackType.REVISE, FeedbackType.REGENERATE],
      {
        errorMap: () => ({ message: "Invalid feedback type" }),
      }
    ),
    // Comments are required for REVISE, optional for others
    comments: z.string().optional(),
    // Edited content is conceptually removed, REVISE/REGENERATE use comments/guidance
    // editedContent: z.string().optional(),
    // Optional custom instructions for revisions/regeneration
    customInstructions: z.string().optional(),
  })
  .refine(
    (data) => {
      // If type is REVISE, comments should be provided (or customInstructions)
      if (
        data.feedbackType === FeedbackType.REVISE &&
        !data.comments &&
        !data.customInstructions
      ) {
        return false;
      }
      // Removed check for editedContent
      return true;
    },
    {
      message:
        "Comments or custom instructions are required for REVISE feedback",
      path: ["feedbackType"],
    }
  );

/**
 * @description Post route to submit feedback for a proposal
 * @param proposalId - The ID of the proposal to submit feedback for
 * @param feedbackType - The type of feedback (approve, revise, edit)
 * @param comments - Optional feedback comments
 * @param editedContent - Required for edit type, the revised content
 * @param customInstructions - Optional custom instructions for revision
 * @returns {Object} - Object indicating the success status
 */
router.post("/", async (req, res) => {
  try {
    // Validate request body
    const result = feedbackSchema.safeParse(req.body);
    if (!result.success) {
      logger.error("Invalid feedback submission", {
        error: result.error.issues,
      });
      return res.status(400).json({
        error: "Invalid request",
        details: result.error.issues,
      });
    }

    const {
      threadId,
      feedbackType,
      comments = "",
      customInstructions,
    } = result.data;

    logger.info("Processing feedback submission", {
      threadId,
      feedbackType,
    });

    // Get orchestrator
    const orchestrator = await getOrchestrator();

    // Get interrupt details to retrieve the correct contentReference
    const interruptStatus = await orchestrator.getInterruptStatus(threadId);
    const contentReference =
      interruptStatus.interruptData?.contentReference || "";

    // Prepare feedback object
    const feedbackPayload = {
      type: feedbackType,
      comments: comments,
      timestamp: new Date().toISOString(),
      contentReference: contentReference,
      customInstructions: customInstructions,
    };

    // Submit feedback using the updated orchestrator method
    const feedbackResult = await orchestrator.submitFeedback(
      threadId,
      feedbackPayload
    );

    // Return success response with details from the operation
    return res.status(200).json({
      success: true,
      message: feedbackResult.message,
      status: feedbackResult.status,
    });
  } catch (error) {
    logger.error("Failed to submit feedback", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return res.status(500).json({
      error: "Failed to submit feedback",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
