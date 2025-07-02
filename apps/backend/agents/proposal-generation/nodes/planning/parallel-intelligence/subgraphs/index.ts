/**
 * Subgraphs Index
 * 
 * Exports all subgraph wrapper nodes for use in the main graph.
 * Each wrapper node invokes an isolated subgraph with its own message handling.
 */

// Export wrapper nodes (these are what the main graph uses)
export { vendorRelationshipsSubgraphNode } from "./vendor-relationships.js";
export { strategicInitiativesSubgraphNode } from "./strategic-initiatives.js";
export { procurementPatternsSubgraphNode } from "./procurement-patterns.js";
export { decisionMakersSubgraphNode } from "./decision-makers.js";

// Export the compiled subgraphs themselves (for testing or direct invocation)
export { vendorRelationshipsSubgraph } from "./vendor-relationships.js";
export { strategicInitiativesSubgraph } from "./strategic-initiatives.js";
export { procurementPatternsSubgraph } from "./procurement-patterns.js";
export { decisionMakersSubgraph } from "./decision-makers.js";

// Node names for the wrapper nodes in the main graph
export const PARALLEL_INTELLIGENCE_SUBGRAPH_NODES = {
  VENDOR_SUBGRAPH: "vendorRelationshipsSubgraphNode",
  STRATEGIC_SUBGRAPH: "strategicInitiativesSubgraphNode",
  PROCUREMENT_SUBGRAPH: "procurementPatternsSubgraphNode",
  DECISION_SUBGRAPH: "decisionMakersSubgraphNode",
} as const;