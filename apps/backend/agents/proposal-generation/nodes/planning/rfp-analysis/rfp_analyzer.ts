/**
 * RFP Analyzer Node - State-driven RFP analysis with natural language feedback
 * Follows modern LangGraph patterns: interrupt() for HITL and Command for external resume
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { interrupt } from "@langchain/langgraph";
import {
  LoadingStatus,
  ProcessingStatus,
  FeedbackAnalysis,
  UserCollaboration,
  RfpCharacteristics,
  EarlyRiskAssessment,
} from "@/state/modules/types.js";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { LangGraphRunnableConfig } from "@langchain/langgraph";

// Import the dedicated intent interpreter
import {
  interpretUserFeedback,
  type AnalysisResult,
  type FeedbackIntent,
} from "./intent_interpreter.js";

// Create simple logger to avoid import issues
const logger = {
  info: (message: string, meta?: any) =>
    console.log(`[INFO] ${message}`, meta || ""),
  error: (message: string, meta?: any) =>
    console.error(`[ERROR] ${message}`, meta || ""),
  warn: (message: string, meta?: any) =>
    console.warn(`[WARN] ${message}`, meta || ""),
};

// Analysis result schema - now using the type from intent_interpreter
const AnalysisSchema = z.object({
  complexity: z.enum(["Simple", "Medium", "Complex"]),
  keyInsights: z.array(z.string()),
  strategicRecommendations: z.array(z.string()),
  riskFactors: z.array(z.string()),
  nextSteps: z.array(z.string()),
  competitiveAdvantages: z.array(z.string()).optional(),
  complianceRequirements: z.array(z.string()).optional(),
});

type RfpAnalysisResult = z.infer<typeof AnalysisSchema>;

/**
 * Node function type for RFP analyzer with proper state handling
 */
type RfpAnalyzerNodeFunction = (
  state: typeof OverallProposalStateAnnotation.State,
  config?: LangGraphRunnableConfig
) => Promise<Partial<typeof OverallProposalStateAnnotation.State>>;

/**
 * Main RFP analyzer node - follows new state-driven pattern with natural language feedback
 *
 * Flow:
 * 1. Check if this is initial analysis or refinement
 * 2. Perform analysis (initial or refined based on feedback)
 * 3. Present analysis using interrupt() for natural language feedback
 * 4. Use dedicated intent interpreter to determine user intent
 * 5. Return state with analysis results and feedbackIntent for routing
 */
export const rfpAnalyzerNode: RfpAnalyzerNodeFunction = async (
  state: typeof OverallProposalStateAnnotation.State,
  config?: LangGraphRunnableConfig
) => {
  // Check if we're resuming from interrupt to avoid duplicate side effects
  const isResuming = !!config?.configurable?.resume_value;

  if (!isResuming) {
    logger.info("[RFP Analyzer] Starting analysis node");
  } else {
    logger.info("[RFP Analyzer] Resuming analysis node after user feedback");
  }

  const hasExistingAnalysis = !!state.planningIntelligence?.rfpCharacteristics;

  try {
    if (hasExistingAnalysis) {
      // This is a refinement - incorporate previous feedback
      logger.info(
        "[RFP Analyzer] Performing refinement based on user feedback"
      );
      const refinedAnalysis = await refineAnalysisWithUserFeedback(state);

      const userFeedback = interrupt({
        analysis: formatAnalysis(refinedAnalysis),
        question:
          "How does this refined analysis look? Any further changes needed?",
      });

      // Use the dedicated intent interpreter
      const intent = await interpretUserFeedback(
        userFeedback,
        refinedAnalysis as AnalysisResult
      );

      return {
        planningIntelligence: {
          ...state.planningIntelligence,
          rfpCharacteristics: createRfpCharacteristics(refinedAnalysis),
          earlyRiskAssessment: createEarlyRiskAssessment(refinedAnalysis),
        },
        feedbackIntent: intent.intent,
        messages: [
          ...state.messages,
          new AIMessage(formatAnalysis(refinedAnalysis)),
        ],
        rfpProcessingStatus: ProcessingStatus.COMPLETE,
        lastUpdatedAt: new Date().toISOString(),
      };
    } else {
      // Initial analysis
      logger.info("[RFP Analyzer] Performing initial analysis");
      const analysis = await performInitialAnalysis(state);

      // Present analysis and collect natural language feedback
      const userFeedback = interrupt({
        analysis: formatAnalysis(analysis),
        question:
          "Please review this RFP analysis. What would you like me to focus on or change?",
      });

      // Use the dedicated intent interpreter
      const intent = await interpretUserFeedback(
        userFeedback,
        analysis as AnalysisResult
      );

      return {
        planningIntelligence: {
          ...state.planningIntelligence,
          rfpCharacteristics: createRfpCharacteristics(analysis),
          earlyRiskAssessment: createEarlyRiskAssessment(analysis),
        },
        feedbackIntent: intent.intent, // "approve" | "refine" | "reject"
        messages: [...state.messages, new AIMessage(formatAnalysis(analysis))],
        rfpProcessingStatus: ProcessingStatus.COMPLETE,
        lastUpdatedAt: new Date().toISOString(),
      };
    }
  } catch (error) {
    logger.error("[RFP Analyzer] Analysis failed", error);
    return {
      messages: [
        ...state.messages,
        new AIMessage(
          "I encountered an error while analyzing the RFP document. Please try again or contact support if the issue persists."
        ),
      ],
      errors: [
        ...(state.errors || []),
        `RFP analysis failed: ${error.message}`,
      ],
      rfpProcessingStatus: ProcessingStatus.ERROR,
      feedbackIntent: "reject", // Indicate failure
    };
  }
};

