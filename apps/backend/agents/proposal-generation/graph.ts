/**
 * Proposal Generation Graph
 *
 * This file defines the main StateGraph for proposal generation.
 * It sets up nodes, edges, and conditional branching based on state changes.
 *
 * NOTE: This code is currently in transition to comply with the latest LangGraph.js TypeScript patterns.
 * There are temporary 'any' type assertions to allow compilation while the full type updates are
 * being implemented. These will be replaced with proper types in a future update.
 */

import { StateGraph, END, START } from "@langchain/langgraph";
import {
  OverallProposalState,
  SectionType,
  ProcessingStatus,
} from "../../state/proposal.state.js";
import {
  deepResearchNode,
  solutionSoughtNode,
  connectionPairsNode,
  sectionManagerNode,
  documentLoaderNode,
  evaluateResearchNode,
  evaluateSolutionNode,
  evaluateConnectionsNode,
} from "./nodes.js";
import {
  routeSectionGeneration,
  routeAfterEvaluation,
  routeAfterFeedback,
} from "./conditionals.js";
import { OverallProposalStateAnnotation } from "../../state/modules/annotations.js";
import { createSectionEvaluators } from "../../agents/evaluation/sectionEvaluators.js";
import { createCheckpointer } from "../../lib/persistence/checkpointer-factory.js";
import { sectionNodes } from "./nodes/section_nodes.js";
import { ENV } from "../../lib/config/env.js";
import { processFeedbackNode } from "./nodes/processFeedback.js";

// Define node name constants for type safety
const NODES = {
  DOC_LOADER: "documentLoader",
  DEEP_RESEARCH: "deepResearch",
  SOLUTION_SOUGHT: "solutionSought",
  CONNECTION_PAIRS: "connectionPairs",
  SECTION_MANAGER: "sectionManager",
  EXEC_SUMMARY: "generateExecutiveSummary",
  PROB_STATEMENT: "generateProblemStatement",
  SOLUTION: "generateSolution",
  IMPL_PLAN: "generateImplementationPlan",
  EVALUATION: "generateEvaluation",
  ORG_CAPACITY: "generateOrganizationalCapacity",
  BUDGET: "generateBudget",
  CONCLUSION: "generateConclusion",
  AWAIT_FEEDBACK: "awaiting_feedback",
  PROCESS_FEEDBACK: "process_feedback",
  COMPLETE: "complete",
  EVAL_RESEARCH: "evaluateResearch",
  EVAL_SOLUTION: "evaluateSolution",
  EVAL_CONNECTIONS: "evaluateConnections",
} as const;

// Type-safe node names
type NodeName = (typeof NODES)[keyof typeof NODES];

// Create node name helpers for section evaluators
const createSectionEvalNodeName = (sectionType: SectionType) =>
  `evaluateSection_${sectionType}` as const;

// Build the graph by passing the *state definition* (the `.spec` property)
// directly to `StateGraph`.  This satisfies the overload which expects a
// `StateDefinition` and avoids the typing mismatch encountered when passing
// the full AnnotationRoot instance.

// Cast to `any` temporarily while we migrate the graph to the new API. This
// removes TypeScript friction so we can focus on resolving runtime behaviour
// first.  Subsequent refactors will replace these `any` casts with precise
// generics once the rest of the evaluation integration work is complete.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let proposalGenerationGraph: any = new StateGraph(
  OverallProposalStateAnnotation.spec as any
);

// --------------------------------------------------------------------------------
// Node registration --------------------------------------------------------------
// --------------------------------------------------------------------------------

// Add base nodes for research and analysis
proposalGenerationGraph.addNode(NODES.DOC_LOADER, documentLoaderNode);
proposalGenerationGraph.addNode(NODES.DEEP_RESEARCH, deepResearchNode);
proposalGenerationGraph.addNode(NODES.SOLUTION_SOUGHT, solutionSoughtNode);
proposalGenerationGraph.addNode(NODES.CONNECTION_PAIRS, connectionPairsNode);
proposalGenerationGraph.addNode(NODES.SECTION_MANAGER, sectionManagerNode);

// Add section generation nodes from our factory
proposalGenerationGraph.addNode(
  NODES.EXEC_SUMMARY,
  sectionNodes[SectionType.EXECUTIVE_SUMMARY]
);
proposalGenerationGraph.addNode(
  NODES.PROB_STATEMENT,
  sectionNodes[SectionType.PROBLEM_STATEMENT]
);
proposalGenerationGraph.addNode(
  NODES.SOLUTION,
  sectionNodes[SectionType.SOLUTION]
);
proposalGenerationGraph.addNode(
  NODES.IMPL_PLAN,
  sectionNodes[SectionType.IMPLEMENTATION_PLAN]
);
proposalGenerationGraph.addNode(
  NODES.EVALUATION,
  sectionNodes[SectionType.EVALUATION]
);
proposalGenerationGraph.addNode(
  NODES.ORG_CAPACITY,
  sectionNodes[SectionType.ORGANIZATIONAL_CAPACITY]
);
proposalGenerationGraph.addNode(NODES.BUDGET, sectionNodes[SectionType.BUDGET]);
proposalGenerationGraph.addNode(
  NODES.CONCLUSION,
  sectionNodes[SectionType.CONCLUSION]
);

