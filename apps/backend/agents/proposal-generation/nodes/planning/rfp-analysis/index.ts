/**
 * RFP Analysis Multi-Agent System
 * 
 * Comprehensive RFP analysis using 4 specialized agents plus synthesis and HITL review.
 * Replaces the simple rfp_analyzer_v2.ts with sophisticated competitive intelligence.
 */

// Legacy V2 nodes (deprecated - use multi-agent system below)
export {
  rfpAnalyzer,
  humanReview,
  feedbackRouter,
  approvalHandler,
  rejectionHandler
} from "./rfp_analyzer_v2.js";

// Core analysis nodes
export { parallelDispatcherNode } from "./parallel-dispatcher.js";
export { parallelAnalysisRouter } from "./parallel-router.js";

// Individual analysis agents
export { linguisticPatternsNode } from "./linguistic-patterns.js";
export { requirementsExtractionNode } from "./requirements-extraction.js";
export { documentStructureNode } from "./document-structure.js";
export { strategicSignalsNode } from "./strategic-signals.js";

// Synthesis and integration
export { synthesisNode } from "./synthesis.js";

// Human-in-the-loop review
export {
  rfpAnalysisHumanReview,
  rfpAnalysisFeedbackRouter,
  rfpAnalysisApprovalHandler,
  rfpAnalysisRejectionHandler,
  rfpAnalysisQuestionAnswering,
  rfpAnalysisHitlReviewCustom,
  rfpAnalysisHitlRouter
} from "./hitl-review.js";

/**
 * Node name constants for graph construction
 */
export const RFP_ANALYSIS_NODES = {
  // Core flow
  DISPATCHER: "rfpAnalysisDispatcher",
  
  // Parallel analysis agents
  LINGUISTIC: "rfpLinguisticPatterns",
  REQUIREMENTS: "rfpRequirementsExtraction", 
  STRUCTURE: "rfpDocumentStructure",
  STRATEGIC: "rfpStrategicSignals",
  
  // Synthesis and review
  SYNTHESIS: "rfpAnalysisSynthesis",
  HITL_REVIEW: "rfpAnalysisHumanReview",
  FEEDBACK_ROUTER: "rfpAnalysisFeedbackRouter",
  QUESTION_ANSWERING: "rfpAnalysisQuestionAnswering",
  
  // Handlers
  APPROVAL: "rfpAnalysisApprovalHandler",
  REJECTION: "rfpAnalysisRejectionHandler"
} as const;

// Re-export key types for convenience
export type { OverallProposalState } from "@/state/modules/types.js";
