/**
 * User Feedback Processor Node - Processes user responses from strategic validation
 * Interprets natural language feedback and determines next routing action
 * Follows LangGraph pattern: nodes do work, edges handle orchestration
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { AIMessage } from "@langchain/core/messages";
import { z } from "zod";
import {
  OverallProposalState,
  InterruptReason,
  InterruptProcessingStatus,
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

// Zod schema for structured feedback processing
const FeedbackAnalysisSchema = z.object({
  sentiment: z.enum(["satisfied", "needs_refinement", "needs_restart"]),
  feedback_details: z.object({
    specific_suggestions: z.array(z.string()),
    areas_of_concern: z.array(z.string()),
    user_priorities: z.array(z.string()),
    tone_indicators: z.array(z.string()),
  }),
  routing_decision: z.enum([
    "proceed_to_planning",
    "refine_analysis",
    "restart_analysis",
  ]),
  confidence_score: z.number().min(0).max(1),
  user_engagement_level: z.enum(["high", "medium", "low"]),
  requires_clarification: z.boolean(),
});

type FeedbackAnalysis = z.infer<typeof FeedbackAnalysisSchema>;

// LLM instance for feedback processing
const feedbackLlm = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.2, // Slightly higher for nuanced interpretation
  maxTokens: 2048,
  apiKey: ANTHROPIC_API_KEY,
});

// LLM instance for contextual response generation
const responseLlm = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.4, // Natural variation for conversational responses
  maxTokens: 1024,
  apiKey: ANTHROPIC_API_KEY,
});

// LLM instance for fallback analysis (simplified, reliable)
const fallbackLlm = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.1, // Lower temperature for fallback reliability
  maxTokens: 512,
  apiKey: ANTHROPIC_API_KEY,
});

/**
 * Feedback processing prompt template
 */
const FEEDBACK_PROCESSING_PROMPT = `You are an expert at interpreting user feedback in collaborative AI systems. Your job is to analyze user responses to strategic RFP analysis and determine the best next action.

User feedback can range from:
- Simple approval ("looks good", "yes", "proceed")
- Specific suggestions ("focus more on sustainability", "missing cost analysis")
- Concerns ("this seems off", "not sure about the complexity rating")
- Requests for changes ("try again", "start over", "completely wrong")

Analyze the user feedback and provide structured interpretation:

SENTIMENT CLASSIFICATION:
- "satisfied": User approves and wants to proceed (variations: "good", "yes", "proceed", "looks right")
- "needs_refinement": User wants improvements but same general approach (variations: "mostly good but...", "adjust X", "add Y")
- "needs_restart": User wants completely fresh analysis (variations: "wrong", "start over", "completely off")

ROUTING DECISIONS:
- "proceed_to_planning": Move to research planning phase
- "refine_analysis": Improve current analysis based on feedback
- "restart_analysis": Start completely fresh analysis

Provide your analysis in valid JSON format:

{
  "sentiment": "satisfied" | "needs_refinement" | "needs_restart",
  "feedback_details": {
    "specific_suggestions": ["suggestion1", "suggestion2"],
    "areas_of_concern": ["concern1", "concern2"], 
    "user_priorities": ["priority1", "priority2"],
    "tone_indicators": ["confident", "uncertain", "frustrated", etc.]
  },
  "routing_decision": "proceed_to_planning" | "refine_analysis" | "restart_analysis",
  "confidence_score": 0.0 to 1.0,
  "user_engagement_level": "high" | "medium" | "low",
  "requires_clarification": true | false
}`;

/**
 * Contextual response generation prompt template
 */
const RESPONSE_GENERATION_PROMPT = `You are an AI assistant working collaboratively with users on RFP analysis. Generate a natural, contextual response that acknowledges their feedback and explains your next action.

Guidelines for response generation:
1. Match the user's communication style (formal/casual, brief/detailed)
2. Acknowledge specific aspects of their feedback
3. Be encouraging and collaborative
4. Include relevant context about what was validated or what will change
5. Use appropriate industry terminology when relevant
6. Keep responses concise but informative

Response should be 1-2 sentences maximum and feel natural in conversation.

Examples of good contextual responses:
- For satisfied feedback: "Perfect! I'll move forward with the research planning, focusing on [specific validated aspects]."
- For refinement requests: "I understand your concerns about [specific area]. I'll refine the analysis to better address [specific suggestions]."
- For restart requests: "I see this approach isn't quite right. I'll start fresh with a different analytical framework."`;

