/**
 * Strategic Options Refinement Node - Applies user feedback to create revised strategic options
 * Completes the collaboration loop started by userFeedbackProcessor
 * Follows LangGraph pattern: nodes do work, edges handle orchestration
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { AIMessage } from "@langchain/core/messages";
import { z } from "zod";
import { interrupt } from "@langchain/langgraph";
import {
  OverallProposalState,
  InterruptReason,
} from "@/state/modules/types.js";

// Create logger instance directly to avoid import issues
const logger = {
  info: (message: string, meta?: any) =>
    console.log(`[INFO] ${message}`, meta || ""),
  error: (message: string, meta?: any) =>
    console.error(`[ERROR] ${message}`, meta || ""),
  warn: (message: string, meta?: any) =>
    console.warn(`[WARN] ${message}`, meta || ""),
  debug: (message: string, meta?: any) =>
    console.debug(`[DEBUG] ${message}`, meta || ""),
};

// Direct environment variable access
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// LLM instance for strategic options refinement
const refinementLlm = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.3, // Balance creativity with consistency
  maxTokens: 2048,
  apiKey: ANTHROPIC_API_KEY,
});

// Zod schema for refined strategic options
const RefinedOptionsSchema = z.object({
  revisedStrategicOptions: z.array(z.string()),
  rationale: z.object({
    userModifications: z.array(z.string()),
    keptElements: z.array(z.string()),
    newElements: z.array(z.string()),
    removedElements: z.array(z.string()),
  }),
  confidence: z.number().min(0).max(1),
  requiresAdditionalInput: z.boolean(),
});

type RefinedOptions = z.infer<typeof RefinedOptionsSchema>;

/**
 * Strategic options refinement prompt template
 */
const STRATEGIC_REFINEMENT_PROMPT = `You are an expert at refining strategic approaches based on user feedback. Your job is to take the original strategic options and user feedback to create improved strategic priorities.

Guidelines for refinement:
1. PRESERVE elements the user explicitly liked or wanted to keep
2. REMOVE or REPLACE elements the user disliked or wanted changed  
3. ADD new elements the user specifically requested
4. MAINTAIN overall strategic coherence and RFP alignment
5. Keep 3-5 total strategic options (not too many to overwhelm)

User feedback interpretation:
- "Keep X" = preserve this element exactly
- "Replace X with Y" = remove X and add Y instead  
- "Add Z" = include Z as a new strategic option
- "Focus more on A" = elevate A to higher priority
- "Less emphasis on B" = downplay or remove B

Provide refined strategic options in this JSON format:

{
  "revisedStrategicOptions": ["option1", "option2", "option3", "option4"],
  "rationale": {
    "userModifications": ["what changes were requested"],
    "keptElements": ["what was preserved from original"],  
    "newElements": ["what was added"],
    "removedElements": ["what was removed or replaced"]
  },
  "confidence": 0.0 to 1.0,
  "requiresAdditionalInput": true/false
}`;

/**
 * Generate refined strategic options based on user feedback
 */