/**
 * Perform initial RFP analysis
 */
async function performInitialAnalysis(
  state: typeof OverallProposalStateAnnotation.State
): Promise<RfpAnalysisResult> {
  logger.info("[RFP Analyzer] Starting initial analysis");

  // Get RFP content from state
  const rfpContent = getRfpContent(state);

  if (!rfpContent) {
    throw new Error("No RFP document found in state");
  }

  if (rfpContent.length < 100) {
    throw new Error("RFP document appears to be too short or empty");
  }

  // Initialize LLM
  const llm = new ChatAnthropic({
    model: "claude-3-haiku-20240307",
    temperature: 0.3,
    maxTokens: 2000,
  });

  // Enhanced analysis prompt
  const analysisPrompt = `You are an expert RFP analyst. Analyze this SPECIFIC RFP document and provide:

1. Complexity assessment (Simple/Medium/Complex)
2. Key insights about requirements and expectations
3. Strategic recommendations for the proposal response
4. Risk factors to consider
5. Next steps for proposal development
6. Competitive advantages to emphasize
7. Compliance requirements to address

IMPORTANT: Base your analysis on the ACTUAL CONTENT below, not generic responses.

RFP Content:
${rfpContent.substring(0, 8000)}${rfpContent.length > 8000 ? "..." : ""}

Respond with a structured analysis in JSON format matching this schema:
{
  "complexity": "Simple" | "Medium" | "Complex",
  "keyInsights": ["insight1", "insight2", ...],
  "strategicRecommendations": ["rec1", "rec2", ...],
  "riskFactors": ["risk1", "risk2", ...],
  "nextSteps": ["step1", "step2", ...],
  "competitiveAdvantages": ["advantage1", "advantage2", ...],
  "complianceRequirements": ["requirement1", "requirement2", ...]
}`;

  logger.info("[RFP Analyzer] Calling LLM for initial analysis");
  const response = await llm.invoke([
    { role: "user", content: analysisPrompt },
  ]);

  // Parse and validate response
  const jsonContent = response.content.toString();
  const parsedContent = JSON.parse(jsonContent);
  const analysisResult = AnalysisSchema.parse(parsedContent);

  logger.info("[RFP Analyzer] Initial analysis completed", {
    complexity: analysisResult.complexity,
    keyInsightsCount: analysisResult.keyInsights.length,
  });

  return analysisResult;
}

/**
 * Refine analysis based on user feedback from previous iteration
 */
async function refineAnalysisWithUserFeedback(
  state: typeof OverallProposalStateAnnotation.State
): Promise<RfpAnalysisResult> {
  logger.info("[RFP Analyzer] Starting analysis refinement");

  const rfpContent = getRfpContent(state);
  const previousAnalysis = state.planningIntelligence?.rfpCharacteristics;
  const lastFeedback = getLastUserFeedback(state);

  if (!rfpContent || !previousAnalysis || !lastFeedback) {
    // Fallback to initial analysis if we can't find previous context
    return performInitialAnalysis(state);
  }

  const llm = new ChatAnthropic({
    model: "claude-3-haiku-20240307",
    temperature: 0.3,
    maxTokens: 2000,
  });

  const refinementPrompt = `You are an expert RFP analyst refining your analysis based on user feedback.

ORIGINAL RFP CONTENT:
${rfpContent.substring(0, 6000)}${rfpContent.length > 6000 ? "..." : ""}

PREVIOUS ANALYSIS:
- Complexity: ${previousAnalysis.complexity}
- Key Insights: ${previousAnalysis.complexityFactors?.join(", ") || "None"}
- Strategic Focus: ${previousAnalysis.strategicFocus?.join(", ") || "None"}

USER FEEDBACK: "${lastFeedback}"

Based on the user's feedback, refine your analysis. Pay special attention to their concerns and requests.
Maintain the same JSON structure but update the content based on their feedback:

{
  "complexity": "Simple" | "Medium" | "Complex",
  "keyInsights": ["insight1", "insight2", ...],
  "strategicRecommendations": ["rec1", "rec2", ...],
  "riskFactors": ["risk1", "risk2", ...],
  "nextSteps": ["step1", "step2", ...],
  "competitiveAdvantages": ["advantage1", "advantage2", ...],
  "complianceRequirements": ["requirement1", "requirement2", ...]
}`;

  logger.info("[RFP Analyzer] Calling LLM for refinement");
  const response = await llm.invoke([
    { role: "user", content: refinementPrompt },
  ]);

  const jsonContent = response.content.toString();
  const parsedContent = JSON.parse(jsonContent);
  const refinedResult = AnalysisSchema.parse(parsedContent);

  logger.info("[RFP Analyzer] Analysis refinement completed", {
    complexity: refinedResult.complexity,
    refinedInsightsCount: refinedResult.keyInsights.length,
  });

  return refinedResult;
}

