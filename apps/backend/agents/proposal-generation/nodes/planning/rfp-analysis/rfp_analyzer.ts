/**
 * RFP Analyzer Node - Clean internal feedback loop following LangGraph best practices
 *
 * Key principles:
 * - interrupt() is NEVER in a try/catch block (GraphInterrupt must propagate)
 * - Separate error handling for specific operations (analysis, refinement)
 * - Clean JSON parsing with markdown cleanup
 * - Simple internal feedback loop
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
import { Command } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";

// Create simple logger to avoid import issues
const logger = {
  info: (message: string, meta?: any) =>
    console.log(`[INFO] ${message}`, meta || ""),
  error: (message: string, meta?: any) =>
    console.error(`[ERROR] ${message}`, meta || ""),
  warn: (message: string, meta?: any) =>
    console.warn(`[WARN] ${message}`, meta || ""),
};

// Initialize internal LLM with no-stream tag to prevent internal calls from streaming to UI
const internalLlm = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.3,
  maxTokens: 4000,
  tags: ["langsmith:nostream"], // Prevents internal LLM calls from appearing in message stream
});

// Initialize streaming LLM for user-facing responses
const streamingLlm = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.3,
  maxTokens: 4000,
  // No nostream tag - this will stream to the UI
});

// Schemas for structured outputs
const AnalysisSchema = z.object({
  complexity: z.enum(["Simple", "Medium", "Complex"]), // Match existing type
  keyInsights: z.array(z.string()).min(3).max(8),
  strategicRecommendations: z.array(z.string()).min(3).max(6),
  riskFactors: z.array(z.string()).min(2).max(5),
  nextSteps: z.array(z.string()).min(3).max(6),
  competitiveAdvantages: z.array(z.string()).max(5).optional(),
  complianceRequirements: z.array(z.string()).max(4).optional(),
});

const FeedbackIntentSchema = z.object({
  intent: z.enum(["approve", "refine", "reject"]),
  reasoning: z.string(),
  specificChanges: z.array(z.string()).optional(),
});

const ContextualQuestionSchema = z.object({
  question: z.string(),
  context: z.string(),
  suggestedActions: z.array(z.string()).min(2).max(4),
});

type RfpAnalysisResult = z.infer<typeof AnalysisSchema>;
type LocalFeedbackIntent = z.infer<typeof FeedbackIntentSchema>; // Renamed to avoid conflict
type ContextualQuestion = z.infer<typeof ContextualQuestionSchema>;

/**
 * Helper function to extract current analysis from state
 */
function getCurrentAnalysisFromState(
  state: typeof OverallProposalStateAnnotation.State
): RfpAnalysisResult | null {
  const rfpChars = state.planningIntelligence?.rfpCharacteristics;
  const riskAssess = state.planningIntelligence?.earlyRiskAssessment;

  if (!rfpChars) return null;

  // Reconstruct analysis from state structure
  return {
    complexity: rfpChars.complexity || "Medium",
    keyInsights: riskAssess?.strategicInsights?.keyOpportunities || [],
    strategicRecommendations:
      riskAssess?.strategicInsights?.requirementPriorities?.map(
        (rp) => rp.requirement
      ) || [],
    riskFactors: riskAssess?.riskIndicators?.map((ri) => ri.risk) || [],
    nextSteps: [], // Will be populated from strategic recommendations if available
    competitiveAdvantages:
      riskAssess?.strategicInsights?.competitiveFactors || [],
    complianceRequirements:
      rfpChars.submissionRequirements?.sectionsRequired || [],
  };
}

/**
 * Main RFP Analyzer Node with Command-based routing (following LangGraph best practices)
 */
