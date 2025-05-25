/**
 * Evaluate Solution Node
 *
 * Evaluates the proposed solution against requirements and constraints.
 * This node assesses solution quality, feasibility, and alignment
 * with RFP requirements.
 */

import { OverallProposalStateAnnotation } from "../../../state/modules/annotations.js";
import {
  ProcessingStatus,
  EvaluationResult,
  InterruptReason,
} from "../../../state/modules/types.js";
import { InterruptProcessingStatus } from "../../../state/modules/constants.js";
import { Logger } from "../../../lib/logger.js";

const logger = Logger.getInstance();

/**
 * Evaluate Solution Node
 *
 * Evaluates the proposed solution against requirements and constraints.
 * Creates an evaluation result and sets up human-in-the-loop review
 * for solution quality assessment.
 *
 * @param state Current proposal state
 * @returns Updated state with solution evaluation and interrupt for review
 */
export const evaluateSolutionNode = async (
  state: typeof OverallProposalStateAnnotation.State
): Promise<Partial<typeof OverallProposalStateAnnotation.State>> => {
  logger.info("Starting solution evaluation", {
    rfpId: state.rfpDocument?.id,
    solutionStatus: state.solutionStatus,
  });

  try {
    // TODO: Implement actual solution evaluation logic
    // This should:
    // 1. Assess solution feasibility
    // 2. Check alignment with requirements
    // 3. Evaluate innovation and creativity
    // 4. Validate technical approach
    // 5. Generate evaluation scores

    // Sample evaluation result for testing
    const evaluationResult: EvaluationResult = {
      score: 8.0,
      passed: true,
      feedback:
        "The proposed solution is innovative and addresses key requirements.",
      categories: {
        creativity: {
          score: 8.5,
          feedback: "Creative approach to the problem",
        },
        alignment: {
          score: 8.0,
          feedback: "Clear alignment with client goals",
        },
        feasibility: {
          score: 7.5,
          feedback: "Technically feasible implementation plan",
        },
      },
    };

    logger.info("Solution evaluation completed", {
      rfpId: state.rfpDocument?.id,
      score: evaluationResult.score,
      passed: evaluationResult.passed,
    });

    // Set up interrupt for human review
    return {
      solutionStatus: ProcessingStatus.AWAITING_REVIEW,
      solutionEvaluation: evaluationResult,
      interruptStatus: {
        isInterrupted: true,
        interruptionPoint: "solutionEvaluation",
        feedback: null,
        processingStatus: InterruptProcessingStatus.PENDING,
      },
      interruptMetadata: {
        reason: InterruptReason.EVALUATION_NEEDED,
        nodeId: "evaluateSolution",
        timestamp: new Date().toISOString(),
        contentReference: "solution",
        evaluationResult,
      },
    };
  } catch (error) {
    logger.error("Solution evaluation failed", {
      rfpId: state.rfpDocument?.id,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      solutionStatus: ProcessingStatus.ERROR,
      errors: [
        ...(state.errors || []),
        `Solution evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
};
