/**
 * Proposal Generation Nodes
 *
 * This file defines all node functions for the proposal generation graph.
 * Each node is responsible for a specific step in the process, such as
 * document loading, research, solution generation, and section creation.
 */

import { OverallProposalState } from "../../state/proposal.state";

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
  state,
  contentType,
  sectionId = null,
  criteriaPath = null,
  passingThreshold = 7.0,
  timeout = 300000
) => {
  // Clone the state to avoid mutation
  const newState = { ...state };

  // Set up evaluation results based on content type
  if (contentType === "research") {
    newState.researchStatus = "awaiting_review";

    // Sample evaluation result for testing
    const evaluationResult = {
      score: 8.5,
      feedback: "The research is comprehensive and well-structured.",
      strengths: [
        "Thorough analysis of the problem domain",
        "Well-cited sources",
        "Clear identification of key stakeholders",
      ],
      weaknesses: [
        "Could benefit from more industry-specific examples",
        "Some recent developments not fully addressed",
      ],
      recommendations: [
        "Consider adding more recent case studies",
        "Expand on the competitive landscape section",
      ],
    };

    // Set up interrupt for human review
    newState.interruptStatus = {
      isInterrupted: true,
      interruptionPoint: "researchEvaluation",
      reason: "Research evaluation completed, awaiting human review",
      processingStatus: "pending",
      metadata: {
        contentType,
        evaluationResult,
        passingThreshold,
      },
    };

    return newState;
  }

  if (contentType === "solution") {
    newState.solutionStatus = "awaiting_review";

    // Sample evaluation result for testing
    const evaluationResult = {
      score: 8.0,
      feedback:
        "The proposed solution is innovative and addresses key requirements.",
      strengths: [
        "Creative approach to the problem",
        "Clear alignment with client goals",
        "Technically feasible implementation plan",
      ],
      weaknesses: [
        "Some scalability concerns not fully addressed",
        "Limited discussion of alternative approaches",
      ],
      recommendations: [
        "Add more detail on scalability considerations",
        "Include brief comparison with alternative solutions",
      ],
    };

    // Set up interrupt for human review
    newState.interruptStatus = {
      isInterrupted: true,
      interruptionPoint: "solutionEvaluation",
      reason: "Solution evaluation completed, awaiting human review",
      processingStatus: "pending",
      metadata: {
        contentType,
        evaluationResult,
        passingThreshold,
      },
    };

    return newState;
  }

  if (contentType === "connections") {
    newState.connectionsStatus = "awaiting_review";

    // Sample evaluation result for testing
    const evaluationResult = {
      score: 7.5,
      feedback:
        "The connections between research and solution are generally well-established.",
      strengths: [
        "Clear logical flow from research to solution",
        "Good traceability of requirements",
        "Strong justification for key design decisions",
      ],
      weaknesses: [
        "Some connection points could be more explicit",
        "A few research insights not fully leveraged in the solution",
      ],
      recommendations: [
        "Strengthen the explicit connections between research insights and solution features",
        "Consider adding a traceability matrix for clarity",
      ],
    };

    // Set up interrupt for human review
    newState.interruptStatus = {
      isInterrupted: true,
      interruptionPoint: "connectionsEvaluation",
      reason: "Connections evaluation completed, awaiting human review",
      processingStatus: "pending",
      metadata: {
        contentType,
        evaluationResult,
        passingThreshold,
      },
    };

    return newState;
  }

  if (contentType === "section" && sectionId) {
    // Update the sections map if sectionId is provided
    const sections = new Map(newState.sections);

    const section = sections.get(sectionId);
    if (section) {
      sections.set(sectionId, {
        ...section,
        status: "awaiting_review",
      });

      // Sample evaluation result for testing
      const evaluationResult = {
        score: 8.0,
        feedback: `The ${sectionId} section is well-written and addresses key requirements.`,
        strengths: [
          "Clear and concise writing style",
          "Good alignment with overall proposal",
          "Effective use of supporting evidence",
        ],
        weaknesses: [
          "Could benefit from more specific examples",
          "Some technical details need elaboration",
        ],
        recommendations: [
          "Add more concrete examples",
          "Expand on technical implementation details",
        ],
      };

      // Set up interrupt for human review
      newState.interruptStatus = {
        isInterrupted: true,
        interruptionPoint: "sectionEvaluation",
        reason: `Section ${sectionId} evaluation completed, awaiting human review`,
        processingStatus: "pending",
        metadata: {
          contentType,
          sectionId,
          evaluationResult,
          passingThreshold,
        },
      };

      newState.sections = sections;
    }

    return newState;
  }

  // If no valid content type or missing sectionId for section type
  return newState;
};

/**
 * Document Loader Node
 * Loads and processes RFP documents
 */
export const documentLoaderNode = async (state) => {
  // Placeholder implementation
  return {
    ...state,
    rfpDocumentStatus: "loaded",
    currentStep: "deepResearch",
  };
};

/**
 * Deep Research Node
 * Performs in-depth research on the RFP domain
 */
export const deepResearchNode = async (state) => {
  // Placeholder implementation
  return {
    ...state,
    researchStatus: "running",
    currentStep: "research",
  };
};

/**
 * Solution Sought Node
 * Generates potential solutions based on research
 */
export const solutionSoughtNode = async (state) => {
  // Placeholder implementation
  return {
    ...state,
    solutionStatus: "running",
    currentStep: "solution",
  };
};

/**
 * Connection Pairs Node
 * Creates connections between research findings and solution elements
 */
export const connectionPairsNode = async (state) => {
  // Placeholder implementation
  return {
    ...state,
    connectionsStatus: "running",
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
export const generateMethodologyNode = async (state) => {
  // Placeholder implementation
  return state;
};

/**
 * Generate Budget Node
 * Creates the budget section of the proposal
 */
export const generateBudgetNode = async (state) => {
  // Placeholder implementation
  return state;
};

/**
 * Generate Timeline Node
 * Creates the timeline section of the proposal
 */
export const generateTimelineNode = async (state) => {
  // Placeholder implementation
  return state;
};

/**
 * Generate Conclusion Node
 * Creates the conclusion section of the proposal
 */
export const generateConclusionNode = async (state) => {
  // Placeholder implementation
  return state;
};

/**
 * Evaluate Research Node
 * Evaluates the quality and completeness of research
 */
export const evaluateResearchNode = async (state) => {
  return evaluateContent(state, "research");
};

/**
 * Evaluate Solution Node
 * Evaluates the solution against requirements
 */
export const evaluateSolutionNode = async (state) => {
  return evaluateContent(state, "solution");
};

/**
 * Evaluate Connections Node
 * Evaluates the connections between research and solution
 */
export const evaluateConnectionsNode = async (state) => {
  return evaluateContent(state, "connections");
};

/**
 * Evaluate Section Node
 * Evaluates a specific proposal section
 */
export const evaluateSectionNode = async (state, sectionId) => {
  return evaluateContent(state, "section", sectionId);
};

// Export evaluation nodes for testing
export const evaluationNodes = {
  research: evaluateResearchNode,
  solution: evaluateSolutionNode,
  connections: evaluateConnectionsNode,
  section: evaluateSectionNode,
};