// Add human-in-the-loop feedback node using LangGraph's built-in interrupt
// This node will pause execution and wait for human input
proposalGenerationGraph.addNode(
  NODES.AWAIT_FEEDBACK,
  async (state: typeof OverallProposalStateAnnotation.State) => {
    // This is a special node that pauses execution until human feedback is received
    // It helps us leverage LangGraph's built-in HITL support
    return state;
  }
);

// Add complete node to mark the end of the graph
proposalGenerationGraph.addNode(
  NODES.COMPLETE,
  async (state: typeof OverallProposalStateAnnotation.State) => {
    return {
      status: ProcessingStatus.COMPLETE,
    };
  }
);

// Add evaluation nodes
proposalGenerationGraph.addNode(NODES.EVAL_RESEARCH, evaluateResearchNode);
proposalGenerationGraph.addNode(NODES.EVAL_SOLUTION, evaluateSolutionNode);
proposalGenerationGraph.addNode(
  NODES.EVAL_CONNECTIONS,
  evaluateConnectionsNode
);

// Section generation routing
const conditionalEdges: Record<string, NodeName> = {
  [SectionType.EXECUTIVE_SUMMARY]: NODES.EXEC_SUMMARY,
  [SectionType.PROBLEM_STATEMENT]: NODES.PROB_STATEMENT,
  [SectionType.SOLUTION]: NODES.SOLUTION,
  [SectionType.IMPLEMENTATION_PLAN]: NODES.IMPL_PLAN,
  [SectionType.EVALUATION]: NODES.EVALUATION,
  [SectionType.ORGANIZATIONAL_CAPACITY]: NODES.ORG_CAPACITY,
  [SectionType.BUDGET]: NODES.BUDGET,
  [SectionType.CONCLUSION]: NODES.CONCLUSION,
  complete: NODES.COMPLETE,
};

// Get all section evaluators from the factory
const sectionEvaluators = createSectionEvaluators();

// Add section evaluation nodes for each section
const addedEvaluationNodes = new Set<string>();

// Add evaluation nodes for each section
Object.values(SectionType).forEach((sectionType) => {
  try {
    // Skip unknown section types that are not in the conditionalEdges
    if (!Object.prototype.hasOwnProperty.call(conditionalEdges, sectionType)) {
      console.warn(
        `Skipping evaluation for unknown section type: ${sectionType}`
      );
      return;
    }

    const evaluationNodeName = createSectionEvalNodeName(sectionType);

    // Check if this evaluator exists in the factory
    if (!sectionEvaluators[sectionType]) {
      console.warn(
        `No evaluator found for section type: ${sectionType}. Skipping node creation.`
      );
      return;
    }

    proposalGenerationGraph.addNode(
      evaluationNodeName,
      sectionEvaluators[sectionType]
    );

    // Track successfully added nodes
    addedEvaluationNodes.add(sectionType);
    console.log(`Added evaluation node for ${sectionType}`);
  } catch (error) {
    console.warn(`Error adding evaluation node for ${sectionType}:`, error);
  }
});

// Add feedback processor node
proposalGenerationGraph.addNode(NODES.PROCESS_FEEDBACK, processFeedbackNode);

// Define edges for the main flow
// Casts (`as any`) are TEMPORARY while we finish migrating node-name typing.
// They silence "Argument of type 'xyz' is not assignable to parameter of type
// '__start__ | __start__[]'" errors until we adopt the reassignment‑pattern
// which lets TypeScript track the ever‑growing node‑name union.
(proposalGenerationGraph as any).addEdge("__start__", NODES.DOC_LOADER);
(proposalGenerationGraph as any).addEdge(NODES.DOC_LOADER, NODES.DEEP_RESEARCH);
(proposalGenerationGraph as any).addEdge(
  NODES.DEEP_RESEARCH,
  NODES.EVAL_RESEARCH
);
(proposalGenerationGraph as any).addEdge(
  NODES.EVAL_RESEARCH,
  NODES.SOLUTION_SOUGHT
);
(proposalGenerationGraph as any).addEdge(
  NODES.SOLUTION_SOUGHT,
  NODES.EVAL_SOLUTION
);
(proposalGenerationGraph as any).addEdge(
  NODES.EVAL_SOLUTION,
  NODES.CONNECTION_PAIRS
);
(proposalGenerationGraph as any).addEdge(
  NODES.CONNECTION_PAIRS,
  NODES.EVAL_CONNECTIONS
);
(proposalGenerationGraph as any).addEdge(
  NODES.EVAL_CONNECTIONS,
  NODES.SECTION_MANAGER
);

// Add conditional edges for section routing
(proposalGenerationGraph as any).addConditionalEdges(
  NODES.SECTION_MANAGER,
  routeSectionGeneration,
  conditionalEdges
);

