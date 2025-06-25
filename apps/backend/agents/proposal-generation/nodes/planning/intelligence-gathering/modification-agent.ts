/**
 * Intelligence Modification Agent
 *
 * Handles user feedback to modify and improve the intelligence briefing.
 * Processes user modification requests and updates the intelligence briefing
 * accordingly, then passes back to synthesis for integration.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { ProcessingStatus } from "@/state/modules/types.js";
import { IntelligenceBriefingSchema } from "@/state/modules/schemas.js";

// Initialize LLM for modification processing
const model = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.3, // Balanced temperature for modification accuracy
  maxTokens: 6000,
});

/**
 * Extract modification context from user feedback and existing intelligence
 */
function extractModificationContext(
  state: typeof OverallProposalStateAnnotation.State
): {
  existingIntelligence: any;
  userFeedback: string;
  company: string;
  industry: string;
} {
  const intelligenceBriefing = state.intelligenceBriefing;
  const userFeedback = state.intelligenceHumanReview?.feedback || "";

  const company =
    intelligenceBriefing?.customer_context?.company || "Unknown Organization";
  const industry =
    intelligenceBriefing?.customer_context?.industry || "Unknown Industry";

  return {
    existingIntelligence: intelligenceBriefing,
    userFeedback,
    company,
    industry,
  };
}

/**
 * Intelligence Modification Agent Node
 *
 * Processes user feedback to modify and improve the intelligence briefing
 * based on specific user requests for changes, corrections, or enhancements.
 */
export async function intelligenceModificationAgent(
  state: typeof OverallProposalStateAnnotation.State
): Promise<{
  intelligenceBriefing?: any;
  intelligenceGatheringStatus?: ProcessingStatus;
  currentStatus?: string;
  messages?: any[];
  errors?: string[];
}> {
  console.log("[Modification Agent] Starting intelligence modification");

  try {
    // Extract modification context
    const { existingIntelligence, userFeedback, company, industry } =
      extractModificationContext(state);

    if (!userFeedback) {
      throw new Error("No user feedback provided for modification");
    }

    if (!existingIntelligence) {
      throw new Error("No existing intelligence briefing to modify");
    }

    console.log(
      `[Modification Agent] Processing modification request for ${company}`
    );

    const systemPrompt = `You are an intelligence modification specialist. Your task is to process user feedback and modify the existing intelligence briefing accordingly.

## Modification Guidelines:

1. **Preserve Valid Information**: Keep accurate, well-sourced information unless specifically contradicted by user feedback
2. **Address User Concerns**: Directly address all points raised in the user feedback
3. **Maintain Structure**: Keep the intelligence briefing in the required JSON structure
4. **Improve Quality**: Use the feedback to enhance the overall quality and accuracy of the briefing
5. **Add Context**: Where user feedback indicates gaps, add appropriate context or mark for additional research

## Modification Types:

- **Corrections**: Fix factual errors or inaccuracies identified by the user
- **Enhancements**: Add missing information or improve existing entries
- **Reorganization**: Restructure information for better clarity or relevance
- **Prioritization**: Adjust priority levels or emphasis based on user insights
- **Gap Filling**: Address information gaps highlighted by the user

## Output Requirements:

Return the modified intelligence briefing in the exact same JSON structure, incorporating all user feedback while maintaining data integrity and source attribution.`;

    const humanPrompt = `Please modify the existing intelligence briefing based on this user feedback:

**User Feedback**: ${userFeedback}

**Current Intelligence Briefing**:
${JSON.stringify(existingIntelligence, null, 2)}

**Organization**: ${company}
**Industry**: ${industry}

Process the user feedback and return an improved intelligence briefing that addresses all the user's concerns while maintaining the required structure and data quality.`;

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt),
    ];

    // Call LLM with structured output
    const structuredLlm = model.withStructuredOutput(
      IntelligenceBriefingSchema,
      {
        name: "IntelligenceModification",
      }
    );

    console.log("[Modification Agent] Calling LLM for modification processing");
    const modifiedIntelligence = await structuredLlm.invoke(messages);

    // Add modification metadata
    const updatedIntelligence = {
      ...modifiedIntelligence,
      metadata: {
        ...modifiedIntelligence.metadata,
        last_modified: new Date().toISOString(),
        modification_history: [
          ...(existingIntelligence.metadata?.modification_history || []),
          {
            timestamp: new Date().toISOString(),
            user_feedback: userFeedback,
            modification_type: "user_requested",
          },
        ],
      },
    };

    console.log(
      `[Modification Agent] Intelligence modification complete for ${company}`
    );

    // Create status message for user
    const statusMessage = {
      role: "assistant" as const,
      content: `## ✏️ Intelligence Briefing Modified

I've processed your feedback and updated the intelligence briefing for **${company}**.

**Your Feedback**: "${userFeedback}"

**Modifications Applied**:
- Addressed all points raised in your feedback
- Maintained data integrity and source attribution
- Enhanced information quality based on your insights
- Updated metadata to track modification history

The intelligence briefing has been updated and will now proceed to synthesis to ensure all changes are properly integrated. Please review the updated briefing.`,
    };

    return {
      intelligenceBriefing: updatedIntelligence,
      intelligenceGatheringStatus: ProcessingStatus.IN_PROGRESS, // Will go back to synthesis
      currentStatus: `Intelligence briefing modified based on user feedback`,
      messages: [statusMessage],
      errors: [],
    };
  } catch (error) {
    console.error("[Modification Agent] Error during modification:", error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error during modification";

    return {
      intelligenceGatheringStatus: ProcessingStatus.ERROR,
      currentStatus: `Intelligence modification failed: ${errorMessage}`,
      errors: [errorMessage],
    };
  }
}
