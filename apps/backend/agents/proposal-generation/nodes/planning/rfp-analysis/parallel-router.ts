/**
 * Parallel Router for RFP Analysis
 * 
 * This router function dispatches to all 4 RFP analysis agents in parallel
 * using LangGraph's Send API for map-reduce pattern execution.
 */

import { Send } from "@langchain/langgraph";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { RFP_ANALYSIS_NODES } from "./index.js";

/**
 * Router function that dispatches to all 4 RFP analysis agents in parallel
 * Returns Send commands for parallel execution
 */
export function parallelAnalysisRouter(
  state: typeof OverallProposalStateAnnotation.State
): Send[] {
  console.log("[RFP Parallel Router] Dispatching to 4 analysis agents");

  // Create Send commands to dispatch to all 4 agents in parallel
  const sends = [
    new Send(RFP_ANALYSIS_NODES.LINGUISTIC, state),
    new Send(RFP_ANALYSIS_NODES.REQUIREMENTS, state), 
    new Send(RFP_ANALYSIS_NODES.STRUCTURE, state),
    new Send(RFP_ANALYSIS_NODES.STRATEGIC, state)
  ];

  console.log(`[RFP Parallel Router] Created ${sends.length} Send commands for parallel execution`);

  return sends;
}