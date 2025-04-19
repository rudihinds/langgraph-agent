/**
 * Evaluation Graph Integration Example
 *
 * This file demonstrates how to integrate evaluation nodes into the main proposal
 * generation graph with conditional edges and routing based on evaluation results.
 */

import { StateGraph, StateNodeConfig } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import {
  OverallProposalState,
  ProcessingStatus,
  SectionType,
} from "../../state/proposal.state.js";
import { EvaluationNodeFactory } from "../factory.js";
import { createSectionEvaluationNodes } from "./sectionEvaluationNodes.js";
import { Logger, LogLevel } from "../../lib/logger.js";

// Define type for conditional routing function
type ConditionFunction = (state: OverallProposalState) => string;

/**
 * Example setup for integrating evaluation nodes into the main proposal generation graph.
 * This is a conceptual example - actual implementation would need to be integrated with
 * the existing graph structure and node definitions.
 */
export function setupEvaluationGraph() {
  // Create a factory for evaluation nodes
  const evaluationFactory = new EvaluationNodeFactory({
    modelName: "gpt-4o-2024-05-13",
    defaultTimeoutSeconds: 120,
  });

  // Create specific evaluation nodes
  const researchEvalNode = evaluationFactory.createResearchEvaluationNode();
  const solutionEvalNode = evaluationFactory.createSolutionEvaluationNode();
  const connectionPairsEvalNode =
    evaluationFactory.createConnectionPairsEvaluationNode();
  const funderSolutionAlignmentEvalNode =
    evaluationFactory.createFunderSolutionAlignmentEvaluationNode();

  // Create section-specific evaluation nodes
  const sectionEvaluators = createSectionEvaluationNodes();

  // Setup the state graph
  const graph = new StateGraph<OverallProposalState>({
    channels: {
      messages: {
        value: [] as BaseMessage[],
        // Reducer if needed
      },
    },
  });

  // Add research generation and evaluation nodes
  graph.addNode("generateResearch", <
    StateNodeConfig<any, OverallProposalState>
  >{
    invoke: async (state: OverallProposalState) => {
      // Example of a research generation node
      // Actual implementation would go here
      return {
        ...state,
        researchStatus: "generated" as ProcessingStatus,
        // Research results would be set here
      };
    },
  });

  // Add research evaluation node
  graph.addNode("evaluateResearch", researchEvalNode);

  // Add solution generation and evaluation nodes
  graph.addNode("generateSolution", <
    StateNodeConfig<any, OverallProposalState>
  >{
    invoke: async (state: OverallProposalState) => {
      // Example of a solution generation node
      return {
        ...state,
        solutionStatus: "generated" as ProcessingStatus,
        // Solution results would be set here
      };
    },
  });

  // Add solution evaluation node
  graph.addNode("evaluateSolution", solutionEvalNode);

  // Add funder-solution alignment evaluation node
  graph.addNode(
    "evaluateFunderSolutionAlignment",
    funderSolutionAlignmentEvalNode
  );

  // Add connection pairs generation and evaluation nodes
  graph.addNode("generateConnectionPairs", <
    StateNodeConfig<any, OverallProposalState>
  >{
    invoke: async (state: OverallProposalState) => {
      // Example of a connection pairs generation node
      return {
        ...state,
        connectionPairsStatus: "generated" as ProcessingStatus,
        // Connection pairs would be set here
      };
    },
  });

  // Add connection pairs evaluation node
  graph.addNode("evaluateConnectionPairs", connectionPairsEvalNode);

  // Add section generation and evaluation nodes for each section type
  for (const [sectionType, evaluatorNode] of Object.entries(
    sectionEvaluators
  )) {
    // Capitalize first letter for node names
    const capitalizedType =
      sectionType.charAt(0).toUpperCase() + sectionType.slice(1);

    // Add generation node
    graph.addNode(`generate${capitalizedType}`, <
      StateNodeConfig<any, OverallProposalState>
    >{
      invoke: async (state: OverallProposalState) => {
        // Example of section generation logic
        // Create a copy of the sections map
        const sections =
          state.sections instanceof Map ? new Map(state.sections) : new Map();

        // Get existing section data if any
        const existingSection = sections.get(sectionType as SectionType) || {};

        // Update the section
        sections.set(sectionType as SectionType, {
          ...existingSection,
          status: "generated" as ProcessingStatus,
          // Content would be set here
        });

        return {
          ...state,
          sections,
        };
      },
    });

    // Add evaluation node
    graph.addNode(`evaluate${capitalizedType}`, evaluatorNode);

    // Add regeneration node (for if evaluation fails)
    graph.addNode(`regenerate${capitalizedType}`, <
      StateNodeConfig<any, OverallProposalState>
    >{
      invoke: async (state: OverallProposalState) => {
        // Example of section regeneration logic, using feedback from evaluation
        if (!state.sections || !(state.sections instanceof Map)) {
          return state;
        }

        const section = state.sections.get(sectionType as SectionType);
        const evaluation = section?.evaluation;

        // Create a copy of the sections map
        const sections = new Map(state.sections);

        // Update the section
        sections.set(sectionType as SectionType, {
          ...section,
          status: "regenerating" as ProcessingStatus,
          // Would use evaluation feedback to improve regeneration
        });

        return {
          ...state,
          sections,
        };
      },
    });
  }

  // Add edges for research flow
  graph.addEdge("generateResearch", "evaluateResearch");

  // Define conditional routing based on research evaluation result
  const researchEvalCondition: ConditionFunction = (
    state: OverallProposalState
  ) => {
    // Check if research is interrupted for human review
    if (
      state.interruptStatus?.isInterrupted &&
      state.interruptStatus.processingStatus ===
        ProcessingStatus.AWAITING_REVIEW &&
      state.interruptMetadata?.contentReference === "research"
    ) {
      return "waitForHumanInput"; // Route to a node that waits for human input
    }

    // Check evaluation result if available
    if (state.researchEvaluation?.passed) {
      return "generateSolution"; // If passed, proceed to solution generation
    } else {
      return "regenerateResearch"; // If failed, regenerate research
    }
  };

  // Add conditional edges from research evaluation
  graph.addConditionalEdges("evaluateResearch", researchEvalCondition);

  // Add regeneration to evaluation loop for research
  graph.addEdge("regenerateResearch", "evaluateResearch");

  // Add edges for solution flow
  graph.addEdge("generateSolution", "evaluateSolution");

  // Define conditional routing based on solution evaluation
  const solutionEvalCondition: ConditionFunction = (
    state: OverallProposalState
  ) => {
    // Similar pattern to research evaluation routing
    if (
      state.interruptStatus?.isInterrupted &&
      state.interruptStatus.processingStatus ===
        ProcessingStatus.AWAITING_REVIEW &&
      state.interruptMetadata?.contentReference === "solution"
    ) {
      return "waitForHumanInput";
    }

    if (state.solutionEvaluation?.passed) {
      return "evaluateFunderSolutionAlignment"; // If passed, evaluate funder alignment
    } else {
      return "regenerateSolution";
    }
  };

  // Add conditional edges for solution evaluation
  graph.addConditionalEdges("evaluateSolution", solutionEvalCondition);

  // Funder alignment evaluation condition
  const funderAlignmentCondition: ConditionFunction = (
    state: OverallProposalState
  ) => {
    if (
      state.interruptStatus?.isInterrupted &&
      state.interruptStatus.processingStatus ===
        ProcessingStatus.AWAITING_REVIEW &&
      state.interruptMetadata?.contentReference === "funder_solution_alignment"
    ) {
      return "waitForHumanInput";
    }

    if (state.funderSolutionAlignmentEvaluation?.passed) {
      return "generateConnectionPairs"; // If passed, generate connection pairs
    } else {
      return "regenerateSolution"; // If failed alignment, regenerate solution
    }
  };

  // Add conditional edges for funder alignment evaluation
  graph.addConditionalEdges(
    "evaluateFunderSolutionAlignment",
    funderAlignmentCondition
  );

  // Add edges for connection pairs
  graph.addEdge("generateConnectionPairs", "evaluateConnectionPairs");

  // Define conditional routing for connection pairs evaluation
  const connectionPairsCondition: ConditionFunction = (
    state: OverallProposalState
  ) => {
    if (
      state.interruptStatus?.isInterrupted &&
      state.interruptStatus.processingStatus ===
        ProcessingStatus.AWAITING_REVIEW &&
      state.interruptMetadata?.contentReference === "connection_pairs"
    ) {
      return "waitForHumanInput";
    }

    if (state.connectionPairsEvaluation?.passed) {
      return "generateProblemStatement"; // Start section generation with problem statement
    } else {
      return "regenerateConnectionPairs";
    }
  };

  // Add conditional edges for connection pairs
  graph.addConditionalEdges(
    "evaluateConnectionPairs",
    connectionPairsCondition
  );

  // Connect section generation, evaluation, and regeneration nodes with conditional edges
  // Example for problem statement
  graph.addEdge("generateProblemStatement", "evaluateProblemStatement");

  // Define conditional routing for problem statement evaluation
  const problemStatementCondition: ConditionFunction = (
    state: OverallProposalState
  ) => {
    if (
      state.interruptStatus?.isInterrupted &&
      state.interruptStatus.processingStatus ===
        ProcessingStatus.AWAITING_REVIEW &&
      state.interruptMetadata?.contentReference ===
        SectionType.PROBLEM_STATEMENT
    ) {
      return "waitForHumanInput";
    }

    // Check the evaluation result in the section
    if (!state.sections || !(state.sections instanceof Map)) {
      return "error";
    }

    const section = state.sections.get(SectionType.PROBLEM_STATEMENT);
    const evaluation = section?.evaluation;

    if (evaluation?.passed) {
      return "generateMethodology";
    } else {
      return "regenerateProblemStatement";
    }
  };

  // Add conditional edges for problem statement
  graph.addConditionalEdges(
    "evaluateProblemStatement",
    problemStatementCondition
  );

  // Connect regeneration back to evaluation
  graph.addEdge("regenerateProblemStatement", "evaluateProblemStatement");

  // Similar pattern for other sections (methodology, budget, timeline, conclusion)
  graph.addEdge("generateMethodology", "evaluateMethodology");
  // Conditional edges for methodology
  // ... (similar pattern continued for all sections)

  // Add a special node for handling human input/interrupts
  graph.addNode("waitForHumanInput", <
    StateNodeConfig<any, OverallProposalState>
  >{
    invoke: async (state: OverallProposalState) => {
      // This would be a no-op node that simply passes the state through
      // The actual human interaction would be handled by the Orchestrator service
      return state;
    },
  });

  // The "waitForHumanInput" node would typically end execution until the Orchestrator
  // resumes the graph with updated state after human input

  // Orchestrator would then call graph.resume() with the updated state
  // This isn't directly shown in this example as it's handled outside the graph

  // Set the entry point
  graph.setEntryPoint("generateResearch");

  // Return the configured graph
  return graph;
}

