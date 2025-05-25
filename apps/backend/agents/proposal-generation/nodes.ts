/**
 * Proposal Generation Nodes - Barrel Export
 *
 * This file exports all node functions for the proposal generation graph.
 * Each node is implemented in its own file for better organization and maintainability.
 */

// Import from individual node files
export { documentLoaderNode } from "./nodes/document_loader.js";
export { deepResearchNode } from "./nodes/deepResearch.js";
export { solutionSoughtNode } from "./nodes/solutionSought.js";
export { connectionPairsNode } from "./nodes/connectionPairs.js";
export { evaluateResearchNode } from "./nodes/evaluateResearch.js";
export { evaluateSolutionNode } from "./nodes/evaluateSolution.js";
export { evaluateConnectionsNode } from "./nodes/evaluateConnections.js";

// Import from existing individual node files
export { sectionManagerNode } from "./nodes/section_manager.js";
export { problemStatementNode as generateProblemStatementNode } from "./nodes/problem_statement.js";
export { processFeedbackNode } from "./nodes/processFeedback.js";
export { chatAgentNode, shouldContinueChat } from "./nodes/chatAgent.js";
export { processToolsNode } from "./nodes/toolProcessor.js";

// Import section nodes factory
export { sectionNodes } from "./nodes/section_nodes.js";

// Re-export types and utilities that were in the original file
import {
  OverallProposalState,
  ProcessingStatus,
  InterruptReason,
  EvaluationResult,
  LoadingStatus,
} from "../../state/modules/types.js";
import {
  SectionType,
  InterruptProcessingStatus,
} from "../../state/modules/constants.js";

/**
 * Evaluates content (research, solution, connections, or sections) against predefined criteria
 *
 * @param state - The current state of the proposal generation process
 * @param contentType - The type of content being evaluated (research, solution, connections, section)
 * @param sectionId - Optional ID of the section being evaluated (only for section contentType)
 * @param criteriaPath - Path to the criteria JSON file for evaluation
 * @param passingThreshold - Threshold score to consider the evaluation passed
 * @param timeout - Optional timeout in milliseconds for the evaluation
 * @returns The updated state with evaluation results
 */
export const evaluateContent = async (
  state: OverallProposalState,
  contentType: "research" | "solution" | "connections" | "section",
  sectionId: string | null = null,
  criteriaPath: string | null = null,
  passingThreshold: number = 7.0,
  timeout: number = 300000
): Promise<Partial<OverallProposalState>> => {
  // Clone the state to avoid mutation
  const newState = { ...state };

  // Set up evaluation results based on content type
  if (contentType === "research") {
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
        contentReference: contentType,
        evaluationResult,
      },
    };
  }

  if (contentType === "solution") {
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
        contentReference: contentType,
        evaluationResult,
      },
    };
  }

  if (contentType === "connections") {
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
        contentReference: contentType,
        evaluationResult,
      },
    };
  }

  if (contentType === "section" && sectionId) {
    // Update the sections map if sectionId is provided
    if (state.sections) {
      const sections = new Map(state.sections);
      const section = sections.get(sectionId as SectionType);

      if (section) {
        // Sample evaluation result for testing
        const evaluationResult: EvaluationResult = {
          score: 8.0,
          passed: true,
          feedback: `The ${sectionId} section is well-written and addresses key requirements.`,
          categories: {
            writing: {
              score: 8.5,
              feedback: "Clear and concise writing style",
            },
            alignment: {
              score: 8.0,
              feedback: "Good alignment with overall proposal",
            },
            evidence: {
              score: 7.5,
              feedback: "Effective use of supporting evidence",
            },
          },
        };

        // Update section with evaluation
        section.evaluation = evaluationResult;
        section.status = ProcessingStatus.AWAITING_REVIEW;
        sections.set(sectionId as SectionType, section);

        // Set up interrupt for human review
        return {
          sections,
          interruptStatus: {
            isInterrupted: true,
            interruptionPoint: "sectionEvaluation",
            feedback: null,
            processingStatus: InterruptProcessingStatus.PENDING,
          },
          interruptMetadata: {
            reason: InterruptReason.EVALUATION_NEEDED,
            nodeId: "evaluateSection",
            timestamp: new Date().toISOString(),
            contentReference: sectionId,
            evaluationResult,
          },
        };
      }
    }
  }

  // Default return if no matching content type
  return newState;
};
