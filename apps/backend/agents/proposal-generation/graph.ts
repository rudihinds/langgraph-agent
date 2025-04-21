/**
 * Proposal Generation Graph
 *
 * This file defines the main StateGraph for proposal generation.
 * It sets up nodes, edges, and conditional branching based on state changes.
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
  evaluationNodes,
} from "./nodes.js";
import { routeSectionGeneration } from "./conditionals.js";
import { addEvaluationNode } from "./evaluation_integration.js";
import { sectionNodes } from "./nodes/section_nodes.js";
import { OverallProposalStateAnnotation } from "../../state/modules/annotations.js";

// Define node name constants for type safety
const NODES = {
  DOC_LOADER: "documentLoader" as const,
  DEEP_RESEARCH: "deepResearch" as const,
  SOLUTION_SOUGHT: "solutionSought" as const,
  CONNECTION_PAIRS: "connectionPairs" as const,
  SECTION_MANAGER: "sectionManager" as const,
  EXEC_SUMMARY: "generateExecutiveSummary" as const,
  PROB_STATEMENT: "generateProblemStatement" as const,
  SOLUTION: "generateSolution" as const,
  IMPL_PLAN: "generateImplementationPlan" as const,
  EVALUATION: "generateEvaluation" as const,
  ORG_CAPACITY: "generateOrganizationalCapacity" as const,
  BUDGET: "generateBudget" as const,
  CONCLUSION: "generateConclusion" as const,
  AWAIT_FEEDBACK: "awaiting_feedback" as const,
  COMPLETE: "complete" as const,
  EVAL_RESEARCH: "evaluateResearch" as const,
  EVAL_SOLUTION: "evaluateSolution" as const,
  EVAL_CONNECTIONS: "evaluateConnections" as const,
};

/**
 * Creates the proposal generation graph with all nodes and edges
 *
 * @returns The configured StateGraph
 */
export function createProposalGenerationGraph() {
  // Create the StateGraph using the annotation directly, with explicit typing to help TypeScript
  const graph = new StateGraph<any, OverallProposalState>(
    OverallProposalStateAnnotation as any
  );

  // Add base nodes for research and analysis
  graph.addNode(NODES.DOC_LOADER, documentLoaderNode);
  graph.addNode(NODES.DEEP_RESEARCH, deepResearchNode);
  graph.addNode(NODES.SOLUTION_SOUGHT, solutionSoughtNode);
  graph.addNode(NODES.CONNECTION_PAIRS, connectionPairsNode);
  graph.addNode(NODES.SECTION_MANAGER, sectionManagerNode);

  // Add section generation nodes from our factory
  graph.addNode(
    NODES.EXEC_SUMMARY,
    sectionNodes[SectionType.EXECUTIVE_SUMMARY]
  );
  graph.addNode(
    NODES.PROB_STATEMENT,
    sectionNodes[SectionType.PROBLEM_STATEMENT]
  );
  graph.addNode(NODES.SOLUTION, sectionNodes[SectionType.SOLUTION]);
  graph.addNode(NODES.IMPL_PLAN, sectionNodes[SectionType.IMPLEMENTATION_PLAN]);
  graph.addNode(NODES.EVALUATION, sectionNodes[SectionType.EVALUATION]);
  graph.addNode(
    NODES.ORG_CAPACITY,
    sectionNodes[SectionType.ORGANIZATIONAL_CAPACITY]
  );
  graph.addNode(NODES.BUDGET, sectionNodes[SectionType.BUDGET]);
  graph.addNode(NODES.CONCLUSION, sectionNodes[SectionType.CONCLUSION]);

  // Add awaiting feedback node for human-in-the-loop interactions
  graph.addNode(NODES.AWAIT_FEEDBACK, async (state) => {
    // This node doesn't do anything, it just waits for human feedback
    return state;
  });

  // Add complete node to mark the end of the graph
  graph.addNode(NODES.COMPLETE, async (state) => {
    return {
      status: "complete",
    };
  });

  // Add evaluation nodes
  graph.addNode(NODES.EVAL_RESEARCH, evaluateResearchNode);
  graph.addNode(NODES.EVAL_SOLUTION, evaluateSolutionNode);
  graph.addNode(NODES.EVAL_CONNECTIONS, evaluateConnectionsNode);

  // Add evaluation nodes for each section
  Object.values(SectionType).forEach((sectionType) => {
    const evaluationNodeName = `evaluateSection_${sectionType}`;
    graph.addNode(evaluationNodeName, evaluationNodes.section);
  });

  // Define edges for the main flow with type casting to avoid TypeScript errors
  graph.addEdge(START as any, NODES.DOC_LOADER as any);
  graph.addEdge(NODES.DOC_LOADER as any, NODES.DEEP_RESEARCH as any);
  graph.addEdge(NODES.DEEP_RESEARCH as any, NODES.EVAL_RESEARCH as any);
  graph.addEdge(NODES.EVAL_RESEARCH as any, NODES.SOLUTION_SOUGHT as any);
  graph.addEdge(NODES.SOLUTION_SOUGHT as any, NODES.EVAL_SOLUTION as any);
  graph.addEdge(NODES.EVAL_SOLUTION as any, NODES.CONNECTION_PAIRS as any);
  graph.addEdge(NODES.CONNECTION_PAIRS as any, NODES.EVAL_CONNECTIONS as any);
  graph.addEdge(NODES.EVAL_CONNECTIONS as any, NODES.SECTION_MANAGER as any);

  // Section generation routing with type casting for node names
  const conditionalEdges: Record<string, any> = {
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

  // Add conditional edges with minimal type casting
  graph.addConditionalEdges(
    NODES.SECTION_MANAGER as any,
    routeSectionGeneration as any,
    conditionalEdges as any
  );

  // Compile the graph
  const compiledGraph = graph.compile();

  return compiledGraph;
}

export default {
  createProposalGenerationGraph,
};