/**
 * Format analysis for user presentation
 */
function formatAnalysis(analysis: RfpAnalysisResult): string {
  return `## RFP Analysis Complete

**Complexity Assessment:** ${analysis.complexity}

**Key Insights:**
${analysis.keyInsights.map((insight) => `• ${insight}`).join("\n")}

**Strategic Recommendations:**
${analysis.strategicRecommendations.map((rec) => `• ${rec}`).join("\n")}

**Risk Factors to Consider:**
${analysis.riskFactors.map((risk) => `• ${risk}`).join("\n")}

**Recommended Next Steps:**
${analysis.nextSteps.map((step) => `• ${step}`).join("\n")}

${
  analysis.competitiveAdvantages?.length
    ? `**Competitive Advantages to Emphasize:**
${analysis.competitiveAdvantages.map((adv) => `• ${adv}`).join("\n")}
`
    : ""
}

${
  analysis.complianceRequirements?.length
    ? `**Compliance Requirements:**
${analysis.complianceRequirements.map((req) => `• ${req}`).join("\n")}
`
    : ""
}

I'm ready to help you develop your proposal response. What would you like to focus on first?`;
}

/**
 * Helper functions
 */
function getRfpContent(
  state: typeof OverallProposalStateAnnotation.State
): string {
  return state.rfpDocument?.text || state.rfpDocument?.metadata?.raw || "";
}

function getLastUserFeedback(
  state: typeof OverallProposalStateAnnotation.State
): string {
  const messages = state.messages || [];
  const lastHumanMessage = messages
    .filter((msg) => msg instanceof HumanMessage)
    .slice(-1)[0];

  return (lastHumanMessage?.content as string) || "";
}

function createRfpCharacteristics(
  analysis: RfpAnalysisResult
): RfpCharacteristics {
  return {
    complexity: analysis.complexity,
    complexityFactors: analysis.keyInsights,
    industry: "To be determined",
    specialization: "To be determined",
    contractValueEstimate: "To be determined",
    timelinePressure: "Medium",
    strategicFocus: analysis.strategicRecommendations,
    submissionRequirements: {
      pageLimit: "not_specified" as const,
      sectionsRequired: [],
      attachmentsNeeded: [],
    },
  };
}

function createEarlyRiskAssessment(
  analysis: RfpAnalysisResult
): EarlyRiskAssessment {
  return {
    riskIndicators: analysis.riskFactors.map((risk) => ({
      risk,
      severity: "Medium" as const,
      category: "Technical" as const,
    })),
    analysisConfidence: 0.7,
    requiresUserValidation: false,
  };
}

// Export default
export default rfpAnalyzerNode;

/**
 * Routing function to determine next step after RFP analysis - now uses feedbackIntent
 */
export const routeAfterAnalysis = (
  state: typeof OverallProposalStateAnnotation.State
): string => {
  logger.info("[routeAfterAnalysis] Determining next step");

  const intent = state.feedbackIntent;

  logger.info("[routeAfterAnalysis] Feedback intent:", intent);

  switch (intent) {
    case "approve":
      logger.info(
        "[routeAfterAnalysis] User approved - proceeding to strategic validation"
      );
      return "strategic_validation";
    case "refine":
    case "reject":
      logger.info(
        "[routeAfterAnalysis] User wants changes - looping back for refinement"
      );
      return "rfp_analyzer"; // Loop back for refinement
    default:
      logger.info(
        "[routeAfterAnalysis] No clear intent - defaulting to strategic validation"
      );
      return "strategic_validation"; // Safe fallback - let strategic validation handle it
  }
};

// Keep existing exports for backward compatibility during transition
export const routeAfterRfpAnalysis = routeAfterAnalysis;
