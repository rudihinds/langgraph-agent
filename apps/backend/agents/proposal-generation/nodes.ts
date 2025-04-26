/**
 * Proposal Generation Nodes
 *
 * This file defines all node functions for the proposal generation graph.
 * Each node is responsible for a specific step in the process, such as
 * document loading, research, solution generation, and section creation.
 */

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
import { OverallProposalStateAnnotation } from "../../state/modules/annotations.js";

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

        // Update the section with its evaluation
        sections.set(sectionId as SectionType, {
          ...section,
          status: ProcessingStatus.AWAITING_REVIEW,
          evaluation: evaluationResult,
        });

        // Return updated state with new sections and interrupt
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
            nodeId: `evaluateSection_${sectionId}`,
            timestamp: new Date().toISOString(),
            contentReference: sectionId,
            evaluationResult,
          },
        };
      }
    }
  }

  // If no valid content type or missing sectionId for section type
  return {};
};

/**
 * Document Loader Node
 * Loads and processes RFP documents
 */
export { documentLoaderNode } from "./nodes/document_loader.js";

/**
 * Deep Research Node
 * Performs in-depth research on the RFP domain
 */
export const deepResearchNode = async (
  state: typeof OverallProposalStateAnnotation.State
): Promise<Partial<typeof OverallProposalStateAnnotation.State>> => {
  // Placeholder implementation
  return {
    researchStatus: ProcessingStatus.RUNNING,
    currentStep: "research",
  };
};

/**
 * Solution Sought Node
 * Generates potential solutions based on research
 */
export const solutionSoughtNode = async (
  state: typeof OverallProposalStateAnnotation.State
): Promise<Partial<typeof OverallProposalStateAnnotation.State>> => {
  // Placeholder implementation
  return {
    solutionStatus: ProcessingStatus.RUNNING,
    currentStep: "solution",
  };
};

/**
 * Connection Pairs Node
 * Creates connections between research findings and solution elements
 */
export const connectionPairsNode = async (
  state: typeof OverallProposalStateAnnotation.State
): Promise<Partial<typeof OverallProposalStateAnnotation.State>> => {
  // Placeholder implementation
  return {
    connectionsStatus: ProcessingStatus.RUNNING,
    currentStep: "connections",
  };
};

/**
 * Section Manager Node
 * Coordinates the generation of proposal sections
 */
export { sectionManagerNode } from "./nodes/section_manager.js";

/**
 * Generate Problem Statement Node
 * Creates the problem statement section of the proposal
 */
export { problemStatementNode as generateProblemStatementNode } from "./nodes/problem_statement.js";

/**
 * Generate Methodology Node
 * Creates the methodology section of the proposal
 */
export const generateMethodologyNode = async (
  state: typeof OverallProposalStateAnnotation.State
): Promise<Partial<typeof OverallProposalStateAnnotation.State>> => {
  // Placeholder implementation
  return state;
};

/**
 * Generate Budget Node
 * Creates the budget section of the proposal
 */
export const generateBudgetNode = async (
  state: typeof OverallProposalStateAnnotation.State
): Promise<Partial<typeof OverallProposalStateAnnotation.State>> => {
  // Placeholder implementation
  return state;
};

/**
 * Generate Timeline Node
 * Creates the timeline section of the proposal
 */
export const generateTimelineNode = async (
  state: typeof OverallProposalStateAnnotation.State
): Promise<Partial<typeof OverallProposalStateAnnotation.State>> => {
  // Placeholder implementation
  return state;
};

/**
 * Generate Conclusion Node
 * Creates the conclusion section of the proposal
 */
export const generateConclusionNode = async (
  state: typeof OverallProposalStateAnnotation.State
): Promise<Partial<typeof OverallProposalStateAnnotation.State>> => {
  // Placeholder implementation
  return state;
};

/**
 * Evaluate Research Node
 * Evaluates the quality and completeness of research
 */
export const evaluateResearchNode = async (
  state: typeof OverallProposalStateAnnotation.State
): Promise<Partial<typeof OverallProposalStateAnnotation.State>> => {
  return evaluateContent(state, "research");
};

/**
 * Evaluate Solution Node
 * Evaluates the solution against requirements
 */
export const evaluateSolutionNode = async (
  state: typeof OverallProposalStateAnnotation.State
): Promise<Partial<typeof OverallProposalStateAnnotation.State>> => {
  return evaluateContent(state, "solution");
};

/**
 * Evaluate Connections Node
 * Evaluates the connections between research and solution
 */
export const evaluateConnectionsNode = async (
  state: typeof OverallProposalStateAnnotation.State
): Promise<Partial<typeof OverallProposalStateAnnotation.State>> => {
  return evaluateContent(state, "connections");
};

/**
 * Evaluate Section Node
 * Evaluates a specific proposal section
 */
export const evaluateSectionNode = async (
  state: typeof OverallProposalStateAnnotation.State,
  sectionId: string
): Promise<Partial<typeof OverallProposalStateAnnotation.State>> => {
  return evaluateContent(state, "section", sectionId);
};

// Export evaluation nodes for testing
export const evaluationNodes = {
  research: evaluateResearchNode,
  solution: evaluateSolutionNode,
  connections: evaluateConnectionsNode,
  section: evaluateSectionNode,
};
