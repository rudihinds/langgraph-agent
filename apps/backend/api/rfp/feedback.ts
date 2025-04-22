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
  proposalId: z.string().min(1, "ProposalId is required"),
  feedbackType: z.enum(
      [FeedbackType.APPROVE, FeedbackType.REVISE, FeedbackType.EDIT],
    {
      errorMap: () => ({ message: "Invalid feedback type" }),
    }
  ),
    // Comments are required for REVISE, optional for others
    comments: z.string().optional(),
    // Edited content is required for EDIT type
    editedContent: z.string().optional(),
    // Optional custom instructions for revisions
    customInstructions: z.string().optional(),
  })
  .refine(
    (data) => {
      // If type is EDIT, editedContent must be provided
      if (data.feedbackType === FeedbackType.EDIT && !data.editedContent) {
        return false;
      }
      // If type is REVISE, comments should be provided
      if (data.feedbackType === FeedbackType.REVISE && !data.comments) {
        return false;
      }
      return true;
    },
    {
      message:
        "Edited content is required for EDIT feedback or comments are required for REVISE feedback",
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
      proposalId,
      feedbackType,
      comments = "",
      editedContent,
      customInstructions,
    } = result.data;

    logger.info("Processing feedback submission", {
      proposalId,
      feedbackType,
      hasEditedContent: !!editedContent,
    });

    // Get orchestrator
    const orchestrator = getOrchestrator(proposalId);

    // Get interrupt details to retrieve the correct contentReference
    const interruptStatus = await orchestrator.getInterruptStatus(proposalId);
    const contentReference =
      interruptStatus.interruptData?.contentReference || "";

    // Prepare feedback object
    const feedbackPayload = {
      type: feedbackType,
      comments: comments,
      timestamp: new Date().toISOString(),
      contentReference: contentReference,
      specificEdits: editedContent ? { content: editedContent } : undefined,
      customInstructions: customInstructions,
    };

    // Submit feedback using the updated orchestrator method
    const feedbackResult = await orchestrator.submitFeedback(
      proposalId,
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