/**
 * Example of how an Orchestrator might handle resuming after human evaluation input
 * This is not part of the graph definition, but shows how the graph would be used
 */
export async function exampleResumeAfterHumanEvaluation(
  graph: StateGraph<OverallProposalState>,
  threadId: string,
  state: OverallProposalState,
  humanFeedback: {
    contentType: string;
    approved: boolean;
    feedback?: string;
    scores?: Record<string, number>;
  }
) {
  // This is an example of how the Orchestrator might handle human feedback
  // and resume the graph after an evaluation interrupt

  // 1. Update the state with human feedback
  const updatedState: OverallProposalState = {
    ...state,
    interruptStatus: {
      isInterrupted: false, // Clear the interrupt
      interruptionPoint: state.interruptStatus?.interruptionPoint || null,
      processingStatus: humanFeedback.approved ? "approved" : "rejected",
    },
  };

  // 2. Update content-specific fields based on the feedback type
  if (humanFeedback.contentType === "research") {
    updatedState.researchStatus = humanFeedback.approved
      ? ("approved" as ProcessingStatus)
      : ("rejected" as ProcessingStatus);

    // If human provided evaluation scores, update the evaluation
    if (humanFeedback.scores) {
      updatedState.researchEvaluation = {
        ...state.researchEvaluation!,
        evaluator: "human",
        passed: humanFeedback.approved,
        scores: humanFeedback.scores,
        feedback:
          humanFeedback.feedback || state.researchEvaluation?.feedback || "",
        timestamp: new Date().toISOString(),
      };
    }
  }
  // Similar handling for other content types (solution, sections, etc.)

  // 3. Resume the graph with the updated state
  // Note: This assumes the graph has been checkpointed with the threadId
  return await graph.resume(threadId, updatedState);
}

// Mock function for testing interrupt condition
export function shouldInterruptSolution(
  state: OverallProposalState,
  config?: any
): boolean {
  // Check if interrupt is active and pending feedback
  return (
    state.interruptStatus.isInterrupted &&
    state.interruptStatus.processingStatus ===
      ProcessingStatus.AWAITING_REVIEW &&
    state.interruptMetadata?.contentReference === "solution"
  );
}

// Mock function for testing interrupt condition
export function shouldInterruptConnections(
  state: OverallProposalState,
  config?: any
): boolean {
  // Check if interrupt is active and pending feedback
  return (
    state.interruptStatus.isInterrupted &&
    state.interruptStatus.processingStatus ===
      ProcessingStatus.AWAITING_REVIEW &&
    state.interruptMetadata?.contentReference === "connection_pairs"
  );
}

// Mock function for testing interrupt condition
export function shouldInterruptSection(
  state: OverallProposalState,
  sectionType: SectionType
): boolean {
  // Check if interrupt is active and pending feedback
  return (
    state.interruptStatus.isInterrupted &&
    state.interruptStatus.processingStatus ===
      ProcessingStatus.AWAITING_REVIEW &&
    state.interruptMetadata?.contentReference === sectionType
  );
}
