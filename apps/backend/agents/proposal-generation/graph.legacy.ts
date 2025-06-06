/**
 * LEGACY Proposal Generation Graph - FULL ORIGINAL IMPLEMENTATION
 *
 * This file contains the original complex graph with all nodes and flows.
 * Kept as reference during transition to the new streamlined RFP analysis approach.
 *
 * This implementation is preserved in case we need to reference specific patterns
 * or revert changes during the transition period.
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
import {
  masterOrchestratorNode,
  routeAfterMasterOrchestrator,
  awaitStrategicPrioritiesNode,
} from "./nodes/planning/master_orchestrator.js";
import { OverallProposalStateAnnotation } from "../../state/modules/annotations.js";
import { createSectionEvaluators } from "../../agents/evaluation/sectionEvaluators.js";
import { getInitializedCheckpointer } from "../../lib/persistence/robust-checkpointer.js";
import { sectionNodes } from "./nodes/section_nodes.js";
import { ENV } from "../../lib/config/env.js";
import { processFeedbackNode } from "./nodes/processFeedback.js";
import { chatAgentNode, shouldContinueChat } from "./nodes/chatAgent.js";
import { interpretIntentTool } from "../../tools/interpretIntentTool.js";
import { processToolsNode } from "./nodes/toolProcessor.js";
import { AIMessage, BaseMessage, ToolMessage } from "@langchain/core/messages";
import { FeedbackType } from "../../lib/types/feedback.js";
import { enhancedResearchNode } from "./nodes/planning/enhanced_research.js";

// Define node name constants for type safety - ORIGINAL
const LEGACY_NODES = {
  DOC_LOADER: "documentLoader",
  MASTER_ORCHESTRATOR: "masterOrchestrator",
  AWAIT_STRATEGIC_PRIORITIES: "awaitStrategicPriorities",
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
  CHAT_AGENT: "chatAgent",
  CHAT_TOOLS: "chatTools",
  ENHANCED_RESEARCH: "enhancedResearch",
} as const;

// Type-safe node names - LEGACY
type LegacyNodeName = (typeof LEGACY_NODES)[keyof typeof LEGACY_NODES];

// Create node name helpers for section evaluators
const createSectionEvalNodeName = (sectionType: SectionType) =>
  `evaluateSection_${sectionType}` as const;

/**
 * LEGACY: Create the original complex proposal generation graph
 * This function is preserved for reference but should not be used in production
 */
