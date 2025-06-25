/**
 * Intelligence Gathering Multi-Agent System
 *
 * Comprehensive intelligence gathering using specialized agents for customer research,
 * synthesis, and human-in-the-loop review with modification and custom research capabilities.
 */

// Core intelligence gathering nodes
export { researchAgent } from "./research-agent.js";
export { intelligenceFormatter } from "./intelligence-formatter.js";
export { intelligenceGatheringRouter } from "./intelligence-router.js";
export { customResearcherNode } from "./custom-researcher.js";
export { intelligenceModificationAgent } from "./modification-agent.js";

// Company info collection nodes
export { companyInfoHitlCollection, companyInfoProcessor } from "./company-info-hitl.js";

// Human-in-the-loop review nodes
export {
  intelligenceGatheringHumanReview,
  intelligenceGatheringFeedbackRouter,
  intelligenceGatheringApprovalHandler,
  intelligenceGatheringRejectionHandler,
  intelligenceGatheringQuestionAnswering,
} from "./hitl-review.js";

/**
 * Node name constants for graph construction
 */
export const INTELLIGENCE_GATHERING_NODES = {
  // Core flow with ToolNode pattern
  RESEARCH_AGENT: "researchAgent",
  TOOLS: "intelligenceTools",
  FORMATTER: "intelligenceFormatter",
  
  // Company info collection
  COMPANY_INFO_HITL: "companyInfoHitlCollection",
  COMPANY_INFO_PROCESSOR: "companyInfoProcessor",

  // HITL review
  HITL_REVIEW: "intelligenceGatheringHumanReview",
  FEEDBACK_ROUTER: "intelligenceGatheringFeedbackRouter",

  // Feedback handling
  MODIFICATION_AGENT: "intelligenceModificationAgent",
  CUSTOM_RESEARCHER: "customResearcherNode",

  // HITL handlers
  APPROVAL: "intelligenceGatheringApprovalHandler",
  REJECTION: "intelligenceGatheringRejectionHandler",
  QA: "intelligenceGatheringQuestionAnswering",
} as const;

// Re-export key types for convenience
export type { OverallProposalState } from "@/state/modules/types.js";
export type { IntelligenceBriefing } from "@/state/modules/types.js";