/**
 * Simplified fallback analysis prompt for when main processing fails
 */
const FALLBACK_ANALYSIS_PROMPT = `You are analyzing user feedback for an RFP analysis system. Provide a simple, reliable analysis even for ambiguous responses.

Your task is to classify ANY user response into one of these categories:
- "satisfied": User is happy and wants to proceed (examples: "good", "yes", "looks right", "ok", "correct", "proceed", "👍", even just "k")
- "needs_refinement": User wants improvements or changes (examples: "mostly good but...", "adjust X", "missing Y", "add more about Z", "not quite right")  
- "needs_restart": User wants to start completely over (examples: "wrong", "start over", "completely off", "try again", "no this is all wrong")

IMPORTANT GUIDELINES:
- Be generous in interpretation - users often give brief responses
- Consider tone, context, and implied meaning
- Single words like "good", "yes", "no", "wrong" have clear meanings
- Emojis and abbreviations are valid feedback (👍 = satisfied, 👎 = needs_refinement)
- If truly ambiguous, default to "needs_refinement" for safety
- ALWAYS provide a confidence score based on clarity of the response
- Consider industry context if provided to understand domain-specific language

Respond with ONLY a JSON object in this exact format:
{
  "sentiment": "satisfied" | "needs_refinement" | "needs_restart",
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation of classification"
}`;

/**
 * Process user feedback using LLM interpretation
 */
async function processFeedbackWithLLM(
  userFeedback: string,
  originalQuery: string,
  analysisContext: any
): Promise<FeedbackAnalysis> {
  try {
    logger.info("Processing user feedback with LLM", {
      feedbackLength: userFeedback.length,
      hasContext: !!analysisContext,
    });

    const contextInfo = `
Original Question: ${originalQuery}
Analysis Context: ${JSON.stringify(analysisContext, null, 2)}
User Response: "${userFeedback}"
`;

    const response = await feedbackLlm.invoke([
      { role: "system", content: FEEDBACK_PROCESSING_PROMPT },
      { role: "user", content: contextInfo },
    ]);

    const content = (response.content as string)
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsedResponse = JSON.parse(content);
    const validatedResult = FeedbackAnalysisSchema.parse(parsedResponse);

    logger.info("Feedback processing completed", {
      sentiment: validatedResult.sentiment,
      routingDecision: validatedResult.routing_decision,
      confidence: validatedResult.confidence_score,
      engagementLevel: validatedResult.user_engagement_level,
    });

    return validatedResult;
  } catch (error) {
    logger.error("Feedback processing failed", { error, userFeedback });

    // Enhanced fallback interpretation with industry context
    const industryContext = analysisContext?.industry;
    return await createFallbackFeedbackAnalysis(userFeedback, industryContext);
  }
}

/**
 * LLM-based fallback analysis when main processing fails
 */
async function performLLMFallbackAnalysis(
  userFeedback: string,
  industryContext?: string
): Promise<{
  sentiment: "satisfied" | "needs_refinement" | "needs_restart";
  confidence: number;
  reasoning: string;
}> {
  try {
    const context = `
User Response: "${userFeedback}"
${industryContext ? `Industry Context: ${industryContext}` : ""}
`;

    const response = await fallbackLlm.invoke([
      { role: "system", content: FALLBACK_ANALYSIS_PROMPT },
      { role: "user", content: context },
    ]);

    const content = (response.content as string)
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsed = JSON.parse(content);

    logger.info("LLM fallback analysis completed", {
      sentiment: parsed.sentiment,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
    });

    return {
      sentiment: parsed.sentiment,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
    };
  } catch (error) {
    logger.error("LLM fallback analysis failed completely", {
      error,
      userFeedback,
    });

    // Intelligent failure handling - no keyword analysis needed
    // LLMs should handle virtually all cases, so complete failure is rare
    return {
      sentiment: "needs_refinement",
      confidence: 0.1,
      reasoning:
        "System temporarily unable to process feedback - defaulting to refinement for safety. Please try rephrasing your response.",
    };
  }
}

