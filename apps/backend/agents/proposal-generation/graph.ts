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

import { StateGraph, END, START, GraphRecursionError } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ProcessingStatus } from "../../state/modules/constants.js";
import { OverallProposalStateAnnotation } from "../../state/modules/annotations.js";
import { getInitializedCheckpointer } from "../../lib/persistence/robust-checkpointer.js";
import { getIntelligenceSearchTool } from "../../tools/intelligence-search.js";
import { getIntelligenceExtractTool } from "../../tools/intelligence-extract.js";

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
  rfpAnalysisSynchronizer,
  synthesisNode,
  rfpAnalysisHumanReview,
  rfpAnalysisFeedbackRouter,
  rfpAnalysisApprovalHandler,
  rfpAnalysisRejectionHandler,
  rfpAnalysisQuestionAnswering,
  RFP_ANALYSIS_NODES,
} from "./nodes/planning/rfp-analysis/index.js";

// Parallel Intelligence Gathering nodes - Complete intelligence system
import {
  intelligenceDispatcher,
  intelligenceSynchronizer,
  parallelIntelligenceRouter,
  intelligenceFormatter,
  intelligenceGatheringHumanReview,
  intelligenceGatheringFeedbackRouter,
  intelligenceGatheringApprovalHandler,
  intelligenceGatheringRejectionHandler,
  intelligenceGatheringQuestionAnswering,
  PARALLEL_INTELLIGENCE_NODES,
  INTELLIGENCE_GATHERING_NODES,
  // Import subgraph wrapper nodes
  vendorRelationshipsSubgraphNode,
  strategicInitiativesSubgraphNode,
  procurementPatternsSubgraphNode,
  decisionMakersSubgraphNode,
  PARALLEL_INTELLIGENCE_SUBGRAPH_NODES,
} from "./nodes/planning/parallel-intelligence/index.js";

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
  RFP_SYNCHRONIZER: RFP_ANALYSIS_NODES.SYNCHRONIZER,
  RFP_SYNTHESIS: RFP_ANALYSIS_NODES.SYNTHESIS,
  RFP_HITL_REVIEW: RFP_ANALYSIS_NODES.HITL_REVIEW,
  RFP_FEEDBACK_ROUTER: RFP_ANALYSIS_NODES.FEEDBACK_ROUTER,
  RFP_QA: RFP_ANALYSIS_NODES.QUESTION_ANSWERING,
  RFP_APPROVAL: RFP_ANALYSIS_NODES.APPROVAL,
  RFP_REJECTION: RFP_ANALYSIS_NODES.REJECTION,

  // Intelligence Formatter and HITL nodes (shared by parallel system)
  INTELLIGENCE_FORMATTER: INTELLIGENCE_GATHERING_NODES.FORMATTER,
  INTELLIGENCE_HITL_REVIEW: INTELLIGENCE_GATHERING_NODES.HITL_REVIEW,
  INTELLIGENCE_FEEDBACK_ROUTER: INTELLIGENCE_GATHERING_NODES.FEEDBACK_ROUTER,
  INTELLIGENCE_APPROVAL: INTELLIGENCE_GATHERING_NODES.APPROVAL,
  INTELLIGENCE_REJECTION: INTELLIGENCE_GATHERING_NODES.REJECTION,
  INTELLIGENCE_QA: INTELLIGENCE_GATHERING_NODES.QA,

  // Parallel Intelligence Gathering Flow
  PARALLEL_INTEL_DISPATCHER: PARALLEL_INTELLIGENCE_NODES.DISPATCHER,
  PARALLEL_INTEL_ROUTER: "parallelIntelligenceRouter",
  PARALLEL_INTEL_SYNCHRONIZER: PARALLEL_INTELLIGENCE_NODES.SYNCHRONIZER,
  
  // Parallel Intelligence Agents
  PARALLEL_STRATEGIC_AGENT: PARALLEL_INTELLIGENCE_NODES.STRATEGIC_AGENT,
  PARALLEL_STRATEGIC_TOOLS: PARALLEL_INTELLIGENCE_NODES.STRATEGIC_TOOLS,
  PARALLEL_VENDOR_AGENT: PARALLEL_INTELLIGENCE_NODES.VENDOR_AGENT,
  PARALLEL_VENDOR_TOOLS: PARALLEL_INTELLIGENCE_NODES.VENDOR_TOOLS,
  PARALLEL_PROCUREMENT_AGENT: PARALLEL_INTELLIGENCE_NODES.PROCUREMENT_AGENT,
  PARALLEL_PROCUREMENT_TOOLS: PARALLEL_INTELLIGENCE_NODES.PROCUREMENT_TOOLS,
  PARALLEL_DECISION_AGENT: PARALLEL_INTELLIGENCE_NODES.DECISION_AGENT,
  PARALLEL_DECISION_TOOLS: PARALLEL_INTELLIGENCE_NODES.DECISION_TOOLS,

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
  ends: [NODES.DOC_LOADER, NODES.RFP_DISPATCHER, END],
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

