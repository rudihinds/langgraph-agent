/**
 * Intelligence Gathering Router
 * 
 * Provides conditional routing logic for the intelligence gathering workflow.
 * Determines whether to continue with tool execution or proceed to formatting.
 */

import { isAIMessage } from "@langchain/core/messages";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";

/**
 * Determines the next step in the intelligence gathering workflow
 * 
 * @param state - Current state of the proposal generation
 * @returns Next node to execute: "intelligenceTools", "intelligenceFormatter", or "companyInfoHitlCollection"
 */
export function intelligenceGatheringRouter(
  state: typeof OverallProposalStateAnnotation.State
): "intelligenceTools" | "intelligenceFormatter" | "companyInfoHitlCollection" {
  console.log("[Intelligence Router] Evaluating next step");
  
  // Check if we need company/industry info first
  const company = state.company || "";
  const industry = state.industry || "";
  
  const needsCompanyInfo = !company || company === "Unknown Organization" || company === "";
  const needsIndustryInfo = !industry || industry === "Unknown Industry" || industry === "General" || industry === "";
  
  if (needsCompanyInfo || needsIndustryInfo) {
    console.log("[Intelligence Router] Missing company/industry info - routing to HITL collection");
    return "companyInfoHitlCollection";
  }
  
  // Check the last message to see if tools were called
  const messages = state.messages || [];
  if (messages.length === 0) {
    console.log("[Intelligence Router] No messages found - routing to formatter");
    return "formatter";
  }
  
  const lastMessage = messages[messages.length - 1];
  
  // If the last message is an AI message with tool calls, execute the tools
  if (isAIMessage(lastMessage) && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    console.log(`[Intelligence Router] Found ${lastMessage.tool_calls.length} tool calls - routing to tools`);
    return "intelligenceTools";
  }
  
  // Check if we have enough research data by looking for tool messages in history
  const toolMessageCount = messages.filter(msg => msg._getType() === "tool").length;
  console.log(`[Intelligence Router] Found ${toolMessageCount} tool messages in history`);
  
  // If we have some research data, proceed to formatting
  // The agent will have indicated it's done by not generating more tool calls
  if (toolMessageCount > 0) {
    console.log("[Intelligence Router] Research complete - routing to formatter");
    return "intelligenceFormatter";
  }
  
  // Default: go to formatter if no clear next step
  console.log("[Intelligence Router] No clear next step - defaulting to formatter");
  return "intelligenceFormatter";
}

/**
 * Checks if the intelligence gathering phase is complete
 * Used to determine if we should proceed to synthesis or continue research
 */
export function isIntelligenceGatheringComplete(
  state: typeof OverallProposalStateAnnotation.State
): boolean {
  // Check if we have a completed intelligence briefing
  if (state.intelligenceBriefing) {
    console.log("[Intelligence Router] Intelligence briefing exists - phase complete");
    return true;
  }
  
  // Check for error state
  if (state.intelligenceGatheringStatus === "error") {
    console.log("[Intelligence Router] Intelligence gathering in error state");
    return true; // Move forward even with errors
  }
  
  return false;
}