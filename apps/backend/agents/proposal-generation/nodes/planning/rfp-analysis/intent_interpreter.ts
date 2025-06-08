/**
 * Intent Interpreter - LLM-powered natural language feedback interpretation
 *
 * This module provides robust intent recognition for user feedback during RFP analysis.
 * It uses Claude to interpret natural language and determine user intent with fallback logic.
 *
 * Part of the modern LangGraph HITL pattern implementation.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { z } from "zod";

// Create simple logger to avoid import issues
const logger = {
  info: (message: string, meta?: any) =>
    console.log(`[INFO] ${message}`, meta || ""),
  error: (message: string, meta?: any) =>
    console.error(`[ERROR] ${message}`, meta || ""),
  warn: (message: string, meta?: any) =>
    console.warn(`[WARN] ${message}`, meta || ""),
};

// Intent recognition schema with validation
export const IntentSchema = z.object({
  intent: z.enum(["approve", "refine", "reject"]),
  reasoning: z.string(),
  specificChanges: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type FeedbackIntent = z.infer<typeof IntentSchema>;

// Analysis result type (should match the one in rfp_analyzer.ts)
export interface AnalysisResult {
  complexity: "Simple" | "Medium" | "Complex";
  keyInsights: string[];
  strategicRecommendations: string[];
  riskFactors: string[];
  nextSteps: string[];
  competitiveAdvantages?: string[];
  complianceRequirements?: string[];
}

/**
 * Configuration for intent interpretation
 */
export interface IntentInterpreterConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  enableCaching?: boolean;
  fallbackStrategy?: "conservative" | "optimistic";
}

const DEFAULT_CONFIG: Required<IntentInterpreterConfig> = {
  model: "claude-3-haiku-20240307",
  temperature: 0.1,
  maxTokens: 1000,
  enableCaching: false,
  fallbackStrategy: "conservative", // Default to "refine" when uncertain
};

/**
 * Cache for identical feedback interpretation (optional optimization)
 */
const interpretationCache = new Map<string, FeedbackIntent>();

/**
 * Main function to interpret user feedback and determine intent
 *
 * @param userFeedback - Raw feedback from user (can be any type from interrupt())
 * @param analysisContext - The analysis that the user is providing feedback on
 * @param config - Optional configuration for LLM calls
 * @returns Promise<FeedbackIntent> - The interpreted intent with reasoning
 */
export async function interpretUserFeedback(
  userFeedback: any,
  analysisContext: AnalysisResult,
  config: IntentInterpreterConfig = {}
): Promise<FeedbackIntent> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  logger.info("[Intent Interpreter] Starting feedback interpretation");

  // Convert userFeedback to string safely
  const feedbackString = normalizeFeedbackToString(userFeedback);

  if (!feedbackString.trim()) {
    logger.warn(
      "[Intent Interpreter] Empty feedback received, defaulting to refine"
    );
    return {
      intent: "refine",
      reasoning: "Empty feedback received - assuming user wants refinement",
      confidence: 0.1,
    };
  }

  // Check cache first (if enabled)
  const cacheKey = `${feedbackString.trim().toLowerCase()}_${JSON.stringify(analysisContext)}`;
  if (mergedConfig.enableCaching && interpretationCache.has(cacheKey)) {
    logger.info("[Intent Interpreter] Returning cached interpretation");
    return interpretationCache.get(cacheKey)!;
  }

  try {
    // Use LLM to interpret the feedback
    const intent = await performLLMInterpretation(
      feedbackString,
      analysisContext,
      mergedConfig
    );

    // Cache the result (if enabled)
    if (mergedConfig.enableCaching) {
      interpretationCache.set(cacheKey, intent);
    }

    logger.info("[Intent Interpreter] LLM interpretation completed", {
      intent: intent.intent,
      confidence: intent.confidence,
      reasoning: intent.reasoning?.substring(0, 100) + "...",
    });

    return intent;
  } catch (error) {
    logger.error(
      "[Intent Interpreter] LLM interpretation failed, using fallback",
      error
    );
    return performFallbackInterpretation(
      feedbackString,
      mergedConfig.fallbackStrategy
    );
  }
}

/**
 * Perform LLM-powered intent interpretation
 */
async function performLLMInterpretation(
  feedbackString: string,
  analysisContext: AnalysisResult,
  config: Required<IntentInterpreterConfig>
): Promise<FeedbackIntent> {
  const llm = new ChatAnthropic({
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  });

  const prompt = buildInterpretationPrompt(feedbackString, analysisContext);

  logger.info("[Intent Interpreter] Calling LLM for interpretation");
  const response = await llm.invoke([{ role: "user", content: prompt }]);

  // Parse and validate the response
  const responseContent = response.content as string;
  const parsedContent = JSON.parse(responseContent);
  const validatedIntent = IntentSchema.parse(parsedContent);

  return validatedIntent;
}

