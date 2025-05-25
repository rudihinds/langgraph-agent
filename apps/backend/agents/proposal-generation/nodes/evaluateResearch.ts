/**
 * Evaluate Research Node
 *
 * Evaluates the quality and completeness of research findings.
 * This node assesses research against predefined criteria and
 * determines if additional research is needed.
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
 * Evaluate Research Node
 *
 * Evaluates the quality and completeness of research findings.
 * Creates an evaluation result and sets up human-in-the-loop review
 * for research quality assessment.
 *
 * @param state Current proposal state
 * @returns Updated state with research evaluation and interrupt for review
 */
export const evaluateResearchNode = async (
  state: typeof OverallProposalStateAnnotation.State
): Promise<Partial<typeof OverallProposalStateAnnotation.State>> => {
  logger.info("Starting research evaluation", {
    rfpId: state.rfpDocument?.id,
    researchStatus: state.researchStatus,
  });

  try {
    // TODO: Implement actual research evaluation logic
    // This should:
    // 1. Analyze research completeness
    // 2. Check for quality and depth
    // 3. Validate citations and sources
    // 4. Assess stakeholder coverage
    // 5. Generate evaluation scores

    // Sample evaluation result for testing
    const evaluationResult: EvaluationResult = {
      score: 8.5,
      passed: true,
      feedback: "The research is comprehensive and well-structured.",
      categories: {
        thoroughness: {
          score: 8.5,
          feedback: "Thorough analysis of the problem domain",
        },
        citation: {
          score: 9.0,
          feedback: "Well-cited sources",
        },
        stakeholders: {
          score: 8.0,
          feedback: "Clear identification of key stakeholders",
        },
      },
    };

    logger.info("Research evaluation completed", {
      rfpId: state.rfpDocument?.id,
      score: evaluationResult.score,
      passed: evaluationResult.passed,
    });

    // Set up interrupt for human review
    return {
      researchStatus: ProcessingStatus.AWAITING_REVIEW,
      researchEvaluation: evaluationResult,
      interruptStatus: {
        isInterrupted: true,
        interruptionPoint: "researchEvaluation",
        feedback: null,
        processingStatus: InterruptProcessingStatus.PENDING,
      },
      interruptMetadata: {
        reason: InterruptReason.EVALUATION_NEEDED,
        nodeId: "evaluateResearch",
        timestamp: new Date().toISOString(),
        contentReference: "research",
        evaluationResult,
      },
    };
  } catch (error) {
    logger.error("Research evaluation failed", {
      rfpId: state.rfpDocument?.id,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      researchStatus: ProcessingStatus.ERROR,
      errors: [
        ...(state.errors || []),
        `Research evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
};