proposalGenerationGraph.addNode(
  NODES.RFP_REQUIREMENTS,
  requirementsExtractionNode
);

proposalGenerationGraph.addNode(NODES.RFP_STRUCTURE, documentStructureNode);

proposalGenerationGraph.addNode(NODES.RFP_STRATEGIC, strategicSignalsNode);

// Synchronizer - Ensures all agents complete before synthesis
proposalGenerationGraph.addNode(NODES.RFP_SYNCHRONIZER, rfpAnalysisSynchronizer);

// Synthesis - Integrates all agent outputs
proposalGenerationGraph.addNode(NODES.RFP_SYNTHESIS, synthesisNode);

// Human Review - HITL checkpoint for analysis validation
proposalGenerationGraph.addNode(NODES.RFP_HITL_REVIEW, rfpAnalysisHumanReview, {
  ends: [NODES.RFP_FEEDBACK_ROUTER],
});

// Feedback Router - Interprets user decisions
proposalGenerationGraph.addNode(
  NODES.RFP_FEEDBACK_ROUTER,
  rfpAnalysisFeedbackRouter,
  {
    ends: [
      NODES.RFP_DISPATCHER,
      NODES.RFP_APPROVAL,
      NODES.RFP_REJECTION,
      NODES.RFP_QA,
    ],
  }
);

// Question Answering - Answers user questions about analysis
proposalGenerationGraph.addNode(NODES.RFP_QA, rfpAnalysisQuestionAnswering, {
  ends: [NODES.RFP_HITL_REVIEW],
});

// Approval Handler - Proceed to next phase
proposalGenerationGraph.addNode(
  NODES.RFP_APPROVAL,
  rfpAnalysisApprovalHandler,
  {
    ends: [NODES.PARALLEL_INTEL_DISPATCHER], // Changed to parallel intelligence
  }
);

// Rejection Handler - Start fresh analysis
proposalGenerationGraph.addNode(
  NODES.RFP_REJECTION,
  rfpAnalysisRejectionHandler,
  {
    ends: [NODES.RFP_DISPATCHER],
  }
);

// Intelligence Formatter and HITL Review System
// ==============================================

// Intelligence Formatter - Formats research into human-readable briefing
proposalGenerationGraph.addNode(
  NODES.INTELLIGENCE_FORMATTER,
  intelligenceFormatter
);

// Intelligence Human Review - HITL checkpoint for intelligence validation
proposalGenerationGraph.addNode(
  NODES.INTELLIGENCE_HITL_REVIEW,
  intelligenceGatheringHumanReview,
  {
    ends: [NODES.INTELLIGENCE_FEEDBACK_ROUTER],
  }
);

// Intelligence Feedback Router - Interprets user decisions
proposalGenerationGraph.addNode(
  NODES.INTELLIGENCE_FEEDBACK_ROUTER,
  intelligenceGatheringFeedbackRouter,
  {
    ends: [
      NODES.INTELLIGENCE_APPROVAL,
      NODES.INTELLIGENCE_QA,
      NODES.INTELLIGENCE_REJECTION,
    ],
  }
);

// Intelligence Question Answering - Answers user questions about intelligence
proposalGenerationGraph.addNode(
  NODES.INTELLIGENCE_QA,
  intelligenceGatheringQuestionAnswering,
  {
    ends: [NODES.INTELLIGENCE_HITL_REVIEW],
  }
);

// Intelligence Approval Handler - Proceed to next phase
proposalGenerationGraph.addNode(
  NODES.INTELLIGENCE_APPROVAL,
  intelligenceGatheringApprovalHandler,
  {
    ends: [NODES.COMPLETE], // TODO: Replace with next phase when implemented
  }
);

// Intelligence Rejection Handler - Return to parallel intelligence
proposalGenerationGraph.addNode(
  NODES.INTELLIGENCE_REJECTION,
  intelligenceGatheringRejectionHandler,
  {
    ends: [NODES.PARALLEL_INTEL_DISPATCHER],
  }
);

// ===== PARALLEL INTELLIGENCE GATHERING NODES =====

// Parallel Intelligence Dispatcher
proposalGenerationGraph.addNode(
  NODES.PARALLEL_INTEL_DISPATCHER,
  intelligenceDispatcher
);

// Parallel Intelligence Router (virtual node for routing)
proposalGenerationGraph.addNode(
  NODES.PARALLEL_INTEL_ROUTER,
  async (state) => state // Pass-through node
);

// Strategic Initiatives Subgraph
proposalGenerationGraph.addNode(
  PARALLEL_INTELLIGENCE_SUBGRAPH_NODES.STRATEGIC_SUBGRAPH,
  strategicInitiativesSubgraphNode
);

// Vendor Relationships Subgraph
proposalGenerationGraph.addNode(
  PARALLEL_INTELLIGENCE_SUBGRAPH_NODES.VENDOR_SUBGRAPH,
  vendorRelationshipsSubgraphNode
);

// Procurement Patterns Subgraph
proposalGenerationGraph.addNode(
  PARALLEL_INTELLIGENCE_SUBGRAPH_NODES.PROCUREMENT_SUBGRAPH,
  procurementPatternsSubgraphNode
);

