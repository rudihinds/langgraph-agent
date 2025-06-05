/**
 * User Feedback Processor Node - Processes user responses from strategic validation
 * Interprets natural language feedback and determines next routing action
 * Follows LangGraph pattern: nodes do work, edges handle orchestration
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { AIMessage } from "@langchain/core/messages";
import { z } from "zod";
import { Command } from "@langchain/langgraph";
import {
  OverallProposalState,
  InterruptReason,
} from "@/state/modules/types.js";
import { Logger } from "@/lib/logger.js";
import { ENV } from "@/lib/config/env.js";

const logger = Logger.getInstance();

// Zod schema for structured feedback processing
const FeedbackAnalysisSchema = z.object({
  sentiment: z.enum(["satisfied", "needs_refinement", "needs_restart"]),
  feedback_details: z.object({
    specific_suggestions: z.array(z.string()),
    areas_of_concern: z.array(z.string()),
    user_priorities: z.array(z.string()),
    tone_indicators: z.array(z.string())
  }),
  routing_decision: z.enum([
    "proceed_to_planning", 
    "refine_analysis", 
    "restart_analysis"
  ]),
  confidence_score: z.number().min(0).max(1),
  user_engagement_level: z.enum(["high", "medium", "low"]),
  requires_clarification: z.boolean()
});

type FeedbackAnalysis = z.infer<typeof FeedbackAnalysisSchema>;

// LLM instance for feedback processing
const feedbackLlm = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.2, // Slightly higher for nuanced interpretation
  maxTokens: 2048,
  apiKey: ENV.ANTHROPIC_API_KEY,
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
      hasContext: !!analysisContext
    });

    const contextInfo = `
Original Question: ${originalQuery}
Analysis Context: ${JSON.stringify(analysisContext, null, 2)}
User Response: "${userFeedback}"
`;

    const response = await feedbackLlm.invoke([
      { role: "system", content: FEEDBACK_PROCESSING_PROMPT },
      { role: "user", content: contextInfo }
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
      engagementLevel: validatedResult.user_engagement_level
    });

    return validatedResult;

  } catch (error) {
    logger.error("Feedback processing failed", { error, userFeedback });
    
    // Fallback interpretation based on simple heuristics
    return createFallbackFeedbackAnalysis(userFeedback);
  }
}

/**
 * Fallback feedback analysis when LLM processing fails
 */
