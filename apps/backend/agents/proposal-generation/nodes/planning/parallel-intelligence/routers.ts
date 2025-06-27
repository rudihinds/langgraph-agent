/**
 * Router functions for the parallel intelligence gathering system
 */

import { Send } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { PARALLEL_INTELLIGENCE_NODES } from "./index.js";

/**
 * Parallel Intelligence Router
 * 
 * Returns Send commands to dispatch all 4 agents in parallel.
 * This is called after the dispatcher has initialized state.
 */
export function parallelIntelligenceRouter(
  state: typeof OverallProposalStateAnnotation.State
): Send[] {
  console.log("[Parallel Intelligence Router] Dispatching 4 agents in parallel");
  
  // Return Send commands for all 4 agents
  return [
    new Send(PARALLEL_INTELLIGENCE_NODES.STRATEGIC_AGENT, state),
    new Send(PARALLEL_INTELLIGENCE_NODES.VENDOR_AGENT, state),
    new Send(PARALLEL_INTELLIGENCE_NODES.PROCUREMENT_AGENT, state),
    new Send(PARALLEL_INTELLIGENCE_NODES.DECISION_AGENT, state),
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
    console.log(`[Strategic Router] Agent made ${(lastMessage as AIMessage).tool_calls.length} tool calls - executing tools`);
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
    console.log(`[Vendor Router] Agent made ${(lastMessage as AIMessage).tool_calls.length} tool calls - executing tools`);
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
    console.log(`[Procurement Router] Agent made ${(lastMessage as AIMessage).tool_calls.length} tool calls - executing tools`);
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
    console.log(`[Decision Router] Agent made ${(lastMessage as AIMessage).tool_calls.length} tool calls - executing tools`);
    return PARALLEL_INTELLIGENCE_NODES.DECISION_TOOLS;
  }
  
  // No tool calls - agent is done, route to synchronizer
  console.log(`[Decision Router] No tool calls - routing to synchronizer`);
  return PARALLEL_INTELLIGENCE_NODES.SYNCHRONIZER;
}