/**
 * Intelligence Gathering Synthesis Node
 * 
 * Synthesizes intelligence gathering results using the reusable synthesis agent
 * from the common folder. Processes raw intelligence data into structured
 * intelligenceBriefing for proposal strategy development.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { ProcessingStatus } from "@/state/modules/types.js";
import { createIntelligenceSynthesisAgent } from "@/lib/langgraph/common/synthesis-agent.js";

// Initialize LLM for synthesis
const model = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.2, // Lower temperature for consistent synthesis
  maxTokens: 6000,
});

/**
 * Intelligence Gathering Synthesis Node
 * 
 * Uses the reusable synthesis agent to process intelligence gathering results
 * into a structured intelligence briefing for proposal development.
 */
export async function intelligenceGatheringSynthesis(
  state: typeof OverallProposalStateAnnotation.State
): Promise<{
  intelligenceBriefing?: any;
  intelligenceGatheringStatus?: ProcessingStatus;
  currentStatus?: string;
  messages?: any[];
  errors?: string[];
}> {
  console.log("[Intelligence Synthesis] Starting intelligence synthesis");

  try {
    // Check if we have intelligence data to synthesize
    if (!state.intelligenceBriefing) {
      throw new Error("No intelligence data available for synthesis");
    }

    // Create the intelligence synthesis agent
    const synthesisAgent = createIntelligenceSynthesisAgent(model);

    // Run synthesis
    const result = await synthesisAgent(state);

    console.log("[Intelligence Synthesis] Synthesis completed successfully");

    return {
      ...result,
      currentStatus: "Intelligence synthesis completed"
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
