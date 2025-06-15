/**
 * RFP Analysis HITL Review Nodes
 * 
 * Human-in-the-loop review nodes for RFP analysis results using the reusable
 * HITL utilities for natural conversation flow.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { interrupt } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { ProcessingStatus } from "@/state/modules/types.js";
import {
  createHumanReviewNode,
  createFeedbackRouterNode,
  createApprovalNode,
  createRejectionNode
} from "@/lib/langgraph/common/hitl-nodes.js";

// Initialize LLM for HITL interactions
const model = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.3,
  maxTokens: 4000,
});

/**
 * Human Review Node for RFP Analysis Results
 * Uses reusable HITL utility with RFP-specific configuration
 */
export const rfpAnalysisHumanReview = createHumanReviewNode<typeof OverallProposalStateAnnotation.State>({
  nodeName: "rfpAnalysisHumanReview",
  llm: model,
  interruptType: "rfp_analysis_review",
  reviewPromptTemplate: `Generate a professional, contextual question asking the user to review the comprehensive RFP analysis results. 
    Reference the synthesis findings and ask for their feedback on the strategic recommendations. 
    Keep the tone collaborative and focused on validating the analysis before proceeding to proposal development.`,
  options: ["approve", "modify", "reject"],
  nextNode: "rfpAnalysisFeedbackRouter"
});

/**
 * Feedback Router for RFP Analysis Review
 * Routes user feedback to appropriate handlers
 */
export const rfpAnalysisFeedbackRouter = createFeedbackRouterNode<typeof OverallProposalStateAnnotation.State>({
  nodeName: "rfpAnalysisFeedbackRouter",
  llm: model,
  intentPrompt: `You are analyzing user feedback about comprehensive RFP analysis results including linguistic patterns, requirements extraction, document structure, and strategic signals.
    
    Determine if they want to:
    - approve: They're satisfied with the analysis and ready to proceed to proposal development
    - modify: They want adjustments to the analysis or synthesis 
    - reject: They want to restart the analysis with different parameters
    
    Respond naturally acknowledging their feedback about the RFP analysis.`,
  routingMap: {
    "approve": "rfpAnalysisApprovalHandler",
    "modify": "rfpAnalysisDispatcher", // Back to dispatcher for re-analysis
    "reject": "rfpAnalysisRejectionHandler"
  },
  defaultRoute: "rfpAnalysisDispatcher"
});

/**
 * Approval Handler for RFP Analysis
 * Confirms approval and routes to next phase of proposal generation
 */
export const rfpAnalysisApprovalHandler = createApprovalNode<typeof OverallProposalStateAnnotation.State>({
  nodeName: "rfpAnalysisApprovalHandler",
  llm: model,
  responsePrompt: `Generate an enthusiastic, professional confirmation that the comprehensive RFP analysis has been approved.
    Reference the key strategic insights discovered and express readiness to begin the proposal development phase.
    Mention that the analysis will guide strategy throughout proposal creation. Keep it concise and forward-looking.`,
  nextNode: "researchPlanning", // Continue to next phase of proposal generation
  stateUpdates: {
    rfpProcessingStatus: ProcessingStatus.COMPLETE,
    isAnalyzingRfp: false,
    currentStatus: "RFP analysis approved - proceeding to proposal development"
  }
});

/**
 * Rejection Handler for RFP Analysis
 * Handles rejection and offers to restart with refined approach
 */
export const rfpAnalysisRejectionHandler = createRejectionNode<typeof OverallProposalStateAnnotation.State>({
  nodeName: "rfpAnalysisRejectionHandler", 
  llm: model,
  responsePrompt: `Generate a professional, understanding response acknowledging that the user wants to restart the RFP analysis.
    Ask what specific aspects they'd like to focus on or approach differently in the new analysis.
    Mention that we can adjust the analysis parameters or focus areas. Keep it supportive and solution-oriented.`,
  nextNode: "rfpAnalysisDispatcher", // Back to dispatcher for fresh analysis
  stateUpdates: {
    // Clear previous analysis results for fresh start
    linguisticAnalysis: undefined,
    requirementsAnalysis: undefined,
    structureAnalysis: undefined,
    strategicAnalysis: undefined,
    synthesisAnalysis: undefined,
    rfpAnalysisOutput: undefined,
    rfpProcessingStatus: ProcessingStatus.QUEUED,
    currentStatus: "Restarting RFP analysis with refined approach"
  }
});

/**
 * Custom HITL Review Node with RFP-specific interrupt payload
 * Alternative implementation with richer interrupt data
 */
export function rfpAnalysisHitlReviewCustom(
  state: typeof OverallProposalStateAnnotation.State
): {
  rfpHumanReview?: {
    action: "approve" | "modify" | "reject";
    feedback?: string;
    timestamp: string;
  };
  currentStatus?: string;
} {
  console.log("[RFP Analysis HITL] Preparing human review");

  // Prepare comprehensive review package
  const reviewPackage = {
    synthesis: state.synthesisAnalysis,
    analyses: {
      linguistic: state.linguisticAnalysis,
      requirements: state.requirementsAnalysis,
      structure: state.structureAnalysis,
      strategic: state.strategicAnalysis
    },
    documentMetadata: state.documentMetadata,
    analysisId: state.rfpAnalysisId,
    timestamp: new Date().toISOString()
  };

  // Interrupt for human review with rich payload
  const userInput = interrupt({
    type: "rfp_analysis_review",
    question: "Please review the comprehensive RFP analysis results. The analysis includes linguistic patterns, requirements extraction, document structure analysis, and strategic signals synthesis. Do you approve these findings and strategic recommendations?",
    data: reviewPackage,
    options: ["approve", "modify", "reject"],
    metadata: {
      analysisId: state.rfpAnalysisId,
      documentComplexity: state.documentMetadata?.complexity,
      analysisTimestamp: new Date().toISOString()
    }
  });

  // Process user input
  const reviewData = {
    action: userInput.action || "modify",
    feedback: userInput.feedback,
    timestamp: new Date().toISOString()
  };

  return {
    rfpHumanReview: reviewData,
    currentStatus: `Human review ${reviewData.action} - processing feedback`
  };
}

/**
 * Router function for RFP Analysis HITL Review
 */
export function rfpAnalysisHitlRouter(state: typeof OverallProposalStateAnnotation.State): string {
  if (!state.rfpHumanReview) {
    return "rfpAnalysisHitlReviewCustom";
  }

  const review = state.rfpHumanReview;
  
  switch (review.action) {
    case "approve":
      return "rfpAnalysisApprovalHandler";
    case "modify":
      return "rfpAnalysisDispatcher"; // Re-run analysis with feedback
    case "reject":
      return "rfpAnalysisRejectionHandler";
    default:
      return "rfpAnalysisDispatcher";
  }
}