/**
 * Enhanced fallback feedback analysis with LLM intelligence
 */
function createFallbackFeedbackAnalysis(
  userFeedback: string,
  industryContext?: string
): Promise<FeedbackAnalysis> {
  return performLLMFallbackAnalysis(userFeedback, industryContext).then(
    (result) => {
      let routing_decision:
        | "proceed_to_planning"
        | "refine_analysis"
        | "restart_analysis";

      switch (result.sentiment) {
        case "satisfied":
          routing_decision = "proceed_to_planning";
          break;
        case "needs_restart":
          routing_decision = "restart_analysis";
          break;
        default:
          routing_decision = "refine_analysis";
          break;
      }

      return {
        sentiment: result.sentiment,
        feedback_details: {
          specific_suggestions: [],
          areas_of_concern:
            result.confidence < 0.5
              ? ["Fallback analysis used - lower confidence in interpretation"]
              : [],
          user_priorities: [],
          tone_indicators: [
            "fallback_analysis",
            `confidence_${Math.round(result.confidence * 100)}`,
          ],
        },
        routing_decision,
        confidence_score: result.confidence,
        user_engagement_level: "medium",
        requires_clarification: result.confidence < 0.5,
      };
    }
  );
}

/**
 * Update user collaboration state with processed feedback
 */
function updateCollaborationState(
  currentState: OverallProposalState,
  feedbackAnalysis: FeedbackAnalysis,
  originalQuery: any
): Partial<OverallProposalState> {
  // Update the query with response and analysis
  const updatedQueries = (
    currentState.userCollaboration?.userQueries || []
  ).map((query) => {
    if (query.id === originalQuery.id) {
      return {
        ...query,
        response: originalQuery.response,
        responseTimestamp: new Date().toISOString(),
        feedbackAnalysis: {
          sentiment: feedbackAnalysis.sentiment,
          suggestions: feedbackAnalysis.feedback_details.specific_suggestions,
          concerns: feedbackAnalysis.feedback_details.areas_of_concern,
          confidence: feedbackAnalysis.confidence_score,
        },
      };
    }
    return query;
  });

  // Track refinement iteration if needed
  const currentRefinement =
    currentState.userCollaboration?.refinementIteration || 0;
  const newRefinementCount =
    feedbackAnalysis.routing_decision === "refine_analysis"
      ? currentRefinement + 1
      : currentRefinement;

  return {
    userCollaboration: {
      ...currentState.userCollaboration,
      userQueries: updatedQueries,
      refinementIteration: newRefinementCount,
      maxRefinements: calculateRefinementLimit(currentState),
      lastFeedbackProcessed: {
        timestamp: new Date().toISOString(),
        sentiment: feedbackAnalysis.sentiment,
        engagementLevel: feedbackAnalysis.user_engagement_level,
        confidence: feedbackAnalysis.confidence_score,
      },
      feedbackHistory: {
        ...(currentState.userCollaboration?.feedbackHistory || {}),
        [originalQuery.id]: {
          queryId: originalQuery.id,
          userResponse: originalQuery.response,
          processedFeedback: feedbackAnalysis,
          timestamp: new Date().toISOString(),
        },
      },
    },
  };
}

/**
 * Calculate dynamic refinement limit based on RFP complexity and context
 */
function calculateRefinementLimit(state: OverallProposalState): number {
  const complexity = state.planningIntelligence?.rfpCharacteristics?.complexity;
  const industry = state.planningIntelligence?.rfpCharacteristics?.industry;
  const riskIndicators =
    state.planningIntelligence?.earlyRiskAssessment?.riskIndicators || [];

  // Base limit by complexity
  let limit = 2; // Simple default
  if (complexity === "Medium") {
    limit = 3;
  } else if (complexity === "Complex") {
    limit = 5;
  }

  // Add +1 for high risk count (3+ high/critical risks)
  const highRiskCount = riskIndicators.filter(
    (risk) => risk.severity === "High" || risk.severity === "Critical"
  ).length;

  if (highRiskCount >= 3) {
    limit += 1;
  }

  // Add +1 for compliance-heavy industries
  const complianceIndustries = ["Government", "Healthcare"];
  if (industry && complianceIndustries.includes(industry)) {
    limit += 1;
  }

  logger.info("Calculated dynamic refinement limit", {
    complexity,
    industry,
    highRiskCount,
    finalLimit: limit,
  });

  return Math.min(limit, 6); // Cap at 6 to prevent infinite loops
}