export const rfpAnalyzerNode = async (
  state: typeof OverallProposalStateAnnotation.State,
  config?: LangGraphRunnableConfig
): Promise<Partial<typeof OverallProposalStateAnnotation.State> | Command> => {
  logger.info("[RFP Analyzer] Starting analysis");

  // Check if resuming from an interrupt with user feedback
  const resumeValue = config?.configurable?.resume_value;

  if (resumeValue) {
    logger.info("[RFP Analyzer] Resuming with user feedback", resumeValue);

    // Get current analysis from planningIntelligence
    const currentAnalysis = getCurrentAnalysisFromState(state);

    // Interpret the user feedback and route accordingly
    try {
      const feedbackIntent = await interpretUserFeedback(
        resumeValue,
        currentAnalysis
      );

      if (feedbackIntent.intent === "approve") {
        logger.info(
          "[RFP Analyzer] User approved analysis - proceeding to next phase"
        );
        return {
          planningIntelligence: {
            ...state.planningIntelligence,
            rfpCharacteristics: createRfpCharacteristics(currentAnalysis),
            earlyRiskAssessment: createEarlyRiskAssessment(currentAnalysis),
          },
          messages: [
            ...state.messages,
            new AIMessage(formatFinalAnalysis(currentAnalysis)),
          ],
          rfpProcessingStatus: ProcessingStatus.COMPLETE,
        };
      } else if (feedbackIntent.intent === "refine") {
        logger.info(
          "[RFP Analyzer] User requested refinement - routing to refinement"
        );
        return new Command({
          update: {
            intent: {
              command: "refine_analysis",
              requestDetails: resumeValue,
            },
          },
          goto: "strategicOptionsRefinement",
        });
      } else {
        logger.info(
          "[RFP Analyzer] User requested restart - restarting analysis"
        );
        // Clear previous analysis and start fresh
        return new Command({
          update: {
            planningIntelligence: {
              ...state.planningIntelligence,
              rfpCharacteristics: undefined,
              earlyRiskAssessment: undefined,
            },
            intent: {
              command: "restart_analysis",
              requestDetails: resumeValue,
            },
          },
          goto: "rfpAnalyzer",
        });
      }
    } catch (error) {
      logger.error("[RFP Analyzer] Failed to interpret feedback", error);
      // Fallback to strategic validation for manual handling
      return new Command({
        goto: "strategicValidationCheckpoint",
      });
    }
  }

  // Cache RFP content once
  const rfpContent = getRfpContent(state);
  if (!rfpContent) {
    logger.error("[RFP Analyzer] No RFP content available");
    return {
      messages: [
        ...state.messages,
        new AIMessage("No RFP document available for analysis."),
      ],
      errors: [
        ...(state.errors || []),
        "No RFP content available for analysis",
      ],
      rfpProcessingStatus: ProcessingStatus.ERROR,
    };
  }

  let analysis: RfpAnalysisResult;

  // Perform analysis (initial or refinement)
  try {
    const existingAnalysis = getCurrentAnalysisFromState(state);
    if (existingAnalysis) {
      logger.info("[RFP Analyzer] Refining existing analysis");
      analysis = await refineAnalysisWithFeedback(
        existingAnalysis,
        state.intent?.requestDetails || "Please improve the analysis",
        rfpContent
      );
    } else {
      logger.info("[RFP Analyzer] Performing initial analysis");
      analysis = await performInitialAnalysis(state);
    }
  } catch (error) {
    logger.error("[RFP Analyzer] Analysis failed", error);
    return {
      messages: [
        ...state.messages,
        new AIMessage("Failed to analyze RFP document. Please try again."),
      ],
      errors: [
        ...(state.errors || []),
        `RFP analysis failed: ${error.message}`,
      ],
      rfpProcessingStatus: ProcessingStatus.ERROR,
    };
  }

  // Generate streaming user-facing response
  const userFacingPrompt = `Present this RFP analysis to the user in a clear, professional format with a contextual follow-up question.

ANALYSIS DATA:
${JSON.stringify(analysis, null, 2)}

STAGE: ${getCurrentAnalysisFromState(state) ? "refined" : "initial"} analysis

Please format this as a comprehensive analysis report with:
1. Clear section headers
2. Bullet points for insights, recommendations, and risks
3. A contextual question asking what the user wants to do next

Make it conversational and professional. Ask if they want to proceed, refine, or start over.`;

  try {
    // Use streaming LLM for user-facing response
    const streamingResponse = await streamingLlm.invoke([
      { role: "user", content: userFacingPrompt },
    ]);

    // Update state with analysis data and streaming message
    return {
      planningIntelligence: {
        ...state.planningIntelligence,
        rfpCharacteristics: createRfpCharacteristics(analysis),
        earlyRiskAssessment: createEarlyRiskAssessment(analysis),
      },
      messages: [...state.messages, streamingResponse],
      rfpProcessingStatus: ProcessingStatus.COMPLETE,
    };
  } catch (error) {
    logger.error("[RFP Analyzer] Failed to generate streaming response", error);
    // Fallback to formatted static message
    const fallbackAnalysis = formatSimpleAnalysis(analysis);
    return {
      planningIntelligence: {
        ...state.planningIntelligence,
        rfpCharacteristics: createRfpCharacteristics(analysis),
        earlyRiskAssessment: createEarlyRiskAssessment(analysis),
      },
      messages: [
        ...state.messages,
        new AIMessage(`${fallbackAnalysis}\n\nHow would you like to proceed?`),
      ],
      rfpProcessingStatus: ProcessingStatus.COMPLETE,
    };
  }
};

