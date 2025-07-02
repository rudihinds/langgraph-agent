/**
 * Router functions for the parallel intelligence gathering system
 */

import { Send } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { PARALLEL_INTELLIGENCE_NODES, PARALLEL_INTELLIGENCE_SUBGRAPH_NODES } from "./index.js";

/**
 * Parallel Intelligence Router
 * 
 * Returns Send commands to dispatch all 4 agents in parallel.
 * This is called after the dispatcher has initialized state.
 */
export function parallelIntelligenceRouter(
  state: typeof OverallProposalStateAnnotation.State
): Send[] {
  console.log("[Parallel Intelligence Router] Dispatching 4 subgraphs in parallel");
  console.log(`[Parallel Intelligence Router] Company: "${state.company}", Industry: "${state.industry}"`);
  console.log(`[Parallel Intelligence Router] RFP Document exists: ${!!state.rfpDocument}`);
  console.log(`[Parallel Intelligence Router] State keys:`, Object.keys(state));
  
  // Validation - ensure we have required data
  if (!state.company || !state.industry) {
    console.error("[Parallel Intelligence Router] ❌ Missing company or industry data!", {
      company: state.company,
      industry: state.industry,
      hasRfpDocument: !!state.rfpDocument
    });
  }
  
  // Return Send commands for all 4 subgraph wrapper nodes
  // Each subgraph has its own isolated message handling
  return [
    new Send(PARALLEL_INTELLIGENCE_SUBGRAPH_NODES.STRATEGIC_SUBGRAPH, state),
    new Send(PARALLEL_INTELLIGENCE_SUBGRAPH_NODES.VENDOR_SUBGRAPH, state),
    new Send(PARALLEL_INTELLIGENCE_SUBGRAPH_NODES.PROCUREMENT_SUBGRAPH, state),
    new Send(PARALLEL_INTELLIGENCE_SUBGRAPH_NODES.DECISION_SUBGRAPH, state),
  ];
}

/**
 * Strategic Initiatives Should Continue Router
 * 
 * Determines if the strategic initiatives agent should continue or sync.
 */
export function strategicInitiativesShouldContinue(
  state: typeof OverallProposalStateAnnotation.State
): "strategicInitiativesTools" | "parallelIntelligenceSynchronizer" {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];
  
  // Check tool calls first (mandatory ReAct pattern)
  if (lastMessage && 'tool_calls' in lastMessage && (lastMessage as AIMessage).tool_calls?.length > 0) {
    const toolCalls = (lastMessage as AIMessage).tool_calls;
    console.log(`[Strategic Router] Agent made ${toolCalls.length} tool calls:`, 
      toolCalls.map((tc: any) => ({ name: tc.name, id: tc.id }))
    );
    return PARALLEL_INTELLIGENCE_NODES.STRATEGIC_TOOLS;
  }
  
  // No tool calls - agent is done, route to synchronizer
  console.log(`[Strategic Router] No tool calls - routing to synchronizer`);
  return PARALLEL_INTELLIGENCE_NODES.SYNCHRONIZER;
}

/**
 * Vendor Relationships Should Continue Router
 */
export function vendorRelationshipsShouldContinue(
  state: typeof OverallProposalStateAnnotation.State
): "vendorRelationshipsTools" | "parallelIntelligenceSynchronizer" {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];
  
  // Check tool calls first (mandatory ReAct pattern)
  if (lastMessage && 'tool_calls' in lastMessage && (lastMessage as AIMessage).tool_calls?.length > 0) {
    const toolCalls = (lastMessage as AIMessage).tool_calls;
    console.log(`[Vendor Router] Agent made ${toolCalls.length} tool calls:`, 
      toolCalls.map((tc: any) => ({ name: tc.name, id: tc.id }))
    );
    return PARALLEL_INTELLIGENCE_NODES.VENDOR_TOOLS;
  }
  
  // No tool calls - agent is done, route to synchronizer
  console.log(`[Vendor Router] No tool calls - routing to synchronizer`);
  return PARALLEL_INTELLIGENCE_NODES.SYNCHRONIZER;
}

/**
 * Procurement Patterns Should Continue Router
 */
export function procurementPatternsShouldContinue(
  state: typeof OverallProposalStateAnnotation.State
): "procurementPatternsTools" | "parallelIntelligenceSynchronizer" {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];
  
  // Check tool calls first (mandatory ReAct pattern)
  if (lastMessage && 'tool_calls' in lastMessage && (lastMessage as AIMessage).tool_calls?.length > 0) {
    const toolCalls = (lastMessage as AIMessage).tool_calls;
    console.log(`[Procurement Router] Agent made ${toolCalls.length} tool calls:`, 
      toolCalls.map((tc: any) => ({ name: tc.name, id: tc.id }))
    );
    return PARALLEL_INTELLIGENCE_NODES.PROCUREMENT_TOOLS;
  }
  
  // No tool calls - agent is done, route to synchronizer
  console.log(`[Procurement Router] No tool calls - routing to synchronizer`);
  return PARALLEL_INTELLIGENCE_NODES.SYNCHRONIZER;
}

/**
 * Decision Makers Should Continue Router
 */
export function decisionMakersShouldContinue(
  state: typeof OverallProposalStateAnnotation.State
): "decisionMakersTools" | "parallelIntelligenceSynchronizer" {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];
  
  // Check tool calls first (mandatory ReAct pattern)
  if (lastMessage && 'tool_calls' in lastMessage && (lastMessage as AIMessage).tool_calls?.length > 0) {
    const toolCalls = (lastMessage as AIMessage).tool_calls;
    console.log(`[Decision Router] Agent made ${toolCalls.length} tool calls:`, 
      toolCalls.map((tc: any) => ({ name: tc.name, id: tc.id }))
    );
    return PARALLEL_INTELLIGENCE_NODES.DECISION_TOOLS;
  }
  
  // No tool calls - agent is done, route to synchronizer
  console.log(`[Decision Router] No tool calls - routing to synchronizer`);
  return PARALLEL_INTELLIGENCE_NODES.SYNCHRONIZER;
}