/**
 * Parallel Intelligence Gathering System
 * 
 * Exports all nodes for the parallel intelligence gathering implementation.
 * This system runs 4 topic-specific agents in parallel, each with their own
 * ReAct loop and 3 specialized tools (discovery, extraction, deep-dive).
 */

// Main dispatcher and synchronizer
export { intelligenceDispatcher } from "./intelligence-dispatcher.js";
export { intelligenceSynchronizer } from "./intelligence-synchronizer.js";

// Topic-specific agents
export { strategicInitiativesAgent } from "./strategic-initiatives-agent.js";
export { vendorRelationshipsAgent } from "./vendor-relationships-agent.js";
export { procurementPatternsAgent } from "./procurement-patterns-agent.js";
export { decisionMakersAgent } from "./decision-makers-agent.js";

// Router functions
export {
  parallelIntelligenceRouter,
  strategicInitiativesShouldContinue,
  vendorRelationshipsShouldContinue,
  procurementPatternsShouldContinue,
  decisionMakersShouldContinue,
} from "./routers.js";

// Node name constants
export const PARALLEL_INTELLIGENCE_NODES = {
  // Main orchestration
  DISPATCHER: "parallelIntelligenceDispatcher",
  SYNCHRONIZER: "parallelIntelligenceSynchronizer",
  
  // Strategic Initiatives
  STRATEGIC_AGENT: "strategicInitiativesAgent",
  STRATEGIC_TOOLS: "strategicInitiativesTools",
  
  // Vendor Relationships
  VENDOR_AGENT: "vendorRelationshipsAgent",
  VENDOR_TOOLS: "vendorRelationshipsTools",
  
  // Procurement Patterns
  PROCUREMENT_AGENT: "procurementPatternsAgent",
  PROCUREMENT_TOOLS: "procurementPatternsTools",
  
  // Decision Makers
  DECISION_AGENT: "decisionMakersAgent",
  DECISION_TOOLS: "decisionMakersTools",
} as const;

// Re-export types
export type { TopicResearch, TopicState } from "./types.js";