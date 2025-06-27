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
 * Supports retry logic for failed agents
 */
export function parallelAnalysisRouter(
  state: typeof OverallProposalStateAnnotation.State
): Send[] {
  const { rfpAnalysisRetryAgents } = state;
  
  // Check if we're in retry mode
  if (rfpAnalysisRetryAgents && rfpAnalysisRetryAgents.length > 0) {
    console.log(`[RFP Parallel Router] Retry mode - dispatching to ${rfpAnalysisRetryAgents.length} failed agents`);
    
    // Map retry agent names to node names
    const agentNodeMap: Record<string, string> = {
      linguisticPatterns: RFP_ANALYSIS_NODES.LINGUISTIC,
      requirementsExtraction: RFP_ANALYSIS_NODES.REQUIREMENTS,
      documentStructure: RFP_ANALYSIS_NODES.STRUCTURE,
      strategicSignals: RFP_ANALYSIS_NODES.STRATEGIC,
    };
    
    // Create Send commands only for agents that need retry
    const sends = rfpAnalysisRetryAgents
      .map(agentName => {
        const nodeName = agentNodeMap[agentName];
        if (nodeName) {
          console.log(`[RFP Parallel Router] Retrying agent: ${agentName} -> ${nodeName}`);
          return new Send(nodeName, state);
        }
        console.warn(`[RFP Parallel Router] Unknown agent name for retry: ${agentName}`);
        return null;
      })
      .filter(Boolean) as Send[];
    
    console.log(`[RFP Parallel Router] Created ${sends.length} Send commands for retry`);
    return sends;
  }
  
  // Normal mode - dispatch to all agents
  console.log("[RFP Parallel Router] Normal mode - dispatching to all 4 analysis agents");

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