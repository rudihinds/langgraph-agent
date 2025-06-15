/**
 * Streamlined Proposal Generation Graph with RFP Analysis Collaboration
 *
 * This is the main production graph focusing on intelligent RFP analysis and user collaboration.
 * The legacy complex graph with all original nodes is preserved in graph.legacy.ts for reference.
 *
 * Flow:
 * 1. Chat Agent (Entry point for user interaction)
 * 2. Document Loader (Process uploaded RFP documents)
 * 3. RFP Analyzer (Deep analysis with strategic insights)
 * 4. Strategic Validation Checkpoint (User collaboration interface)
 * 5. User Feedback Processor (Intelligent feedback interpretation)
 * 6. Strategic Options Refinement (Apply user feedback)
 * 7. Research Planning (Prepare for next phase)
 */

import { StateGraph, END, START, Command } from "@langchain/langgraph";
import { ProcessingStatus } from "../../state/modules/constants.js";
import { OverallProposalStateAnnotation } from "../../state/modules/annotations.js";
import { getInitializedCheckpointer } from "../../lib/persistence/robust-checkpointer.js";

// Core infrastructure nodes (retained)
import { documentLoaderNode } from "./nodes.js";

// V3 Chat agent - Pure multi-agent implementation following documented pattern
import { chatAgent } from "./nodes/chatAgent_v3.js";

// New RFP Analysis flow nodes - Multi-agent system with competitive intelligence
import {
  // Legacy V2 (deprecated)
  rfpAnalyzer as legacyRfpAnalyzer,
  humanReview as legacyHumanReview,
  feedbackRouter as legacyFeedbackRouter,
  approvalHandler as legacyApprovalHandler,
  rejectionHandler as legacyRejectionHandler,
  // New multi-agent system
  parallelDispatcherNode,
  parallelAnalysisRouter,
  linguisticPatternsNode,
  requirementsExtractionNode,
  documentStructureNode,
  strategicSignalsNode,
  synthesisNode,
  rfpAnalysisHumanReview,
  rfpAnalysisFeedbackRouter,
  rfpAnalysisApprovalHandler,
  rfpAnalysisRejectionHandler,
  rfpAnalysisQuestionAnswering,
  RFP_ANALYSIS_NODES
} from "./nodes/planning/rfp-analysis/index.js";

// Define node name constants for type safety and clarity
const NODES = {
  // V3 Chat Flow (Pure multi-agent pattern)
  CHAT_AGENT: "chatAgent",
  DOC_LOADER: "documentLoader",

  // Multi-Agent RFP Analysis Flow
  RFP_DISPATCHER: RFP_ANALYSIS_NODES.DISPATCHER,
  RFP_LINGUISTIC: RFP_ANALYSIS_NODES.LINGUISTIC,
  RFP_REQUIREMENTS: RFP_ANALYSIS_NODES.REQUIREMENTS,
  RFP_STRUCTURE: RFP_ANALYSIS_NODES.STRUCTURE,
  RFP_STRATEGIC: RFP_ANALYSIS_NODES.STRATEGIC,
  RFP_SYNTHESIS: RFP_ANALYSIS_NODES.SYNTHESIS,
  RFP_HITL_REVIEW: RFP_ANALYSIS_NODES.HITL_REVIEW,
  RFP_FEEDBACK_ROUTER: RFP_ANALYSIS_NODES.FEEDBACK_ROUTER,
  RFP_QA: RFP_ANALYSIS_NODES.QUESTION_ANSWERING,
  RFP_APPROVAL: RFP_ANALYSIS_NODES.APPROVAL,
  RFP_REJECTION: RFP_ANALYSIS_NODES.REJECTION,

  // Legacy RFP Analysis V2 Flow (deprecated)
  LEGACY_RFP_ANALYZER: "rfpAnalyzer",
  LEGACY_HUMAN_REVIEW: "humanReview",
  LEGACY_FEEDBACK_ROUTER: "feedbackRouter",
  LEGACY_APPROVAL_HANDLER: "approvalHandler",
  LEGACY_REJECTION_HANDLER: "rejectionHandler",

  // Future Integration Points (Placeholder for next development phases)
  RESEARCH_PLANNING: "researchPlanning",

  // Completion
  COMPLETE: "complete",
} as const;

// Type-safe node names
type NodeName = (typeof NODES)[keyof typeof NODES];

/**
 * Build the streamlined proposal generation graph
 * Uses the 'ends' pattern for multiple routing options as recommended
 */
const proposalGenerationGraph = new StateGraph(
  OverallProposalStateAnnotation.spec as any
);

// --------------------------------------------------------------------------------
// Node Registration with 'ends' Pattern for Multiple Routes
// --------------------------------------------------------------------------------

// Chat Agent V3 - Pure multi-agent coordinator following documented pattern
proposalGenerationGraph.addNode(NODES.CHAT_AGENT, chatAgent, {
  ends: [
    NODES.DOC_LOADER,
    NODES.RFP_DISPATCHER,
    END,
  ],
});

// Document Loader - Process uploaded RFP documents
proposalGenerationGraph.addNode(NODES.DOC_LOADER, documentLoaderNode, {
  ends: [NODES.RFP_DISPATCHER, NODES.CHAT_AGENT],
});

// Multi-Agent RFP Analysis System
// ================================

// Parallel Dispatcher - Orchestrates multi-agent analysis
proposalGenerationGraph.addNode(NODES.RFP_DISPATCHER, parallelDispatcherNode);

// Individual Analysis Agents (run in parallel)
proposalGenerationGraph.addNode(NODES.RFP_LINGUISTIC, linguisticPatternsNode);