async function generateRefinedStrategicOptions(
  originalOptions: string[],
  userFeedback: any,
  rfpContext: any
): Promise<RefinedOptions> {
  try {
    logger.info("Generating refined strategic options", {
      originalCount: originalOptions.length,
      hasFeedback: !!userFeedback,
      hasContext: !!rfpContext,
    });

    const refinementContext = `
ORIGINAL STRATEGIC OPTIONS:
${originalOptions.map((opt, i) => `${i + 1}. ${opt}`).join("\n")}

USER FEEDBACK ANALYSIS:
- Sentiment: ${userFeedback.sentiment}
- Specific Suggestions: ${userFeedback.feedback_details.specific_suggestions.join(", ")}
- Areas of Concern: ${userFeedback.feedback_details.areas_of_concern.join(", ")}
- User Priorities: ${userFeedback.feedback_details.user_priorities.join(", ")}

RFP CONTEXT:
- Industry: ${rfpContext.industry}
- Complexity: ${rfpContext.complexity}
- Timeline Pressure: ${rfpContext.timelinePressure}

TASK: Create refined strategic options that incorporate the user's feedback while maintaining RFP alignment.
`;

    const response = await refinementLlm.invoke([
      { role: "system", content: STRATEGIC_REFINEMENT_PROMPT },
      { role: "user", content: refinementContext },
    ]);

    const content = (response.content as string)
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsedResponse = JSON.parse(content);
    const validatedResult = RefinedOptionsSchema.parse(parsedResponse);

    logger.info("Strategic options refinement completed", {
      revisedCount: validatedResult.revisedStrategicOptions.length,
      confidence: validatedResult.confidence,
      modificationsCount: validatedResult.rationale.userModifications.length,
    });

    return validatedResult;
  } catch (error) {
    logger.error("Strategic options refinement failed", { error });

    // Fallback refinement when LLM fails
    return {
      revisedStrategicOptions: [
        ...originalOptions.slice(0, 2), // Keep first two as safe bet
        "Manual strategic review required", // Acknowledge system limitation
        "User feedback analysis needed",
      ],
      rationale: {
        userModifications: ["System error - manual review required"],
        keptElements: originalOptions.slice(0, 2),
        newElements: ["Error recovery options"],
        removedElements: ["Failed to process user feedback"],
      },
      confidence: 0.2,
      requiresAdditionalInput: true,
    };
  }
}

/**
 * Create refined validation checkpoint with updated strategic options
 */
function createRefinedValidationCheckpoint(
  refinedOptions: RefinedOptions,
  iterationNumber: number
): any {
  return {
    checkpointType: "refined_strategic_validation",
    iterationNumber,
    userQuestions: [
      {
        id: `refined_strategic_priorities_${Date.now()}`,
        question: `How do these refined strategic priorities look? (Iteration ${iterationNumber})`,
        options: refinedOptions.revisedStrategicOptions,
        multiSelect: true,
        context: `Based on your feedback: ${refinedOptions.rationale.userModifications.join(", ")}`,
        timestamp: new Date().toISOString(),
        refinementRationale: refinedOptions.rationale,
      },
    ],
  };
}

/**
 * Strategic Options Refinement Node - Main implementation
 * Takes processed user feedback and generates improved strategic options
 */