/**
 * Perform initial RFP analysis with improved JSON parsing
 */
async function performInitialAnalysis(
  state: typeof OverallProposalStateAnnotation.State
): Promise<RfpAnalysisResult> {
  const rfpContent = getRfpContent(state);

  const analysisPrompt = `Analyze the following RFP document and provide a comprehensive strategic analysis.

RFP CONTENT:
${rfpContent}

Please provide your analysis in the following JSON format:
{
  "complexity": "Simple|Medium|Complex",
  "keyInsights": ["insight1", "insight2", "insight3"],
  "strategicRecommendations": ["rec1", "rec2", "rec3"],
  "riskFactors": ["risk1", "risk2"],
  "nextSteps": ["step1", "step2", "step3"],
  "competitiveAdvantages": ["advantage1", "advantage2"],
  "complianceRequirements": ["req1", "req2"]
}

Focus on strategic insights that will guide proposal development. Be specific and actionable.`;

  const response = await internalLlm.invoke([
    { role: "user", content: analysisPrompt },
  ]);

  // ✅ Clean potential markdown formatting from LLM response
  const cleanJsonResponse = (response.content as string)
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  try {
    const parsedContent = JSON.parse(cleanJsonResponse);
    const analysisResult = AnalysisSchema.parse(parsedContent);
    logger.info("[RFP Analyzer] Initial analysis completed successfully");
    return analysisResult;
  } catch (parseError) {
    logger.error("[RFP Analyzer] JSON parsing failed", {
      originalResponse: response.content,
      cleanedResponse: cleanJsonResponse,
      parseError: parseError.message,
    });
    throw new Error(`Failed to parse LLM response: ${parseError.message}`);
  }
}

/**
 * Format analysis with LLM-generated contextual question
 */
async function formatAnalysisWithContextualQuestion(
  analysis: RfpAnalysisResult,
  stage: "initial" | "refined"
): Promise<{ analysis: string; question: string }> {
  const formattedAnalysis = formatSimpleAnalysis(analysis);

  // Generate contextual question using LLM
  const questionPrompt = `Based on this RFP analysis, generate a contextual question for the user.

ANALYSIS STAGE: ${stage}
ANALYSIS SUMMARY:
- Complexity: ${analysis.complexity}
- Key Insights: ${analysis.keyInsights.slice(0, 3).join(", ")}
- Main Risks: ${analysis.riskFactors.slice(0, 2).join(", ")}

Generate a JSON response with a contextual question that helps the user understand what they should focus on:
{
  "question": "A specific, contextual question about the analysis",
  "context": "Brief context about why this question matters",
  "suggestedActions": ["action1", "action2", "action3"]
}`;

  try {
    const response = await internalLlm.invoke([
      { role: "user", content: questionPrompt },
    ]);
    const cleanResponse = (response.content as string)
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const questionData = ContextualQuestionSchema.parse(
      JSON.parse(cleanResponse)
    );

    return {
      analysis: formattedAnalysis,
      question: `${questionData.question}\n\n**Context:** ${questionData.context}\n\n**Suggested actions:**\n${questionData.suggestedActions.map((action) => `• ${action}`).join("\n")}`,
    };
  } catch (error) {
    // Fallback to simple question
    return {
      analysis: formattedAnalysis,
      question: `How does this ${stage} analysis look? Would you like me to proceed, refine any aspects, or start over?`,
    };
  }
}