proposalGenerationGraph.addNode(NODES.RFP_REQUIREMENTS, requirementsExtractionNode);

proposalGenerationGraph.addNode(NODES.RFP_STRUCTURE, documentStructureNode);

proposalGenerationGraph.addNode(NODES.RFP_STRATEGIC, strategicSignalsNode);

// Synthesis - Integrates all agent outputs
proposalGenerationGraph.addNode(NODES.RFP_SYNTHESIS, synthesisNode);

// Human Review - HITL checkpoint for analysis validation
proposalGenerationGraph.addNode(NODES.RFP_HITL_REVIEW, rfpAnalysisHumanReview, {
  ends: [NODES.RFP_FEEDBACK_ROUTER],
});

// Feedback Router - Interprets user decisions
proposalGenerationGraph.addNode(NODES.RFP_FEEDBACK_ROUTER, rfpAnalysisFeedbackRouter, {
  ends: [NODES.RFP_DISPATCHER, NODES.RFP_APPROVAL, NODES.RFP_REJECTION, NODES.RFP_QA],
});

// Question Answering - Answers user questions about analysis
proposalGenerationGraph.addNode(NODES.RFP_QA, rfpAnalysisQuestionAnswering, {
  ends: [NODES.RFP_HITL_REVIEW],
});

// Approval Handler - Proceed to next phase
proposalGenerationGraph.addNode(NODES.RFP_APPROVAL, rfpAnalysisApprovalHandler, {
  ends: [NODES.RESEARCH_PLANNING],
});

// Rejection Handler - Start fresh analysis
proposalGenerationGraph.addNode(NODES.RFP_REJECTION, rfpAnalysisRejectionHandler, {
  ends: [NODES.RFP_DISPATCHER],
});



// Research Planning - Prepare for next development phase (placeholder)
proposalGenerationGraph.addNode(
  NODES.RESEARCH_PLANNING,
  async (state: typeof OverallProposalStateAnnotation.State) => {
    // Placeholder for future research planning agent
    console.log(
      "Research Planning phase - to be implemented in next development phase"
    );
    return new Command({
      goto: NODES.COMPLETE,
      update: {
        status: ProcessingStatus.COMPLETE,
        currentPhase: "complete" as const,
      }
    });
  },
  {
    ends: [NODES.COMPLETE],
  }
);

// Complete - Final state
proposalGenerationGraph.addNode(
  NODES.COMPLETE,
  async (state: typeof OverallProposalStateAnnotation.State) => {
    return new Command({
      goto: END,
      update: {
        status: ProcessingStatus.COMPLETE,
        currentPhase: "complete" as const,
      }
    });
  }
);

// --------------------------------------------------------------------------------
// Edge Definitions with Conditional Routing
// --------------------------------------------------------------------------------

// Entry point
(proposalGenerationGraph as any).addEdge(START, NODES.CHAT_AGENT);

// RFP Analysis Parallel Execution - Critical for multi-agent flow
// This conditional edge dispatches from dispatcher to all 4 analysis agents in parallel
(proposalGenerationGraph as any).addConditionalEdges(
  NODES.RFP_DISPATCHER,
  parallelAnalysisRouter
);

// Critical: Connect all 4 parallel analysis agents to synthesis node
// This ensures synthesis waits for ALL agents to complete before executing
(proposalGenerationGraph as any).addEdge(NODES.RFP_LINGUISTIC, NODES.RFP_SYNTHESIS);
(proposalGenerationGraph as any).addEdge(NODES.RFP_REQUIREMENTS, NODES.RFP_SYNTHESIS);
(proposalGenerationGraph as any).addEdge(NODES.RFP_STRUCTURE, NODES.RFP_SYNTHESIS);
(proposalGenerationGraph as any).addEdge(NODES.RFP_STRATEGIC, NODES.RFP_SYNTHESIS);

// Connect synthesis to HITL review
(proposalGenerationGraph as any).addEdge(NODES.RFP_SYNTHESIS, NODES.RFP_HITL_REVIEW);

// V2 Chat flow - Clean routing without recursion
// All routing decisions are handled within nodes using Command pattern
// No conditional edges needed for chat flow - nodes handle their own routing

// Document loader now uses Command pattern for routing - no conditional edges needed

// No direct edge needed - RFP Analyzer routes through the multi-agent flow

// Research Planning now uses Command pattern for routing - no edges needed

// Compiled graph instance
let compiledGraph: any = null;

/**
 * Create and return the compiled streamlined proposal generation graph
 *
 * This is the main entry point for the proposal generation system.
 * The graph focuses on intelligent RFP analysis with user collaboration.
 */
export async function createProposalGenerationGraph() {
  if (compiledGraph) {
    return compiledGraph;
  }

  try {
    // Initialize the checkpointer for state persistence
    const checkpointer = await getInitializedCheckpointer();

    // Compile the graph with checkpointer and interrupt handling
    compiledGraph = (proposalGenerationGraph as any).compile({
      checkpointer,
      // Configure interrupt handling for nodes that use interrupt() calls
      interruptBefore: [], // Empty since we use interrupt() within nodes, not before nodes
      interruptAfter: [], // Empty since other interrupts are handled differently
    });

    console.log(
      "✅ Streamlined Proposal Generation Graph with RFP Analysis compiled successfully"
    );

    return compiledGraph;
  } catch (error) {
    console.error("❌ Failed to compile proposal generation graph:", error);
    throw error;
  }
}

/**
 * Reset the compiled graph (useful for testing or configuration changes)
 */
export function resetCompiledGraph() {
  compiledGraph = null;
}

// Export node names for external reference
export { NODES };
export type { NodeName };
