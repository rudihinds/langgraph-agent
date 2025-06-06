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

import { StateGraph, END, START } from "@langchain/langgraph";
import { ProcessingStatus } from "../../state/modules/constants.js";
import { OverallProposalStateAnnotation } from "../../state/modules/annotations.js";
import { getInitializedCheckpointer } from "../../lib/persistence/robust-checkpointer.js";

// Core infrastructure nodes (retained)
import { documentLoaderNode } from "./nodes.js";
import { chatAgentNode, shouldContinueChat } from "./nodes/chatAgent.js";
import { processToolsNode } from "./nodes/toolProcessor.js";

// New RFP Analysis flow nodes
import {
  rfpAnalyzerNode,
  userFeedbackProcessor,
  strategicOptionsRefinement,
  routeAfterRfpAnalysis,
  strategicValidationCheckpoint,
  routeAfterFeedbackProcessing,
  routeAfterStrategicValidation,
  routeAfterStrategicRefinement,
} from "./nodes/planning/rfp-analysis/index.js";

// Define node name constants for type safety and clarity
const NODES = {
  // Core Infrastructure Nodes (Retained)
  CHAT_AGENT: "chatAgent",
  CHAT_TOOLS: "chatTools",
  DOC_LOADER: "documentLoader",

  // New RFP Analysis Collaboration Flow
  RFP_ANALYZER: "rfpAnalyzer",
  STRATEGIC_VALIDATION_CHECKPOINT: "strategicValidationCheckpoint",
  USER_FEEDBACK_PROCESSOR: "userFeedbackProcessor",
  STRATEGIC_OPTIONS_REFINEMENT: "strategicOptionsRefinement",

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

// Chat Agent - Entry point for user interaction
proposalGenerationGraph.addNode(NODES.CHAT_AGENT, chatAgentNode, {
  ends: [NODES.CHAT_TOOLS, NODES.DOC_LOADER, END],
});

// Chat Tools - Handle tool calls from chat agent
proposalGenerationGraph.addNode(NODES.CHAT_TOOLS, processToolsNode, {
  ends: [NODES.CHAT_AGENT],
});

// Document Loader - Process uploaded RFP documents
proposalGenerationGraph.addNode(NODES.DOC_LOADER, documentLoaderNode, {
  ends: [NODES.RFP_ANALYZER],
});

// RFP Analyzer - Deep analysis with strategic insights and risk assessment
proposalGenerationGraph.addNode(NODES.RFP_ANALYZER, rfpAnalyzerNode, {
  ends: [NODES.STRATEGIC_VALIDATION_CHECKPOINT, NODES.COMPLETE],
});

// Strategic Validation Checkpoint - User collaboration interface with rich analysis presentation
proposalGenerationGraph.addNode(
  NODES.STRATEGIC_VALIDATION_CHECKPOINT,
  strategicValidationCheckpoint,
  {
    ends: [
      NODES.USER_FEEDBACK_PROCESSOR,
      NODES.RESEARCH_PLANNING,
      NODES.COMPLETE,
    ],
  }
);

// User Feedback Processor - Intelligent interpretation of user feedback
proposalGenerationGraph.addNode(
  NODES.USER_FEEDBACK_PROCESSOR,
  userFeedbackProcessor,
  {
    ends: [
      NODES.STRATEGIC_OPTIONS_REFINEMENT,
      NODES.STRATEGIC_VALIDATION_CHECKPOINT,
      NODES.RFP_ANALYZER, // For restart scenarios
      NODES.COMPLETE,
    ],
  }
);

// Strategic Options Refinement - Apply changes based on user feedback
proposalGenerationGraph.addNode(
  NODES.STRATEGIC_OPTIONS_REFINEMENT,
  strategicOptionsRefinement,
  {
    ends: [NODES.STRATEGIC_VALIDATION_CHECKPOINT],
  }
);

// Research Planning - Prepare for next development phase (placeholder)
proposalGenerationGraph.addNode(
  NODES.RESEARCH_PLANNING,
  async (state: typeof OverallProposalStateAnnotation.State) => {
    // Placeholder for future research planning agent
    console.log(
      "Research Planning phase - to be implemented in next development phase"
    );
    return {
      status: ProcessingStatus.COMPLETE,
      currentPhase: "complete" as const,
    };
  },
  {
    ends: [NODES.COMPLETE],
  }
);

// Complete - Final state
proposalGenerationGraph.addNode(
  NODES.COMPLETE,
  async (state: typeof OverallProposalStateAnnotation.State) => {
    return {
      status: ProcessingStatus.COMPLETE,
      currentPhase: "complete" as const,
    };
  }
);

// --------------------------------------------------------------------------------
// Edge Definitions with Conditional Routing
// --------------------------------------------------------------------------------

// Entry point
(proposalGenerationGraph as any).addEdge(START, NODES.CHAT_AGENT);

// Chat flow edges
(proposalGenerationGraph as any).addEdge(NODES.CHAT_TOOLS, NODES.CHAT_AGENT);

// Conditional routing from chat agent
(proposalGenerationGraph as any).addConditionalEdges(
  NODES.CHAT_AGENT,
  shouldContinueChat,
  {
    chatTools: NODES.CHAT_TOOLS,
    loadDocument: NODES.DOC_LOADER,
    answerQuestion: NODES.CHAT_AGENT, // Continue conversation
    __end__: END,
  } as Record<string, NodeName | string>
);

// Document processing flow
(proposalGenerationGraph as any).addEdge(NODES.DOC_LOADER, NODES.RFP_ANALYZER);

// RFP Analysis conditional routing
(proposalGenerationGraph as any).addConditionalEdges(
  NODES.RFP_ANALYZER,
  routeAfterRfpAnalysis,
  {
    strategic_validation: NODES.STRATEGIC_VALIDATION_CHECKPOINT,
    complete: NODES.COMPLETE,
    error: NODES.COMPLETE,
  }
);

// Strategic Validation Checkpoint conditional routing
(proposalGenerationGraph as any).addConditionalEdges(
  NODES.STRATEGIC_VALIDATION_CHECKPOINT,
  routeAfterStrategicValidation,
  {
    process_feedback: NODES.USER_FEEDBACK_PROCESSOR,
    approved: NODES.RESEARCH_PLANNING,
    complete: NODES.COMPLETE,
  }
);

// User Feedback Processor conditional routing
(proposalGenerationGraph as any).addConditionalEdges(
  NODES.USER_FEEDBACK_PROCESSOR,
  routeAfterFeedbackProcessing,
  {
    analysis_refinement: NODES.STRATEGIC_OPTIONS_REFINEMENT,
    strategic_validation: NODES.STRATEGIC_VALIDATION_CHECKPOINT,
    restart_analysis: NODES.RFP_ANALYZER,
    complete: NODES.COMPLETE,
  }
);

// Strategic Options Refinement routing
(proposalGenerationGraph as any).addConditionalEdges(
  NODES.STRATEGIC_OPTIONS_REFINEMENT,
  routeAfterStrategicRefinement,
  {
    strategic_validation: NODES.STRATEGIC_VALIDATION_CHECKPOINT,
    complete: NODES.COMPLETE,
  }
);

// Research Planning routing (placeholder)
(proposalGenerationGraph as any).addEdge(
  NODES.RESEARCH_PLANNING,
  NODES.COMPLETE
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

    // Compile the graph with checkpointer
    compiledGraph = (proposalGenerationGraph as any).compile({
      checkpointer,
      // Enable interrupts for human-in-the-loop functionality
      interruptBefore: [
        NODES.STRATEGIC_VALIDATION_CHECKPOINT,
        NODES.USER_FEEDBACK_PROCESSOR,
      ],
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
