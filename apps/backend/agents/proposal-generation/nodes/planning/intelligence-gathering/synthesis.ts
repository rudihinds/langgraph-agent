/**
 * Intelligence Gathering Synthesis Node
 * 
 * Synthesizes the structured intelligence findings from the intelligence agent
 * into a human-readable executive briefing format.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { ProcessingStatus } from "@/state/modules/types.js";

// Initialize LLM for synthesis
const model = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.2, // Lower temperature for consistent synthesis
  maxTokens: 4000,
});

/**
 * Intelligence Gathering Synthesis Node
 * 
 * Transforms raw intelligence data into a clear, actionable executive briefing
 */
export async function intelligenceGatheringSynthesis(
  state: typeof OverallProposalStateAnnotation.State
): Promise<{
  intelligenceSynthesis?: string;
  intelligenceGatheringStatus?: ProcessingStatus;
  currentStatus?: string;
  messages?: any[];
  errors?: string[];
}> {
  console.log("[Intelligence Synthesis] Starting synthesis of intelligence findings");

  try {
    // Check if we have intelligence data to synthesize
    if (!state.intelligenceBriefing) {
      throw new Error("No intelligence data available for synthesis");
    }

    const intelligence = state.intelligenceBriefing;
    
    // Create synthesis prompt
    const synthesis = await model.invoke([
      { 
        role: "system", 
        content: "You are an executive briefing specialist. Transform raw intelligence data into a clear, actionable briefing for proposal strategy teams. Focus on strategic insights and implications rather than raw data." 
      },
      { 
        role: "user", 
        content: `Transform this intelligence data into an executive briefing:

${JSON.stringify(intelligence, null, 2)}

Format the briefing as follows:

## Executive Summary
- 2-3 key strategic insights that will shape our proposal approach
- Focus on what matters most for winning

## Critical Findings

### Customer Strategic Context
- Synthesize their strategic initiatives and what they reveal about priorities
- Identify patterns and themes across initiatives
- Highlight budget or timeline indicators

### Competitive Landscape
- Current vendor relationships and their implications
- Gaps in current solutions we could fill
- Incumbent advantages/vulnerabilities

### Procurement Patterns
- Buying behavior insights from recent RFPs
- Decision-making timeline patterns
- Price sensitivity indicators

### Key Stakeholders
- Decision-making structure insights
- Individual priorities based on backgrounds
- Engagement strategy recommendations

## Intelligence Gaps
- Critical information we couldn't verify
- Areas requiring direct customer engagement
- Risks from incomplete information

## Recommended Actions
- 3-5 specific actions for the proposal team based on intelligence
- Priority order with rationale
- Quick wins vs strategic positioning

Keep the tone professional but conversational. Make insights actionable.`
      }
    ]);
    
    // Extract the synthesis content
    const synthesisContent = typeof synthesis.content === "string" 
      ? synthesis.content 
      : "Intelligence synthesis completed";

    console.log("[Intelligence Synthesis] Synthesis completed successfully");

    // Create status message for user
    const statusMessage = {
      role: "assistant" as const,
      content: `## 📊 Intelligence Synthesis Complete

I've transformed the raw intelligence data into an actionable executive briefing. The synthesis includes:

• **Strategic insights** from ${intelligence.customer_context.recent_initiatives.length} customer initiatives
• **Competitive analysis** of ${intelligence.vendor_landscape.current_vendors.length} current vendors
• **Procurement patterns** from ${intelligence.procurement_history.recent_rfps.length} recent RFPs
• **Stakeholder profiles** for ${intelligence.decision_makers.length} key decision makers

The briefing provides clear recommendations for proposal positioning and strategy based on verified intelligence.`
    };

    return {
      intelligenceSynthesis: synthesisContent,
      intelligenceGatheringStatus: ProcessingStatus.AWAITING_REVIEW,
      currentStatus: "Intelligence synthesis completed - ready for review",
      messages: [statusMessage]
    };

  } catch (error) {
    console.error("[Intelligence Synthesis] Error during synthesis:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown synthesis error";
    
    return {
      intelligenceGatheringStatus: ProcessingStatus.ERROR,
      currentStatus: `Intelligence synthesis failed: ${errorMessage}`,
      errors: [errorMessage]
    };
  }
}