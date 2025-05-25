/**
 * Evaluate Connections Node
 *
 * Evaluates the connections between research findings and solution elements.
 * This node assesses the logical flow and traceability from requirements
 * to solution components.
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
 * Evaluate Connections Node
 *
 * Evaluates the connections between research findings and solution elements.
 * Creates an evaluation result and sets up human-in-the-loop review
 * for connection quality assessment.
 *
 * @param state Current proposal state
 * @returns Updated state with connections evaluation and interrupt for review
 */
export const evaluateConnectionsNode = async (
  state: typeof OverallProposalStateAnnotation.State
): Promise<Partial<typeof OverallProposalStateAnnotation.State>> => {
  logger.info("Starting connections evaluation", {
    rfpId: state.rfpDocument?.id,
    connectionsStatus: state.connectionsStatus,
  });

  try {
    // TODO: Implement actual connections evaluation logic
    // This should:
    // 1. Assess logical flow from research to solution
    // 2. Check requirement traceability
    // 3. Validate justification chains
    // 4. Identify gaps in coverage
    // 5. Generate evaluation scores

    // Sample evaluation result for testing
    const evaluationResult: EvaluationResult = {
      score: 7.5,
      passed: true,
      feedback:
        "The connections between research and solution are generally well-established.",
      categories: {
        logicalFlow: {
          score: 8.0,
          feedback: "Clear logical flow from research to solution",
        },
        traceability: {
          score: 7.5,
          feedback: "Good traceability of requirements",
        },
        justification: {
          score: 7.0,
          feedback: "Strong justification for key design decisions",
        },
      },
    };

    logger.info("Connections evaluation completed", {
      rfpId: state.rfpDocument?.id,
      score: evaluationResult.score,
      passed: evaluationResult.passed,
    });

    // Set up interrupt for human review
    return {
      connectionsStatus: ProcessingStatus.AWAITING_REVIEW,
      connectionsEvaluation: evaluationResult,
      interruptStatus: {
        isInterrupted: true,
        interruptionPoint: "connectionsEvaluation",
        feedback: null,
        processingStatus: InterruptProcessingStatus.PENDING,
      },
      interruptMetadata: {
        reason: InterruptReason.EVALUATION_NEEDED,
        nodeId: "evaluateConnections",
        timestamp: new Date().toISOString(),
        contentReference: "connections",
        evaluationResult,
      },
    };
  } catch (error) {
    logger.error("Connections evaluation failed", {
      rfpId: state.rfpDocument?.id,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      connectionsStatus: ProcessingStatus.ERROR,
      errors: [
        ...(state.errors || []),
        `Connections evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
};
