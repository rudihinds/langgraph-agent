/**
 * Research Planning Node
 * 
 * Provides a transition from RFP analysis approval to intelligence gathering.
 * Displays a user-friendly message explaining the next phase.
 */

import { AIMessage } from "@langchain/core/messages";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { ProcessingStatus } from "@/state/modules/types.js";

/**
 * Research Planning Node
 * 
 * Transition node that explains the intelligence gathering phase to the user
 * and routes to the research agent to begin the process.
 */
export async function researchPlanningNode(
  state: typeof OverallProposalStateAnnotation.State
): Promise<{
  intelligenceGatheringStatus?: ProcessingStatus;
  currentPhase?: "planning";
  messages?: any[];
}> {
  console.log("[Research Planning] Starting intelligence gathering phase");
  
  const organization = state.rfpDocument?.metadata?.organization || 
                      state.company || 
                      "the organization";
  
  // Following LangGraph pattern - return plain object for state update
  return {
    intelligenceGatheringStatus: ProcessingStatus.RUNNING,
    currentPhase: "planning" as const,
    messages: [
      new AIMessage({
        content: `## 🔍 Intelligence Gathering Phase

Great! The RFP analysis has been approved. The next step is to perform intelligence gathering.

This will research **${organization}** to understand their:
- Strategic context and recent initiatives
- Current vendor relationships and competitive landscape
- Procurement history and buying patterns
- Key decision makers and stakeholders

After I have gathered intelligence, you will be able to review my findings and provide feedback.

Starting intelligence gathering now...`,
        name: "researchPlanning"
      })
    ]
  };
}