export async function createLegacyProposalGenerationGraph() {
  console.warn(
    "WARNING: Using legacy graph implementation. Consider migrating to the new streamlined version."
  );

  let legacyGraph: any = new StateGraph(
    OverallProposalStateAnnotation.spec as any
  );

  // Add base nodes for research and analysis
  legacyGraph.addNode(LEGACY_NODES.DOC_LOADER, documentLoaderNode, {
    ends: [LEGACY_NODES.MASTER_ORCHESTRATOR],
  });

  // Add Master Orchestrator nodes for strategic planning
  legacyGraph.addNode(LEGACY_NODES.MASTER_ORCHESTRATOR, masterOrchestratorNode);
  legacyGraph.addNode(
    LEGACY_NODES.AWAIT_STRATEGIC_PRIORITIES,
    awaitStrategicPrioritiesNode
  );

  // Add Enhanced Research Agent (Phase 2.2)
  legacyGraph.addNode(LEGACY_NODES.ENHANCED_RESEARCH, enhancedResearchNode);

  legacyGraph.addNode(LEGACY_NODES.DEEP_RESEARCH, deepResearchNode);
  legacyGraph.addNode(LEGACY_NODES.SOLUTION_SOUGHT, solutionSoughtNode);
  legacyGraph.addNode(LEGACY_NODES.CONNECTION_PAIRS, connectionPairsNode);
  legacyGraph.addNode(LEGACY_NODES.SECTION_MANAGER, sectionManagerNode);

  // Add the chat agent node
  legacyGraph.addNode(LEGACY_NODES.CHAT_AGENT, chatAgentNode);

  // Create a ToolNode with the interpretIntentTool for proper tool handling
  legacyGraph.addNode(LEGACY_NODES.CHAT_TOOLS, processToolsNode);

  // Add section generation nodes from our factory
  legacyGraph.addNode(
    LEGACY_NODES.EXEC_SUMMARY,
    sectionNodes[SectionType.EXECUTIVE_SUMMARY]
  );
  legacyGraph.addNode(
    LEGACY_NODES.PROB_STATEMENT,
    sectionNodes[SectionType.PROBLEM_STATEMENT]
  );
  legacyGraph.addNode(
    LEGACY_NODES.SOLUTION,
    sectionNodes[SectionType.SOLUTION]
  );
  legacyGraph.addNode(
    LEGACY_NODES.IMPL_PLAN,
    sectionNodes[SectionType.IMPLEMENTATION_PLAN]
  );
  legacyGraph.addNode(
    LEGACY_NODES.EVALUATION,
    sectionNodes[SectionType.EVALUATION]
  );
  legacyGraph.addNode(
    LEGACY_NODES.ORG_CAPACITY,
    sectionNodes[SectionType.ORGANIZATIONAL_CAPACITY]
  );
  legacyGraph.addNode(LEGACY_NODES.BUDGET, sectionNodes[SectionType.BUDGET]);
  legacyGraph.addNode(
    LEGACY_NODES.CONCLUSION,
    sectionNodes[SectionType.CONCLUSION]
  );

  // Add human-in-the-loop feedback node using LangGraph's built-in interrupt
  legacyGraph.addNode(
    LEGACY_NODES.AWAIT_FEEDBACK,
    async (state: typeof OverallProposalStateAnnotation.State) => {
      return state;
    }
  );

  // Add complete node to mark the end of the graph
  legacyGraph.addNode(
    LEGACY_NODES.COMPLETE,
    async (state: typeof OverallProposalStateAnnotation.State) => {
      return {
        status: ProcessingStatus.COMPLETE,
      };
    }
  );

  // Add evaluation nodes
  legacyGraph.addNode(LEGACY_NODES.EVAL_RESEARCH, evaluateResearchNode);
  legacyGraph.addNode(LEGACY_NODES.EVAL_SOLUTION, evaluateSolutionNode);
  legacyGraph.addNode(LEGACY_NODES.EVAL_CONNECTIONS, evaluateConnectionsNode);

  // Section generation routing
  const conditionalEdges: Record<string, LegacyNodeName> = {
    [SectionType.EXECUTIVE_SUMMARY]: LEGACY_NODES.EXEC_SUMMARY,
    [SectionType.PROBLEM_STATEMENT]: LEGACY_NODES.PROB_STATEMENT,
    [SectionType.SOLUTION]: LEGACY_NODES.SOLUTION,
    [SectionType.IMPLEMENTATION_PLAN]: LEGACY_NODES.IMPL_PLAN,
    [SectionType.EVALUATION]: LEGACY_NODES.EVALUATION,
    [SectionType.ORGANIZATIONAL_CAPACITY]: LEGACY_NODES.ORG_CAPACITY,
    [SectionType.BUDGET]: LEGACY_NODES.BUDGET,
    [SectionType.CONCLUSION]: LEGACY_NODES.CONCLUSION,
    complete: LEGACY_NODES.COMPLETE,
  };

  // Get all section evaluators from the factory
  const sectionEvaluators = createSectionEvaluators();

  // Add section evaluation nodes for each section
  const addedEvaluationNodes = new Set<string>();

  // Add evaluation nodes for each section
  Object.values(SectionType).forEach((sectionType) => {
    try {
      if (
        !Object.prototype.hasOwnProperty.call(conditionalEdges, sectionType)
      ) {
        console.warn(
          `Skipping evaluation for unknown section type: ${sectionType}`
        );
        return;
      }

      const evaluationNodeName = createSectionEvalNodeName(sectionType);

      if (!sectionEvaluators[sectionType]) {
        console.warn(
          `No evaluator found for section type: ${sectionType}. Skipping node creation.`
        );
        return;
      }

      legacyGraph.addNode(evaluationNodeName, sectionEvaluators[sectionType]);

      addedEvaluationNodes.add(sectionType);
      console.log(`Added evaluation node for ${sectionType}`);
    } catch (error: unknown) {
      console.warn(`Error adding evaluation node for ${sectionType}:`, error);
    }
  });

  // Add feedback processor node
  legacyGraph.addNode(LEGACY_NODES.PROCESS_FEEDBACK, processFeedbackNode);

  // Define edges for the main flow
  (legacyGraph as any).addEdge("__start__", LEGACY_NODES.CHAT_AGENT);
  (legacyGraph as any).addEdge(
    LEGACY_NODES.CHAT_TOOLS,
    LEGACY_NODES.CHAT_AGENT
  );

  // Conditional edges from chat agent
  (legacyGraph as any).addConditionalEdges(
    LEGACY_NODES.CHAT_AGENT,
    shouldContinueChat,
    {
      chatTools: LEGACY_NODES.CHAT_TOOLS,
      regenerateSection: LEGACY_NODES.SECTION_MANAGER,
      modifySection: LEGACY_NODES.SECTION_MANAGER,
      approveSection: LEGACY_NODES.AWAIT_FEEDBACK,
      answerQuestion: LEGACY_NODES.CHAT_AGENT,
      loadDocument: LEGACY_NODES.DOC_LOADER,
      __end__: END,
    } as Record<string, LegacyNodeName | string>
  );

  // Master Orchestrator flow
  (legacyGraph as any).addEdge(
    LEGACY_NODES.DOC_LOADER,
    LEGACY_NODES.MASTER_ORCHESTRATOR
  );

  // Conditional edges from Master Orchestrator
  (legacyGraph as any).addConditionalEdges(
    LEGACY_NODES.MASTER_ORCHESTRATOR,
    routeAfterMasterOrchestrator,
    {
      awaiting_strategic_priorities: LEGACY_NODES.AWAIT_STRATEGIC_PRIORITIES,
      enhanced_research: LEGACY_NODES.ENHANCED_RESEARCH,
      research: LEGACY_NODES.DEEP_RESEARCH,
      deep_research: LEGACY_NODES.DEEP_RESEARCH,
      error: LEGACY_NODES.DEEP_RESEARCH,
    }
  );

  // Rest of the legacy edges...
  (legacyGraph as any).addEdge(
    LEGACY_NODES.AWAIT_STRATEGIC_PRIORITIES,
    LEGACY_NODES.ENHANCED_RESEARCH
  );

  (legacyGraph as any).addEdge(
    LEGACY_NODES.ENHANCED_RESEARCH,
    LEGACY_NODES.EVAL_RESEARCH
  );

  (legacyGraph as any).addEdge(
    LEGACY_NODES.DEEP_RESEARCH,
    LEGACY_NODES.EVAL_RESEARCH
  );
  (legacyGraph as any).addEdge(
    LEGACY_NODES.EVAL_RESEARCH,
    LEGACY_NODES.SOLUTION_SOUGHT
  );
  (legacyGraph as any).addEdge(
    LEGACY_NODES.SOLUTION_SOUGHT,
    LEGACY_NODES.EVAL_SOLUTION
  );
  (legacyGraph as any).addEdge(
    LEGACY_NODES.EVAL_SOLUTION,
    LEGACY_NODES.CONNECTION_PAIRS
  );
  (legacyGraph as any).addEdge(
    LEGACY_NODES.CONNECTION_PAIRS,
    LEGACY_NODES.EVAL_CONNECTIONS
  );
  (legacyGraph as any).addEdge(
    LEGACY_NODES.EVAL_CONNECTIONS,
    LEGACY_NODES.SECTION_MANAGER
  );

  // Add conditional edges for section routing
  (legacyGraph as any).addConditionalEdges(
    LEGACY_NODES.SECTION_MANAGER,
    routeSectionGeneration,
    conditionalEdges
  );

  // Initialize the checkpointer
  const checkpointer = await getInitializedCheckpointer();

  // Compile the legacy graph
  const compiledLegacyGraph = (legacyGraph as any).compile({
    checkpointer,
  });

  console.log(
    "Legacy Proposal Generation Graph compiled (for reference only)."
  );
  return compiledLegacyGraph;
}
