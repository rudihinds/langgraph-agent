/**
 * Evaluation Node Integration Utilities
 *
 * Provides helper functions for integrating evaluation nodes into the proposal generation graph.
 * This file serves as a bridge between the generic evaluation framework and the specific
 * requirements of the proposal generation workflow.
 */

import { StateGraph } from "@langchain/langgraph";
import { OverallProposalState } from "../../state/proposal.state.js";
import { createEvaluationNode } from "../../agents/evaluation/evaluationNodeFactory.js";
import { routeAfterEvaluation } from "./conditionals.js";
import { evaluateContent } from "./nodes.js";

/**
 * Configuration options for adding an evaluation node to the graph
 */
interface EvaluationNodeOptions {
  /** Content type to evaluate (research, solution, connections, or a section ID) */
  contentType: string;
  /** Name of the node that produced the content to be evaluated */
  sourceNode?: string;
  /** Name of the node that produced the content to be evaluated (alternative parameter name) */
  sourceNodeName?: string;
  /** Name of the node to route to after evaluation (if not using conditionals) */
  targetNode?: string;
  /** Name of the node to route to after evaluation (alternative parameter name) */
  destinationNodeName?: string;
  /** ID of the section when contentType is "section" */
  sectionId?: string;
  /** Path to criteria configuration JSON file */
  criteriaPath?: string;
  /** Threshold score for passing evaluation (0.0-1.0) */
  passingThreshold?: number;
  /** Maximum time in milliseconds for evaluation before timeout */
  timeout?: number;
}

/**
 * Adds an evaluation node to the proposal generation graph
 *
 * This helper function simplifies the process of adding standardized evaluation nodes
 * to the proposal generation graph, handling node creation, edge connections,
 * and conditional routing.
 *
 * @param graph The StateGraph instance to add the node to
 * @param options Configuration options for the evaluation node
 * @returns The name of the created evaluation node
 */
export function addEvaluationNode(
  graph: StateGraph<typeof OverallProposalState.State>,
  options: EvaluationNodeOptions
): string {
  const {
    contentType,
    sourceNode,
    sourceNodeName,
    targetNode,
    destinationNodeName,
    sectionId,
    criteriaPath,
    passingThreshold,
    timeout,
  } = options;

  // Support both sourceNode and sourceNodeName for backward compatibility
  const sourceNodeValue = sourceNode || sourceNodeName;

  // Support both targetNode and destinationNodeName for backward compatibility
  const targetNodeValue = targetNode || destinationNodeName;

  if (!sourceNodeValue) {
    throw new Error(
      "Source node must be specified via sourceNode or sourceNodeName"
    );
  }

  // Determine node name based on content type
  let nodeName: string;
  let evaluationParams: Record<string, any> = {
    contentType,
  };

  // Use underscore-based naming convention for better readability in tests/logs
  if (contentType === "section" && sectionId) {
    nodeName = `evaluate_section_${sectionId}`;
    evaluationParams.sectionId = sectionId;
  } else {
    nodeName = `evaluate_${contentType}`;
  }

  // Add additional options to params
  if (criteriaPath) {
    evaluationParams.criteriaPath = criteriaPath;
  }

  if (passingThreshold !== undefined) {
    evaluationParams.passingThreshold = passingThreshold;
  }

  if (timeout !== undefined) {
    evaluationParams.timeout = timeout;
  }

  // Add the evaluation node to the graph
  graph.addNode(nodeName, async (state: OverallProposalState) => {
    // Evaluate the content using parameters specific to this content type
    return await evaluateContent(state, evaluationParams);
  });

  // Connect source node to evaluation node
  graph.addEdge(sourceNodeValue, nodeName);

  // If targetNode is provided, create a direct edge
  if (targetNodeValue) {
    graph.addEdge(nodeName, targetNodeValue);
  }
  // Otherwise, add conditional routing based on evaluation result
  else {
    const routingOptions = {
      contentType,
      ...(sectionId && { sectionId }),
    };

    graph.addConditionalEdges(
      nodeName,
      (state) => routeAfterEvaluation(state, routingOptions),
      {
        // Define edge targets based on routing results
        continue: "continue",
        revise: `revise_${contentType}${sectionId ? `_${sectionId}` : ""}`,
        awaiting_feedback: "awaiting_feedback",
      }
    );
  }

  // Configure the node as an interrupt point
  graph.compiler?.interruptAfter?.(nodeName, (state: OverallProposalState) => {
    // Check if this node has triggered an interrupt
    return (
      state.interruptStatus?.isInterrupted &&
      state.interruptStatus?.interruptionPoint === nodeName
    );
  });

  return nodeName;
}

export default {
  addEvaluationNode,
};