export async function strategicOptionsRefinement(
  state: OverallProposalState
): Promise<Partial<OverallProposalState>> {
  try {
    logger.info("Starting strategic options refinement", {
      userId: state.userId,
      proposalId: state.proposalId,
      hasProcessedFeedback: !!state.feedbackProcessing?.lastProcessedFeedback,
    });

    // Validate we have processed feedback to work with
    const processedFeedback = state.feedbackProcessing?.lastProcessedFeedback;
    if (!processedFeedback) {
      logger.warn("No processed feedback found for refinement");
      return {
        currentStep: "refinement_failed",
        errors: [
          ...(state.errors || []),
          "No processed user feedback available for strategic options refinement",
        ],
        lastUpdatedAt: new Date().toISOString(),
      };
    }

    // Extract original strategic options from current state
    const originalOptions =
      state.planningIntelligence?.earlyRiskAssessment?.strategicInsights
        ?.keyOpportunities || [];
    if (originalOptions.length === 0) {
      logger.warn("No original strategic options found");
      return {
        currentStep: "refinement_failed",
        errors: [
          ...(state.errors || []),
          "No original strategic options available for refinement",
        ],
        lastUpdatedAt: new Date().toISOString(),
      };
    }

    // Get RFP context for informed refinement
    const rfpContext = {
      industry: state.planningIntelligence?.rfpCharacteristics?.industry,
      complexity: state.planningIntelligence?.rfpCharacteristics?.complexity,
      timelinePressure:
        state.planningIntelligence?.rfpCharacteristics?.timelinePressure,
    };

    // Generate refined strategic options
    const refinedOptions = await generateRefinedStrategicOptions(
      originalOptions,
      processedFeedback,
      rfpContext
    );

    // Get current refinement iteration count
    const currentIteration = state.userCollaboration?.refinementIteration || 0;
    const newIteration = currentIteration + 1;

    // Create new validation checkpoint with refined options
    const refinedValidationCheckpoint = createRefinedValidationCheckpoint(
      refinedOptions,
      newIteration
    );

    // Update state with refined options and new validation checkpoint
    const updatedState: Partial<OverallProposalState> = {
      currentStep: "strategic_options_refined",
      planningIntelligence: {
        ...state.planningIntelligence,
        earlyRiskAssessment: {
          ...state.planningIntelligence?.earlyRiskAssessment!,
          strategicInsights: {
            ...state.planningIntelligence?.earlyRiskAssessment
              ?.strategicInsights!,
            keyOpportunities: refinedOptions.revisedStrategicOptions,
          },
        },
      },
      userCollaboration: {
        ...state.userCollaboration,
        refinementIteration: newIteration,
        userQueries: [
          ...(state.userCollaboration?.userQueries || []),
          ...refinedValidationCheckpoint.userQuestions,
        ],
        feedbackHistory: {
          ...(state.userCollaboration?.feedbackHistory || {}),
          [`iteration_${newIteration}`]: {
            originalOptions,
            userFeedback: processedFeedback,
            refinedOptions: refinedOptions.revisedStrategicOptions,
            rationale: refinedOptions.rationale,
            timestamp: new Date().toISOString(),
          },
        },
      },
      messages: [
        ...state.messages,
        new AIMessage(
          `## Strategic Options Refined (Iteration ${newIteration})\n\n` +
            `**Based on your feedback**, I've updated the strategic priorities:\n\n` +
            `✅ **Kept**: ${refinedOptions.rationale.keptElements.join(", ") || "N/A"}\n` +
            `➕ **Added**: ${refinedOptions.rationale.newElements.join(", ") || "N/A"}\n` +
            `➖ **Removed**: ${refinedOptions.rationale.removedElements.join(", ") || "N/A"}\n\n` +
            `**Refined Strategic Options:**\n` +
            refinedOptions.revisedStrategicOptions
              .map((opt) => `• ${opt}`)
              .join("\n") +
            "\n\n" +
            `Please review these refined strategic priorities and let me know if they better align with your vision.`
        ),
      ],
      lastUpdatedAt: new Date().toISOString(),
    };

    logger.info("Strategic options refinement completed successfully", {
      originalCount: originalOptions.length,
      refinedCount: refinedOptions.revisedStrategicOptions.length,
      iteration: newIteration,
      confidence: refinedOptions.confidence,
    });

    return updatedState;
  } catch (error) {
    logger.error("Strategic options refinement node failed", { error });

    return {
      currentStep: "refinement_failed",
      errors: [
        ...(state.errors || []),
        `Strategic options refinement failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      ],
      lastUpdatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Conditional edge function for routing after strategic options refinement
 */
export function routeAfterStrategicRefinement(
  state: OverallProposalState
): string {
  console.log("[routeAfterStrategicRefinement] Determining next step", {
    currentStep: state.currentStep,
    hasErrors: !!state.errors?.length,
    refinementIteration: state.userCollaboration?.refinementIteration,
  });

  // Check for refinement failures
  if (state.currentStep === "refinement_failed" || state.errors?.length) {
    console.log(
      "[routeAfterStrategicRefinement] Refinement failed, routing to complete"
    );
    return "complete";
  }

  // Check if we have unresponded refined queries (user needs to validate)
  const hasUnrespondedRefinedQueries =
    state.userCollaboration?.userQueries?.some(
      (query) =>
        query.id.includes("refined_strategic_priorities") && !query.response
    );

  if (hasUnrespondedRefinedQueries) {
    console.log(
      "[routeAfterStrategicRefinement] Has unresponded refined queries, routing to strategic validation"
    );
    return "strategic_validation"; // Present refined options for validation
  }

  // Default: return to strategic validation
  console.log(
    "[routeAfterStrategicRefinement] Default case, routing to strategic validation"
  );
  return "strategic_validation";
}