/**
 * Format analysis in a simple, readable format
 */
function formatSimpleAnalysis(analysis: RfpAnalysisResult): string {
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
}`;
}

/**
 * Interpret user feedback to determine intent
 */
async function interpretUserFeedback(
  feedback: string,
  currentAnalysis: RfpAnalysisResult
): Promise<LocalFeedbackIntent> {
  const interpretPrompt = `Interpret the user's feedback about the RFP analysis.

USER FEEDBACK: "${feedback}"

CURRENT ANALYSIS SUMMARY:
- Complexity: ${currentAnalysis.complexity}
- Insights: ${currentAnalysis.keyInsights.length} insights provided
- Recommendations: ${currentAnalysis.strategicRecommendations.length} recommendations

Determine the user's intent and respond in JSON format:
{
  "intent": "approve|refine|reject",
  "reasoning": "explanation of why you chose this intent",
  "specificChanges": ["change1", "change2"] (only if intent is refine)
}

INTENT GUIDELINES:
- "approve": User is satisfied and wants to proceed
- "refine": User wants improvements/changes to current analysis
- "reject": User wants to completely start over`;

  const response = await internalLlm.invoke([
    { role: "user", content: interpretPrompt },
  ]);
  const cleanResponse = (response.content as string)
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  return FeedbackIntentSchema.parse(JSON.parse(cleanResponse));
}

/**
 * Refine analysis based on user feedback
 */
async function refineAnalysisWithFeedback(
  currentAnalysis: RfpAnalysisResult,
  feedback: string,
  rfpContent: string
): Promise<RfpAnalysisResult> {
  const refinementPrompt = `Refine the RFP analysis based on user feedback.

ORIGINAL RFP CONTENT:
${rfpContent}

CURRENT ANALYSIS:
${JSON.stringify(currentAnalysis, null, 2)}

USER FEEDBACK:
"${feedback}"

Please provide a refined analysis that addresses the user's feedback while maintaining the same JSON structure:
{
  "complexity": "Simple|Medium|Complex",
  "keyInsights": ["insight1", "insight2", "insight3"],
  "strategicRecommendations": ["rec1", "rec2", "rec3"],
  "riskFactors": ["risk1", "risk2"],
  "nextSteps": ["step1", "step2", "step3"],
  "competitiveAdvantages": ["advantage1", "advantage2"],
  "complianceRequirements": ["req1", "req2"]
}

Make specific improvements based on the feedback while keeping what works well.`;

  const response = await internalLlm.invoke([
    { role: "user", content: refinementPrompt },
  ]);
  const cleanResponse = (response.content as string)
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  return AnalysisSchema.parse(JSON.parse(cleanResponse));
}

/**
 * Format final analysis for state
 */
function formatFinalAnalysis(analysis: RfpAnalysisResult): string {
  return `✅ **RFP Analysis Approved**

${formatSimpleAnalysis(analysis)}

**Status:** Analysis complete and approved. Ready to proceed to strategic validation.`;
}

/**
 * Helper function to extract RFP content from state
 */
function getRfpContent(
  state: typeof OverallProposalStateAnnotation.State
): string {
  return state.rfpDocument?.text || "";
}

/**
 * Create RFP characteristics from analysis
 */
function createRfpCharacteristics(
  analysis: RfpAnalysisResult
): RfpCharacteristics {
  return {
    industry: "To be determined",
    specialization: "To be determined",
    complexity: analysis.complexity,
    complexityFactors: analysis.keyInsights,
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

/**
 * Create early risk assessment from analysis
 */
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
 * Simplified routing function - no longer needs complex logic
 * Always proceed to strategic validation since approval is handled internally
 */
export const routeAfterRfpAnalysis = (
  state: typeof OverallProposalStateAnnotation.State
): string => {
  logger.info(
    "[routeAfterRfpAnalysis] Analysis complete - proceeding to strategic validation"
  );

  // Check for errors
  if (state.rfpProcessingStatus === ProcessingStatus.ERROR) {
    return "complete";
  }

  // Analysis was approved internally, proceed to next phase
  return "strategic_validation";
};

// Keep existing export for backward compatibility
export const routeAfterAnalysis = routeAfterRfpAnalysis;