// Connect each section generation node to its corresponding evaluation node
// and add conditional routing back to the section generator or to the section manager
Object.values(SectionType).forEach((sectionType) => {
  // Skip unknown section types
  if (!Object.prototype.hasOwnProperty.call(conditionalEdges, sectionType)) {
    console.warn(
      `Skipping edge creation for unknown section type: ${sectionType}`
    );
    return;
  }

  // Skip section types for which we couldn't create evaluators
  if (!addedEvaluationNodes.has(sectionType)) {
    console.warn(
      `Skipping edge creation for ${sectionType} - no evaluator node was created`
    );
    return;
  }

  let sectionNodeName: NodeName;

  switch (sectionType) {
    case SectionType.EXECUTIVE_SUMMARY:
      sectionNodeName = NODES.EXEC_SUMMARY;
      break;
    case SectionType.PROBLEM_STATEMENT:
      sectionNodeName = NODES.PROB_STATEMENT;
      break;
    case SectionType.SOLUTION:
      sectionNodeName = NODES.SOLUTION;
      break;
    case SectionType.IMPLEMENTATION_PLAN:
      sectionNodeName = NODES.IMPL_PLAN;
      break;
    case SectionType.EVALUATION:
      sectionNodeName = NODES.EVALUATION;
      break;
    case SectionType.ORGANIZATIONAL_CAPACITY:
      sectionNodeName = NODES.ORG_CAPACITY;
      break;
    case SectionType.BUDGET:
      sectionNodeName = NODES.BUDGET;
      break;
    case SectionType.CONCLUSION:
      sectionNodeName = NODES.CONCLUSION;
      break;
    default:
      console.warn(`Skipping unknown section type: ${sectionType}`);
      return; // Skip this iteration for unknown section types
  }

  const evaluationNodeName = createSectionEvalNodeName(sectionType);

  // Make sure both section nodes and evaluators exist before adding edges
  try {
    // Connect section generator to evaluator
    (proposalGenerationGraph as any).addEdge(
      sectionNodeName,
      evaluationNodeName
    );

    // Define the routing map for evaluation results
    const evalRoutingMap = {
      // If evaluation passes, continue to next section
      next: NODES.SECTION_MANAGER,
      // If evaluation requires revision, loop back to section generator
      revision: sectionNodeName,
      // If evaluation needs human review, go to await feedback node
      review: NODES.AWAIT_FEEDBACK,
      // For backward compatibility
      awaiting_feedback: NODES.AWAIT_FEEDBACK,
      continue: NODES.SECTION_MANAGER,
      revise: sectionNodeName,
      complete: NODES.COMPLETE,
    };

    // Add conditional edges from evaluator based on evaluation results
    (proposalGenerationGraph as any).addConditionalEdges(
      evaluationNodeName,
      routeAfterEvaluation,
      evalRoutingMap
    );
  } catch (error) {
    console.warn(`Error connecting edges for ${sectionType}:`, error);
  }
});

// Connect await_feedback to process_feedback
(proposalGenerationGraph as any).addEdge(
  NODES.AWAIT_FEEDBACK,
  NODES.PROCESS_FEEDBACK
);

// Define routing map for feedback decisions
const feedbackRoutingMap: Record<string, string> = {
  continue: NODES.COMPLETE,
  research: NODES.DEEP_RESEARCH,
  solution_content: NODES.SOLUTION_SOUGHT,
  connections: NODES.CONNECTION_PAIRS,
  executive_summary: NODES.EXEC_SUMMARY,
  problem_statement: NODES.PROB_STATEMENT,
  solution: NODES.SOLUTION,
  implementation_plan: NODES.IMPL_PLAN,
  evaluation_approach: NODES.EVALUATION,
  conclusion: NODES.CONCLUSION,
  budget: NODES.BUDGET,
};

// Add conditional edges from process_feedback node
(proposalGenerationGraph as any).addConditionalEdges(
  NODES.PROCESS_FEEDBACK,
  routeAfterFeedback,
  feedbackRoutingMap
);

/**
 * Creates the proposal generation graph with all nodes and edges
 *
 * @param userId The user ID for the proposal
 * @param proposalId The proposal ID
 * @returns The configured StateGraph
 */
function createProposalGenerationGraph(
  userId: string = ENV.TEST_USER_ID,
  proposalId?: string
) {
  // Create a persistent checkpointer based on environment
  // In development: In-memory checkpointer (unless Supabase is configured)
  // In production: Supabase checkpointer (falls back to in-memory if not configured)
  const checkpointer = createCheckpointer({
    userId,
    proposalId,
    // Let the factory determine which implementation to use based on environment
  });

  if (ENV.isDevelopment()) {
    console.info(
      `Using ${ENV.isSupabaseConfigured() ? "Supabase" : "in-memory"} checkpointer for proposal graph in ${ENV.NODE_ENV} environment.`
    );
  }

  // Compile the graph with checkpointer
  const compiledGraph = proposalGenerationGraph.compile({
    checkpointer,
  });

  return compiledGraph;
}

// Export the graph creation function
export { createProposalGenerationGraph };
