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
import { createTopicTools } from "./tools/parallel-intelligence-tools.js";

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

// Intelligence Gathering flow nodes - Multi-agent intelligence system
import {
  researchPlanningNode,
  researchAgent,
  intelligenceFormatter,
  customResearcherNode,
  intelligenceModificationAgent,
  companyInfoHitlCollection,
  companyInfoProcessor,
  intelligenceGatheringHumanReview,
  intelligenceGatheringFeedbackRouter,
  intelligenceGatheringApprovalHandler,
  intelligenceGatheringRejectionHandler,
  intelligenceGatheringQuestionAnswering,
  INTELLIGENCE_GATHERING_NODES,
} from "./nodes/planning/intelligence-gathering/index.js";

// Parallel Intelligence Gathering nodes
import {
  intelligenceDispatcher,
  intelligenceSynchronizer,
  strategicInitiativesAgent,
  vendorRelationshipsAgent,
  procurementPatternsAgent,
  decisionMakersAgent,
  parallelIntelligenceRouter,
  strategicInitiativesShouldContinue,
  vendorRelationshipsShouldContinue,
  procurementPatternsShouldContinue,
  decisionMakersShouldContinue,
  PARALLEL_INTELLIGENCE_NODES,
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

  // Intelligence Gathering Flow - ReAct pattern with ToolNode
  RESEARCH_AGENT: INTELLIGENCE_GATHERING_NODES.RESEARCH_AGENT,
  INTELLIGENCE_TOOLS: INTELLIGENCE_GATHERING_NODES.TOOLS,
  INTELLIGENCE_FORMATTER: INTELLIGENCE_GATHERING_NODES.FORMATTER,
  
  // HITL and processing nodes
  COMPANY_INFO_HITL: INTELLIGENCE_GATHERING_NODES.COMPANY_INFO_HITL,
  COMPANY_INFO_PROCESSOR: INTELLIGENCE_GATHERING_NODES.COMPANY_INFO_PROCESSOR,
  INTELLIGENCE_HITL_REVIEW: INTELLIGENCE_GATHERING_NODES.HITL_REVIEW,
  INTELLIGENCE_FEEDBACK_ROUTER: INTELLIGENCE_GATHERING_NODES.FEEDBACK_ROUTER,
  INTELLIGENCE_MODIFICATION: INTELLIGENCE_GATHERING_NODES.MODIFICATION_AGENT,
  INTELLIGENCE_CUSTOM_RESEARCH: INTELLIGENCE_GATHERING_NODES.CUSTOM_RESEARCHER,
  INTELLIGENCE_APPROVAL: INTELLIGENCE_GATHERING_NODES.APPROVAL,
  INTELLIGENCE_REJECTION: INTELLIGENCE_GATHERING_NODES.REJECTION,
  INTELLIGENCE_QA: INTELLIGENCE_GATHERING_NODES.QA,

  // Legacy RFP Analysis V2 Flow (deprecated)
  LEGACY_RFP_ANALYZER: "rfpAnalyzer",
  LEGACY_HUMAN_REVIEW: "humanReview",
  LEGACY_FEEDBACK_ROUTER: "feedbackRouter",
  LEGACY_APPROVAL_HANDLER: "approvalHandler",
  LEGACY_REJECTION_HANDLER: "rejectionHandler",

  // Future Integration Points (Placeholder for next development phases)
  RESEARCH_PLANNING: "researchPlanning",

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

// Intelligence Gathering System - ReAct Pattern with ToolNode
// ===========================================================

// Research Agent - Makes decisions about what to search
proposalGenerationGraph.addNode(
  NODES.RESEARCH_AGENT,
  researchAgent,
  {
    ends: [NODES.RESEARCH_AGENT, NODES.INTELLIGENCE_TOOLS, NODES.INTELLIGENCE_FORMATTER, NODES.COMPANY_INFO_HITL]
  }
);

// Tool Node - Executes web searches and extractions
const intelligenceToolNode = new ToolNode([
  getIntelligenceSearchTool(),
  getIntelligenceExtractTool()
]);
proposalGenerationGraph.addNode(
  NODES.INTELLIGENCE_TOOLS,
  intelligenceToolNode
);

// Intelligence Formatter - Formats research into human-readable briefing
proposalGenerationGraph.addNode(
  NODES.INTELLIGENCE_FORMATTER,
  intelligenceFormatter
);

// Company Info HITL - Collects missing company/industry information
proposalGenerationGraph.addNode(
  NODES.COMPANY_INFO_HITL,
  companyInfoHitlCollection
);

// Company Info Processor - Processes user response and routes back
proposalGenerationGraph.addNode(
  NODES.COMPANY_INFO_PROCESSOR,
  companyInfoProcessor
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
      NODES.INTELLIGENCE_MODIFICATION,
      NODES.INTELLIGENCE_CUSTOM_RESEARCH,
      NODES.INTELLIGENCE_QA,
      NODES.INTELLIGENCE_REJECTION,
    ],
  }
);