/**
 * User Feedback Processor Node - Main implementation
 * Processes user responses from interrupt() and determines next action
 */
export async function userFeedbackProcessor(
  state: OverallProposalState
): Promise<Partial<OverallProposalState>> {
  try {
    logger.info("Starting user feedback processing", {
      userId: state.userId,
      proposalId: state.proposalId,
      hasUserQueries: !!state.userCollaboration?.userQueries?.length,
    });

    // Find the query that was just responded to
    const respondedQuery = state.userCollaboration?.userQueries?.find(
      (query) => query.response && !query.responseTimestamp
    );

    if (!respondedQuery) {
      logger.warn("No responded query found for processing");
      return {
        currentStep: "feedback_processing_failed",
        errors: [...(state.errors || []), "No user response found to process"],
        lastUpdatedAt: new Date().toISOString(),
      };
    }

    // Extract analysis context for feedback processing
    const analysisContext = {
      industry: state.planningIntelligence?.rfpCharacteristics?.industry,
      complexity: state.planningIntelligence?.rfpCharacteristics?.complexity,
      keyOpportunities:
        state.planningIntelligence?.earlyRiskAssessment?.strategicInsights
          ?.keyOpportunities,
      riskCount:
        state.planningIntelligence?.earlyRiskAssessment?.riskIndicators?.length,
    };

    // Process the feedback using LLM
    const feedbackAnalysis = await processFeedbackWithLLM(
      respondedQuery.response!,
      respondedQuery.question,
      analysisContext
    );

    // Update collaboration state
    const collaborationUpdates = updateCollaborationState(
      state,
      feedbackAnalysis,
      respondedQuery
    );

    // Generate contextual response based on feedback analysis and user communication style
    const contextualResponse = await generateContextualResponse(
      feedbackAnalysis,
      respondedQuery.response!,
      analysisContext
    );

    const updatedState: Partial<OverallProposalState> = {
      currentStep: "feedback_processed",
      ...collaborationUpdates,
      feedbackProcessing: {
        lastProcessedFeedback: feedbackAnalysis,
        processingTimestamp: new Date().toISOString(),
        nextAction: feedbackAnalysis.routing_decision,
        requiresLimitCheck:
          feedbackAnalysis.routing_decision === "refine_analysis" &&
          (collaborationUpdates.userCollaboration?.refinementIteration || 0) >=
            (collaborationUpdates.userCollaboration?.maxRefinements || 3),
      },
      messages: [...state.messages, new AIMessage(contextualResponse)],
      interruptStatus: {
        isInterrupted: false,
        interruptionPoint: null,
        feedback: null,
        processingStatus: InterruptProcessingStatus.PROCESSED,
      },
      lastUpdatedAt: new Date().toISOString(),
    };

    logger.info("Feedback processing completed successfully", {
      sentiment: feedbackAnalysis.sentiment,
      nextAction: feedbackAnalysis.routing_decision,
      refinementCount:
        collaborationUpdates.userCollaboration?.refinementIteration,
      confidence: feedbackAnalysis.confidence_score,
    });

    return updatedState;
  } catch (error) {
    logger.error("User feedback processor failed", { error });

    return {
      currentStep: "feedback_processing_failed",
      errors: [
        ...(state.errors || []),
        `Feedback processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      ],
      lastUpdatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Conditional edge function for routing after feedback processing
 */
export function routeAfterFeedbackProcessing(
  state: OverallProposalState
): string {
  // Check for processing failures
  if (
    state.currentStep === "feedback_processing_failed" ||
    state.errors?.length
  ) {
    return "error_recovery";
  }

  // Check if refinement limit needs to be enforced
  if (state.feedbackProcessing?.requiresLimitCheck) {
    return "refinement_limit_handler";
  }

  // Route based on processed feedback decision
  const nextAction =
    state.feedbackProcessing?.lastProcessedFeedback?.routing_decision;

  switch (nextAction) {
    case "proceed_to_planning":
      return "research_planning";
    case "refine_analysis":
      return "strategic_options_refinement";
    case "restart_analysis":
      return "restart_analysis";
    default:
      logger.warn("Unknown routing decision from feedback processing", {
        nextAction,
      });
      return "error_recovery";
  }
}

/**
 * Enhanced routing function for strategic validation checkpoint
 * Handles the flow between validation and feedback processing for both original and refined queries
 */
export function routeAfterStrategicValidation(
  state: OverallProposalState
): string {
  // Check if we're waiting for user response (interrupted state)
  if (state.interruptStatus?.isInterrupted) {
    return "strategic_validation_checkpoint"; // Stay and wait
  }

  // Check if we have a new user response to process (original OR refined strategic queries)
  const hasUnprocessedResponse = state.userCollaboration?.userQueries?.some(
    (query) =>
      query.response &&
      !query.responseTimestamp &&
      (query.id.includes("strategic_priorities") ||
        query.id.includes("refined_strategic_priorities"))
  );

  if (hasUnprocessedResponse) {
    return "user_feedback_processor";
  }

  // Check if validation is complete (all strategic queries responded to)
  const allStrategicQueriesComplete = state.userCollaboration?.userQueries
    ?.filter(
      (query) =>
        query.id.includes("strategic_priorities") ||
        query.id.includes("refined_strategic_priorities")
    )
    ?.every((query) => query.response && query.responseTimestamp);

  if (
    allStrategicQueriesComplete &&
    state.currentStep === "strategic_validation_complete"
  ) {
    return "research_planning";
  }

  // Default: loop back to validation if unclear state
  return "strategic_validation_checkpoint";
}

/**
 * Generate contextual response based on feedback analysis and user communication style
 */
async function generateContextualResponse(
  feedbackAnalysis: FeedbackAnalysis,
  userFeedback: string,
  analysisContext: any
): Promise<string> {
  try {
    const context = `
USER FEEDBACK: "${userFeedback}"

FEEDBACK ANALYSIS:
Sentiment: ${feedbackAnalysis.sentiment}
Specific Suggestions: ${feedbackAnalysis.feedback_details.specific_suggestions.join(", ") || "None"}
Areas of Concern: ${feedbackAnalysis.feedback_details.areas_of_concern.join(", ") || "None"}
User Priorities: ${feedbackAnalysis.feedback_details.user_priorities.join(", ") || "None"}
Communication Style: ${feedbackAnalysis.feedback_details.tone_indicators.join(", ")}
Engagement Level: ${feedbackAnalysis.user_engagement_level}

ANALYSIS CONTEXT:
Industry: ${analysisContext.industry || "Unknown"}
Complexity: ${analysisContext.complexity || "Unknown"}
Key Opportunities: ${analysisContext.keyOpportunities?.slice(0, 2).join(", ") || "None identified"}

Next Action: ${feedbackAnalysis.routing_decision}
`;

    const response = await responseLlm.invoke([
      { role: "system", content: RESPONSE_GENERATION_PROMPT },
      { role: "user", content: context },
    ]);

    const contextualResponse = (response.content as string).trim();

    logger.info("Generated contextual response", {
      sentiment: feedbackAnalysis.sentiment,
      responseLength: contextualResponse.length,
      engagementLevel: feedbackAnalysis.user_engagement_level,
    });

    return contextualResponse;
  } catch (error) {
    logger.error("Failed to generate contextual response", { error });

    // Intelligent fallback responses based on sentiment and context
    const industry = analysisContext.industry || "";
    const suggestions = feedbackAnalysis.feedback_details.specific_suggestions;

    switch (feedbackAnalysis.sentiment) {
      case "satisfied":
        return industry
          ? `✅ Excellent! I'll proceed with research planning tailored for the ${industry} sector.`
          : "✅ Great! I'll proceed with research planning based on this validated analysis.";

      case "needs_refinement":
        const focusArea =
          suggestions.length > 0 ? suggestions[0] : "your feedback";
        return `🔧 I'll refine the analysis focusing on ${focusArea} to better align with your requirements.`;

      case "needs_restart":
        return industry
          ? `🔄 I'll start fresh with a new analytical approach better suited for ${industry} RFPs.`
          : "🔄 I'll start the analysis fresh with a completely new approach.";

      default:
        return "I'll process your feedback and adjust accordingly.";
    }
  }
}
