/**
 * Intelligence Gathering Multi-Agent System
 *
 * Comprehensive intelligence gathering using specialized agents for customer research,
 * synthesis, and human-in-the-loop review with modification and custom research capabilities.
 */

// Core intelligence gathering nodes
export { intelligenceGatheringAgent } from "./intelligence-agent.js";
export { intelligenceGatheringSynthesis } from "./synthesis.js";
export { customResearcherNode } from "./custom-researcher.js";
export { intelligenceModificationAgent } from "./modification-agent.js";

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
  // Core flow
  INTELLIGENCE_AGENT: "intelligenceGatheringAgent",

  // Synthesis and review
  SYNTHESIS: "intelligenceGatheringSynthesis",
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
