/**
 * User Feedback Processor - Simplified LangGraph interrupt/resume pattern
 *
 * Note: With the proper LangGraph pattern, this node is mainly for routing.
 * The actual feedback processing happens in strategicValidationCheckpoint when
 * interrupt() returns the user input.
 */

import { OverallProposalState } from "@/state/modules/types.js";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";

// Simple logger for this node
const logger = {
  info: (message: string, meta?: any) =>
    console.log(`[INFO] ${message}`, meta || ""),
  warn: (message: string, meta?: any) =>
    console.warn(`[WARN] ${message}`, meta || ""),
  error: (message: string, meta?: any) =>
    console.error(`[ERROR] ${message}`, meta || ""),
};

export async function userFeedbackProcessor(
  state: OverallProposalState
): Promise<Partial<OverallProposalState>> {
  try {
    logger.info("Processing user feedback routing", {
      userId: state.userId,
      proposalId: state.proposalId,
      hasFeedback: !!state.userCollaboration?.lastFeedback,
    });

    // Check if we have processed feedback to route on
    const lastFeedback = state.userCollaboration?.lastFeedback;

    if (!lastFeedback?.analysis) {
      console.warn(
        "[userFeedbackProcessor] No feedback analysis available - returning to strategic validation"
      );
      return {
        currentStep: "awaiting_feedback",
        lastUpdatedAt: new Date().toISOString(),
      };
    }

    const { intent, confidence } = lastFeedback.analysis;

    console.log("[userFeedbackProcessor] Routing based on feedback analysis:", {
      intent,
      confidence,
      refinementCount: state.userCollaboration?.refinementCount || 0,
    });

    // Simple routing based on LLM analysis of user feedback
    return {
      currentStep: `feedback_${intent}`,
      lastUpdatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(
      "[userFeedbackProcessor] Error processing feedback routing:",
      error
    );
    return {
      errors: [
        ...(state.errors || []),
        `Feedback processing error: ${error.message}`,
      ],
      currentStep: "feedback_error",
      lastUpdatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Route after feedback processing - determines next step based on feedback analysis
 */
export const routeAfterFeedbackProcessing = (
  state: typeof OverallProposalStateAnnotation.State
) => {
  console.log("[routeAfterFeedbackProcessing] Determining next step");

  const lastFeedback = state.userCollaboration?.lastFeedback;

  if (!lastFeedback?.analysis) {
    console.log(
      "[routeAfterFeedbackProcessing] No feedback analysis - return to strategic validation"
    );
    return "strategic_validation";
  }

  const { intent } = lastFeedback.analysis;
  const refinementCount = state.userCollaboration?.refinementCount || 0;
  const maxRefinements = state.userCollaboration?.maxRefinements || 3;

  console.log("[routeAfterFeedbackProcessing] Routing decision:", {
    intent,
    refinementCount,
    maxRefinements,
  });

  switch (intent) {
    case "proceed":
      console.log(
        "[routeAfterFeedbackProcessing] User approved - proceeding to next phase"
      );
      return "complete"; // Will be "research_planning" once that phase is implemented

    case "restart":
      console.log(
        "[routeAfterFeedbackProcessing] User requested restart - restarting analysis"
      );
      return "restart_analysis";

    case "refine":
      if (refinementCount >= maxRefinements) {
        console.log(
          "[routeAfterFeedbackProcessing] Max refinements reached - proceeding"
        );
        return "complete";
      }
      console.log(
        "[routeAfterFeedbackProcessing] User requested refinement - refining analysis"
      );
      return "analysis_refinement";

    default:
      console.log(
        "[routeAfterFeedbackProcessing] Unknown intent - returning to strategic validation"
      );
      return "strategic_validation";
  }
};