/**
 * Build the interpretation prompt for the LLM
 */
function buildInterpretationPrompt(
  feedbackString: string,
  analysisContext: AnalysisResult
): string {
  return `You are an expert at interpreting user feedback about RFP analysis. 
Analyze the user's feedback and determine their intent regarding the analysis.

ANALYSIS CONTEXT:
${JSON.stringify(analysisContext, null, 2)}

USER FEEDBACK: "${feedbackString}"

Determine the user's intent based on their feedback. Consider:

1. **APPROVE**: User is satisfied and wants to proceed to the next step
   - Keywords: "good", "looks great", "proceed", "approve", "yes", "perfect", "ready"
   - Sentiment: Positive, accepting, ready to move forward

2. **REFINE**: User wants improvements but likes the overall approach
   - Keywords: "focus more on", "add", "emphasize", "include", "consider", "what about"
   - Sentiment: Constructive, specific requests for changes

3. **REJECT**: User wants to start over completely or is very dissatisfied
   - Keywords: "start over", "completely wrong", "restart", "different approach", "no"
   - Sentiment: Negative, fundamental disagreement

Return your analysis in this JSON format:
{
  "intent": "approve" | "refine" | "reject",
  "reasoning": "Clear explanation of why you chose this intent based on the feedback",
  "specificChanges": ["list", "of", "specific", "changes", "requested"], // only if intent is "refine"
  "confidence": 0.95 // confidence score between 0 and 1
}

Be precise and consider the nuance of the user's language. When in doubt between approve and refine, choose refine.`;
}

/**
 * Normalize user feedback to string format
 */
function normalizeFeedbackToString(userFeedback: any): string {
  if (typeof userFeedback === "string") {
    return userFeedback;
  }

  if (userFeedback === null || userFeedback === undefined) {
    return "";
  }

  if (typeof userFeedback === "object") {
    // If it's an object, try to extract meaningful text
    if (userFeedback.text || userFeedback.content || userFeedback.message) {
      return userFeedback.text || userFeedback.content || userFeedback.message;
    }
    return JSON.stringify(userFeedback);
  }

  return String(userFeedback);
}

/**
 * Fallback interpretation when LLM fails
 */
function performFallbackInterpretation(
  feedbackString: string,
  fallbackStrategy: "conservative" | "optimistic"
): FeedbackIntent {
  logger.info("[Intent Interpreter] Performing fallback interpretation");

  const feedback = feedbackString.toLowerCase().trim();

  // Simple keyword-based fallback
  const approvalKeywords = [
    "good",
    "great",
    "proceed",
    "approve",
    "yes",
    "perfect",
    "ready",
    "ok",
    "fine",
  ];
  const rejectionKeywords = [
    "restart",
    "start over",
    "wrong",
    "no",
    "bad",
    "terrible",
    "completely different",
  ];

  const hasApprovalKeywords = approvalKeywords.some((keyword) =>
    feedback.includes(keyword)
  );
  const hasRejectionKeywords = rejectionKeywords.some((keyword) =>
    feedback.includes(keyword)
  );

  if (hasApprovalKeywords && !hasRejectionKeywords) {
    return {
      intent: "approve",
      reasoning: "Fallback interpretation detected approval keywords",
      confidence: 0.6,
    };
  }

  if (hasRejectionKeywords) {
    return {
      intent: "reject",
      reasoning: "Fallback interpretation detected rejection keywords",
      confidence: 0.7,
    };
  }

  // Default based on strategy
  if (fallbackStrategy === "optimistic") {
    return {
      intent: "approve",
      reasoning: "Optimistic fallback - assuming approval when uncertain",
      confidence: 0.3,
    };
  } else {
    return {
      intent: "refine",
      reasoning:
        "Conservative fallback - assuming refinement needed when uncertain",
      confidence: 0.4,
    };
  }
}

/**
 * Clear the interpretation cache (useful for testing or memory management)
 */
export function clearInterpretationCache(): void {
  interpretationCache.clear();
  logger.info("[Intent Interpreter] Cache cleared");
}

/**
 * Get cache statistics (useful for monitoring)
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: interpretationCache.size,
    keys: Array.from(interpretationCache.keys()),
  };
}

/**
 * Validate an analysis result structure (useful for testing)
 */
export function validateAnalysisResult(
  analysis: any
): analysis is AnalysisResult {
  try {
    // Simple validation - check for required fields
    return (
      analysis &&
      typeof analysis.complexity === "string" &&
      Array.isArray(analysis.keyInsights) &&
      Array.isArray(analysis.strategicRecommendations) &&
      Array.isArray(analysis.riskFactors) &&
      Array.isArray(analysis.nextSteps)
    );
  } catch {
    return false;
  }
}