// Decision Makers Subgraph
proposalGenerationGraph.addNode(
  PARALLEL_INTELLIGENCE_SUBGRAPH_NODES.DECISION_SUBGRAPH,
  decisionMakersSubgraphNode
);

// Parallel Intelligence Synchronizer
proposalGenerationGraph.addNode(
  NODES.PARALLEL_INTEL_SYNCHRONIZER,
  intelligenceSynchronizer
);

// Complete - Final state
proposalGenerationGraph.addNode(
  NODES.COMPLETE,
  async () => {
    return {
      status: ProcessingStatus.COMPLETE,
      currentPhase: "complete" as const,
    };
  },
  {
    ends: [END]
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

// Critical: Connect all 4 parallel analysis agents to synchronizer
// This ensures synchronizer checks all agents before synthesis
(proposalGenerationGraph as any).addEdge(
  NODES.RFP_LINGUISTIC,
  NODES.RFP_SYNCHRONIZER
);
(proposalGenerationGraph as any).addEdge(
  NODES.RFP_REQUIREMENTS,
  NODES.RFP_SYNCHRONIZER
);
(proposalGenerationGraph as any).addEdge(
  NODES.RFP_STRUCTURE,
  NODES.RFP_SYNCHRONIZER
);
(proposalGenerationGraph as any).addEdge(
  NODES.RFP_STRATEGIC,
  NODES.RFP_SYNCHRONIZER
);

// Connect synchronizer to synthesis
(proposalGenerationGraph as any).addEdge(
  NODES.RFP_SYNCHRONIZER,
  NODES.RFP_SYNTHESIS
);

// Connect synthesis to HITL review
(proposalGenerationGraph as any).addEdge(
  NODES.RFP_SYNTHESIS,
  NODES.RFP_HITL_REVIEW
);

// Intelligence Formatter and HITL Review Edges
// ============================================

// Formatter goes directly to HITL review
(proposalGenerationGraph as any).addEdge(
  NODES.INTELLIGENCE_FORMATTER,
  NODES.INTELLIGENCE_HITL_REVIEW
);

// ===== PARALLEL INTELLIGENCE GATHERING EDGES =====
// 
// The parallel intelligence system uses LangGraph's Send API to dispatch
// 4 agents in parallel. LangGraph's Bulk Synchronous Parallel (BSP) execution
// model ensures that the synchronizer node only runs AFTER all 4 agents have
// completed their work. This is automatic - we don't need to manually check
// completion status.

// Dispatcher uses Command to route to parallel router
(proposalGenerationGraph as any).addEdge(
  NODES.PARALLEL_INTEL_DISPATCHER,
  NODES.PARALLEL_INTEL_ROUTER
);

// Parallel router dispatches to all 4 agents using Send API
// All agents run concurrently in the same superstep
(proposalGenerationGraph as any).addConditionalEdges(
  NODES.PARALLEL_INTEL_ROUTER,
  parallelIntelligenceRouter
);

// Connect subgraphs to synchronizer
// Each subgraph handles its own ReAct loop internally
// When complete, they route to the synchronizer
(proposalGenerationGraph as any).addEdge(
  PARALLEL_INTELLIGENCE_SUBGRAPH_NODES.STRATEGIC_SUBGRAPH,
  NODES.PARALLEL_INTEL_SYNCHRONIZER
);

(proposalGenerationGraph as any).addEdge(
  PARALLEL_INTELLIGENCE_SUBGRAPH_NODES.VENDOR_SUBGRAPH,
  NODES.PARALLEL_INTEL_SYNCHRONIZER
);

(proposalGenerationGraph as any).addEdge(
  PARALLEL_INTELLIGENCE_SUBGRAPH_NODES.PROCUREMENT_SUBGRAPH,
  NODES.PARALLEL_INTEL_SYNCHRONIZER
);

(proposalGenerationGraph as any).addEdge(
  PARALLEL_INTELLIGENCE_SUBGRAPH_NODES.DECISION_SUBGRAPH,
  NODES.PARALLEL_INTEL_SYNCHRONIZER
);

// The synchronizer acts as a "sink" node in the fan-out/fan-in pattern.
// All 4 agents route to the synchronizer when they complete. LangGraph ensures
// the synchronizer only executes once ALL agents have finished, similar to how
// Promise.all() works. No manual synchronization needed!
(proposalGenerationGraph as any).addEdge(
  NODES.PARALLEL_INTEL_SYNCHRONIZER,
  NODES.INTELLIGENCE_FORMATTER
);

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

    // Compile the graph with checkpointer, interrupt handling, and recursion limit
    compiledGraph = (proposalGenerationGraph as any).compile({
      checkpointer,
      // Configure interrupt handling for nodes that use interrupt() calls
      interruptBefore: [], // Empty since we use interrupt() within nodes, not before nodes
      interruptAfter: [], // Empty since other interrupts are handled differently
      // Set recursion limit to prevent infinite loops
      recursionLimit: 50, // Allows for complex flows while preventing runaway execution
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