function createFallbackFeedbackAnalysis(userFeedback: string): FeedbackAnalysis {
  const feedback = userFeedback.toLowerCase().trim();
  
  // Simple keyword-based analysis
  const positiveKeywords = ["good", "yes", "ok", "proceed", "correct", "right", "approve"];
  const negativeKeywords = ["no", "wrong", "bad", "restart", "again", "over"];
  const refinementKeywords = ["but", "however", "adjust", "change", "modify", "improve"];
  
  const hasPositive = positiveKeywords.some(word => feedback.includes(word));
  const hasNegative = negativeKeywords.some(word => feedback.includes(word));
  const hasRefinement = refinementKeywords.some(word => feedback.includes(word));
  
  let sentiment: "satisfied" | "needs_refinement" | "needs_restart";
  let routing_decision: "proceed_to_planning" | "refine_analysis" | "restart_analysis";
  
  if (hasNegative && !hasPositive) {
    sentiment = "needs_restart";
    routing_decision = "restart_analysis";
  } else if (hasRefinement || (hasPositive && hasNegative)) {
    sentiment = "needs_refinement";
    routing_decision = "refine_analysis";
  } else if (hasPositive) {
    sentiment = "satisfied";
    routing_decision = "proceed_to_planning";
  } else {
    // Ambiguous feedback - default to refinement for safety
    sentiment = "needs_refinement";
    routing_decision = "refine_analysis";
  }
  
  return {
    sentiment,
    feedback_details: {
      specific_suggestions: [],
      areas_of_concern: ["Feedback processing system error - manual review recommended"],
      user_priorities: [],
      tone_indicators: ["fallback_analysis"]
    },
    routing_decision,
    confidence_score: 0.3, // Low confidence for fallback
    user_engagement_level: "medium",
    requires_clarification: true
  };
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
  const updatedQueries = (currentState.userCollaboration?.userQueries || []).map(query => {
    if (query.id === originalQuery.id) {
      return {
        ...query,
        response: originalQuery.response,
        responseTimestamp: new Date().toISOString(),
        feedbackAnalysis: {
          sentiment: feedbackAnalysis.sentiment,
          suggestions: feedbackAnalysis.feedback_details.specific_suggestions,
          concerns: feedbackAnalysis.feedback_details.areas_of_concern,
          confidence: feedbackAnalysis.confidence_score
        }
      };
    }
    return query;
  });

  // Track refinement iteration if needed
  const currentRefinement = currentState.userCollaboration?.refinementIteration || 0;
  const newRefinementCount = feedbackAnalysis.routing_decision === "refine_analysis" 
    ? currentRefinement + 1 
    : currentRefinement;

  return {
    userCollaboration: {
      ...currentState.userCollaboration,
      userQueries: updatedQueries,
      refinementIteration: newRefinementCount,
      maxRefinements: 3, // Set limit
      lastFeedbackProcessed: {
        timestamp: new Date().toISOString(),
        sentiment: feedbackAnalysis.sentiment,
        engagementLevel: feedbackAnalysis.user_engagement_level,
        confidence: feedbackAnalysis.confidence_score
      },
      feedbackHistory: [
        ...(currentState.userCollaboration?.feedbackHistory || []),
        {
          queryId: originalQuery.id,
          userResponse: originalQuery.response,
          processedFeedback: feedbackAnalysis,
          timestamp: new Date().toISOString()
        }
      ]
    }
  };
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
      hasUserQueries: !!(state.userCollaboration?.userQueries?.length)
    });

    // Find the query that was just responded to
    const respondedQuery = state.userCollaboration?.userQueries?.find(
      query => query.response && !query.responseTimestamp
    );

    if (!respondedQuery) {
      logger.warn("No responded query found for processing");
      return {
        currentStep: "feedback_processing_failed",
        errors: [
          ...(state.errors || []),
          "No user response found to process"
        ],
        lastUpdatedAt: new Date().toISOString()
      };
    }

    // Extract analysis context for feedback processing
    const analysisContext = {
      industry: state.planningIntelligence?.rfpCharacteristics?.industry,
      complexity: state.planningIntelligence?.rfpCharacteristics?.complexity,
      keyOpportunities: state.planningIntelligence?.earlyRiskAssessment?.strategicInsights?.keyOpportunities,
      riskCount: state.planningIntelligence?.earlyRiskAssessment?.riskIndicators?.length
    };

    // Process the feedback using LLM
    const feedbackAnalysis = await processFeedbackWithLLM(
      respondedQuery.response,
      respondedQuery.question,
      analysisContext
    );

    // Update collaboration state
    const collaborationUpdates = updateCollaborationState(
      state,
      feedbackAnalysis,
      respondedQuery
    );

    // Create response message based on feedback analysis
    let responseMessage = "";
    switch (feedbackAnalysis.sentiment) {
      case "satisfied":
        responseMessage = "✅ Great! I'll proceed with research planning based on this validated analysis.";
        break;
      case "needs_refinement":
        responseMessage = `🔧 I understand you'd like some adjustments. I'll refine the analysis focusing on: ${feedbackAnalysis.feedback_details.specific_suggestions.join(", ") || "your feedback"}.`;
        break;
      case "needs_restart":
        responseMessage = "🔄 I'll start the analysis fresh with a completely new approach.";
        break;
    }

    const updatedState: Partial<OverallProposalState> = {
      currentStep: "feedback_processed",
      ...collaborationUpdates,
      feedbackProcessing: {
        lastProcessedFeedback: feedbackAnalysis,
        processingTimestamp: new Date().toISOString(),
        nextAction: feedbackAnalysis.routing_decision,
        requiresLimitCheck: feedbackAnalysis.routing_decision === "refine_analysis" 
          && (collaborationUpdates.userCollaboration?.refinementIteration || 0) >= 3
      },
      messages: [
        ...state.messages,
        new AIMessage(responseMessage)
      ],
      interruptStatus: {
        isInterrupted: false,
        interruptionPoint: null,
        feedback: null,
        processingStatus: "completed"
      },
      lastUpdatedAt: new Date().toISOString()
    };

    logger.info("Feedback processing completed successfully", {
      sentiment: feedbackAnalysis.sentiment,
      nextAction: feedbackAnalysis.routing_decision,
      refinementCount: collaborationUpdates.userCollaboration?.refinementIteration,
      confidence: feedbackAnalysis.confidence_score
    });

    return updatedState;

  } catch (error) {
    logger.error("User feedback processor failed", { error });
    
    return {
      currentStep: "feedback_processing_failed",
      errors: [
        ...(state.errors || []),
        `Feedback processing failed: ${error instanceof Error ? error.message : "Unknown error"}`
      ],
      lastUpdatedAt: new Date().toISOString()
    };
  }
}

/**
 * Conditional edge function for routing after feedback processing
 */
export function routeAfterFeedbackProcessing(state: OverallProposalState): string {
  // Check for processing failures
  if (state.currentStep === "feedback_processing_failed" || state.errors?.length) {
    return "error_recovery";
  }

  // Check if refinement limit needs to be enforced
  if (state.feedbackProcessing?.requiresLimitCheck) {
    return "refinement_limit_handler";
  }

  // Route based on processed feedback decision
  const nextAction = state.feedbackProcessing?.lastProcessedFeedback?.routing_decision;
  
  switch (nextAction) {
    case "proceed_to_planning":
      return "research_planning";
    case "refine_analysis":
      return "analysis_refinement";
    case "restart_analysis":
      return "restart_analysis";
    default:
      logger.warn("Unknown routing decision from feedback processing", { nextAction });
      return "error_recovery";
  }
}

/**
 * Enhanced routing function for strategic validation checkpoint
 * Handles the flow between validation and feedback processing
 */
export function routeAfterStrategicValidation(state: OverallProposalState): string {
  // Check if we're waiting for user response (interrupted state)
  if (state.interruptStatus?.isInterrupted) {
    return "strategic_validation_checkpoint"; // Stay and wait
  }

  // Check if we have a new user response to process
  const hasUnprocessedResponse = state.userCollaboration?.userQueries?.some(
    query => query.response && !query.responseTimestamp
  );

  if (hasUnprocessedResponse) {
    return "user_feedback_processor";
  }

  // Check if validation is complete (all queries responded to)
  const allQueriesComplete = state.userCollaboration?.userQueries?.every(
    query => query.response && query.responseTimestamp
  );

  if (allQueriesComplete && state.currentStep === "strategic_validation_complete") {
    return "research_planning";
  }

  // Default: loop back to validation if unclear state
  return "strategic_validation_checkpoint";
}