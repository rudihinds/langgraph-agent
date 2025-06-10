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

// New RFP Analysis flow nodes - V2 LangGraph-native implementation
import {
  rfpAnalyzer,
  humanReview,
  feedbackRouter,
  approvalHandler,
  rejectionHandler,
} from "./nodes/planning/rfp-analysis/rfp_analyzer_v2.js";

// Define node name constants for type safety and clarity
const NODES = {
  // V3 Chat Flow (Pure multi-agent pattern)
  CHAT_AGENT: "chatAgent",
  DOC_LOADER: "documentLoader",

  // New RFP Analysis V2 Flow
  RFP_ANALYZER: "rfpAnalyzer",
  HUMAN_REVIEW: "humanReview",
  FEEDBACK_ROUTER: "feedbackRouter",
  APPROVAL_HANDLER: "approvalHandler",
  REJECTION_HANDLER: "rejectionHandler",

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
    NODES.RFP_ANALYZER,
    END,
  ],
});

// Document Loader - Process uploaded RFP documents
proposalGenerationGraph.addNode(NODES.DOC_LOADER, documentLoaderNode, {
  ends: [NODES.RFP_ANALYZER, NODES.CHAT_AGENT],
});

// RFP Analyzer V2 - LangGraph-native multi-agent flow
proposalGenerationGraph.addNode(NODES.RFP_ANALYZER, rfpAnalyzer, {
  ends: [NODES.HUMAN_REVIEW, END],
});

// Human Review - Collect user feedback
proposalGenerationGraph.addNode(NODES.HUMAN_REVIEW, humanReview, {
  ends: [NODES.FEEDBACK_ROUTER],
});

// Feedback Router - Interpret user intent
proposalGenerationGraph.addNode(NODES.FEEDBACK_ROUTER, feedbackRouter, {
  ends: [NODES.RFP_ANALYZER, NODES.APPROVAL_HANDLER, NODES.REJECTION_HANDLER],
});

// Approval Handler - Proceed to next phase
proposalGenerationGraph.addNode(NODES.APPROVAL_HANDLER, approvalHandler, {
  ends: [NODES.RESEARCH_PLANNING],
});

// Rejection Handler - Start fresh
proposalGenerationGraph.addNode(NODES.REJECTION_HANDLER, rejectionHandler, {
  ends: [NODES.RFP_ANALYZER],
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