// Intelligence Modification Agent - Handles user feedback modifications
proposalGenerationGraph.addNode(
  NODES.INTELLIGENCE_MODIFICATION,
  intelligenceModificationAgent,
  {
    ends: [NODES.INTELLIGENCE_FORMATTER],
  }
);

// Custom Researcher - Handles additional research requests
proposalGenerationGraph.addNode(
  NODES.INTELLIGENCE_CUSTOM_RESEARCH,
  customResearcherNode,
  {
    ends: [NODES.INTELLIGENCE_FORMATTER],
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

// Intelligence Approval Handler - Proceed to team assembly
proposalGenerationGraph.addNode(
  NODES.INTELLIGENCE_APPROVAL,
  intelligenceGatheringApprovalHandler,
  {
    ends: [NODES.COMPLETE], // TODO: Replace with team assembly node when implemented
  }
);

// Intelligence Rejection Handler - Return to intelligence gathering
proposalGenerationGraph.addNode(
  NODES.INTELLIGENCE_REJECTION,
  intelligenceGatheringRejectionHandler,
  {
    ends: [NODES.RESEARCH_AGENT],
  }
);

// Research Planning - Entry point to intelligence gathering (kept for backward compatibility)
proposalGenerationGraph.addNode(
  NODES.RESEARCH_PLANNING,
  researchPlanningNode,
  {
    ends: [NODES.RESEARCH_AGENT]
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

// Strategic Initiatives Agent and Tools
proposalGenerationGraph.addNode(
  NODES.PARALLEL_STRATEGIC_AGENT,
  strategicInitiativesAgent
);
const strategicTools = createTopicTools("strategic_initiatives");
console.log("[Graph Setup] Strategic Tools:", strategicTools.map(t => ({ name: t.name, description: t.description })));
const strategicToolNode = new ToolNode(strategicTools);
proposalGenerationGraph.addNode(
  NODES.PARALLEL_STRATEGIC_TOOLS,
  strategicToolNode
);

// Vendor Relationships Agent and Tools
proposalGenerationGraph.addNode(
  NODES.PARALLEL_VENDOR_AGENT,
  vendorRelationshipsAgent
);
const vendorTools = createTopicTools("vendor_relationships");
const vendorToolNode = new ToolNode(vendorTools);
proposalGenerationGraph.addNode(
  NODES.PARALLEL_VENDOR_TOOLS,
  vendorToolNode
);

// Procurement Patterns Agent and Tools
proposalGenerationGraph.addNode(
  NODES.PARALLEL_PROCUREMENT_AGENT,
  procurementPatternsAgent
);
const procurementTools = createTopicTools("procurement_patterns");
const procurementToolNode = new ToolNode(procurementTools);
proposalGenerationGraph.addNode(
  NODES.PARALLEL_PROCUREMENT_TOOLS,
  procurementToolNode
);

// Decision Makers Agent and Tools
proposalGenerationGraph.addNode(
  NODES.PARALLEL_DECISION_AGENT,
  decisionMakersAgent
);
const decisionTools = createTopicTools("decision_makers");
console.log("[Graph Setup] Decision Makers Tools:", decisionTools.map(t => ({ name: t.name, description: t.description })));
const decisionToolNode = new ToolNode(decisionTools);
proposalGenerationGraph.addNode(
  NODES.PARALLEL_DECISION_TOOLS,
  decisionToolNode
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

// Intelligence Gathering Flow Edges
// =================================

// Company info collection edges (when missing company/industry)
(proposalGenerationGraph as any).addEdge(
  NODES.COMPANY_INFO_HITL,
  NODES.COMPANY_INFO_PROCESSOR
);

// Company info processor returns to research agent
(proposalGenerationGraph as any).addEdge(
  NODES.COMPANY_INFO_PROCESSOR,
  NODES.RESEARCH_AGENT
);

// Intelligence Gathering Flow - Using Command Pattern
// Research agent uses Command with goto for explicit routing
// No conditional edges needed - agent handles its own routing

// Tools always return to research agent
(proposalGenerationGraph as any).addEdge(
  NODES.INTELLIGENCE_TOOLS,
  NODES.RESEARCH_AGENT
);

// Formatter goes directly to HITL review (synthesis is redundant)
(proposalGenerationGraph as any).addEdge(
  NODES.INTELLIGENCE_FORMATTER,
  NODES.INTELLIGENCE_HITL_REVIEW
);

// V2 Chat flow - Clean routing without recursion
// All routing decisions are handled within nodes using Command pattern
// No conditional edges needed for chat flow - nodes handle their own routing

// Document loader now uses Command pattern for routing - no conditional edges needed

// No direct edge needed - RFP Analyzer routes through the multi-agent flow

// Research Planning now uses Command pattern for routing - no edges needed

// ===== PARALLEL INTELLIGENCE GATHERING EDGES =====

// Dispatcher uses Command to route to parallel router
(proposalGenerationGraph as any).addEdge(
  NODES.PARALLEL_INTEL_DISPATCHER,
  NODES.PARALLEL_INTEL_ROUTER
);

// Parallel router dispatches to all 4 agents
(proposalGenerationGraph as any).addConditionalEdges(
  NODES.PARALLEL_INTEL_ROUTER,
  parallelIntelligenceRouter
);

// Strategic Initiatives ReAct Loop
(proposalGenerationGraph as any).addConditionalEdges(
  NODES.PARALLEL_STRATEGIC_AGENT,
  strategicInitiativesShouldContinue,
  {
    [NODES.PARALLEL_STRATEGIC_TOOLS]: NODES.PARALLEL_STRATEGIC_TOOLS,
    [NODES.PARALLEL_INTEL_SYNCHRONIZER]: NODES.PARALLEL_INTEL_SYNCHRONIZER
  }
);
(proposalGenerationGraph as any).addEdge(
  NODES.PARALLEL_STRATEGIC_TOOLS,
  NODES.PARALLEL_STRATEGIC_AGENT
);

// Vendor Relationships ReAct Loop
(proposalGenerationGraph as any).addConditionalEdges(
  NODES.PARALLEL_VENDOR_AGENT,
  vendorRelationshipsShouldContinue,
  {
    [NODES.PARALLEL_VENDOR_TOOLS]: NODES.PARALLEL_VENDOR_TOOLS,
    [NODES.PARALLEL_INTEL_SYNCHRONIZER]: NODES.PARALLEL_INTEL_SYNCHRONIZER
  }
);
(proposalGenerationGraph as any).addEdge(
  NODES.PARALLEL_VENDOR_TOOLS,
  NODES.PARALLEL_VENDOR_AGENT
);

// Procurement Patterns ReAct Loop
(proposalGenerationGraph as any).addConditionalEdges(
  NODES.PARALLEL_PROCUREMENT_AGENT,
  procurementPatternsShouldContinue,
  {
    [NODES.PARALLEL_PROCUREMENT_TOOLS]: NODES.PARALLEL_PROCUREMENT_TOOLS,
    [NODES.PARALLEL_INTEL_SYNCHRONIZER]: NODES.PARALLEL_INTEL_SYNCHRONIZER
  }
);
(proposalGenerationGraph as any).addEdge(
  NODES.PARALLEL_PROCUREMENT_TOOLS,
  NODES.PARALLEL_PROCUREMENT_AGENT
);

// Decision Makers ReAct Loop
(proposalGenerationGraph as any).addConditionalEdges(
  NODES.PARALLEL_DECISION_AGENT,
  decisionMakersShouldContinue,
  {
    [NODES.PARALLEL_DECISION_TOOLS]: NODES.PARALLEL_DECISION_TOOLS,
    [NODES.PARALLEL_INTEL_SYNCHRONIZER]: NODES.PARALLEL_INTEL_SYNCHRONIZER
  }
);
(proposalGenerationGraph as any).addEdge(
  NODES.PARALLEL_DECISION_TOOLS,
  NODES.PARALLEL_DECISION_AGENT
);

// Synchronizer routes to formatter (reusing existing formatter)
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
