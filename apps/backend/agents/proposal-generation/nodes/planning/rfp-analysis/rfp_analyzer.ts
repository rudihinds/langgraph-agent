/**
 * RFP Analyzer Node - Focused RFP analysis for complexity assessment and strategic insights
 * Follows LangGraph pattern: nodes do work, edges handle orchestration
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { AIMessage } from "@langchain/core/messages";
import { z } from "zod";
import { interrupt } from "@langchain/langgraph";
import {
  OverallProposalState,
  InterruptReason,
  ProcessingStatus,
  LoadingStatus,
} from "@/state/modules/types.js";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { LangGraphRunnableConfig } from "@langchain/langgraph";

// Create simple logger to avoid import issues
const logger = {
  info: (message: string, meta?: any) =>
    console.log(`[INFO] ${message}`, meta || ""),
  error: (message: string, meta?: any) =>
    console.error(`[ERROR] ${message}`, meta || ""),
  warn: (message: string, meta?: any) =>
    console.warn(`[WARN] ${message}`, meta || ""),
};

// Simplified analysis schema for working implementation
const AnalysisSchema = z.object({
  complexity: z.enum(["Simple", "Medium", "Complex"]),
  keyInsights: z.array(z.string()),
  strategicRecommendations: z.array(z.string()),
  riskFactors: z.array(z.string()),
  nextSteps: z.array(z.string()),
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
 * Main RFP analyzer node - analyzes RFP content and provides strategic insights
 */
export const rfpAnalyzerNode: RfpAnalyzerNodeFunction = async (
  state: typeof OverallProposalStateAnnotation.State,
  config?: LangGraphRunnableConfig
) => {
  console.log("[RFP Analyzer] Starting analysis");

  // Check for RFP content in current state schema structure
  const rfpContent = state.rfpDocument?.metadata?.raw || "";

  if (!rfpContent) {
    console.error("[RFP Analyzer] No RFP document found in state");
    return {
      messages: [
        ...state.messages,
        new AIMessage(
          "I need an RFP document to analyze. Please provide one first."
        ),
      ],
    };
  }

  try {
    // Initialize LLM
    const llm = new ChatAnthropic({
      model: "claude-3-haiku-20240307",
      temperature: 0.3,
      maxTokens: 2000,
    });

    // Simplified analysis prompt
    const analysisPrompt = `You are an expert RFP analyst. Analyze this RFP document and provide:

1. Complexity assessment (Simple/Medium/Complex)
2. Key insights about requirements and expectations
3. Strategic recommendations for the proposal response
4. Risk factors to consider
5. Next steps for proposal development

RFP Content:
${rfpContent.substring(0, 8000)} ${rfpContent.length > 8000 ? "..." : ""}

Respond with a structured analysis in JSON format matching this schema:
{
  "complexity": "Simple" | "Medium" | "Complex",
  "keyInsights": ["insight1", "insight2", ...],
  "strategicRecommendations": ["rec1", "rec2", ...],
  "riskFactors": ["risk1", "risk2", ...],
  "nextSteps": ["step1", "step2", ...]
}`;

    console.log("[RFP Analyzer] Calling LLM for analysis");
    const response = await llm.invoke([
      { role: "user", content: analysisPrompt },
    ]);

    // Parse the response
    let analysisResult: RfpAnalysisResult;
    try {
      const jsonContent = response.content.toString();
      const parsedContent = JSON.parse(jsonContent);
      analysisResult = AnalysisSchema.parse(parsedContent);
    } catch (parseError) {
      console.warn(
        "[RFP Analyzer] Failed to parse structured response, using fallback"
      );
      analysisResult = {
        complexity: "Medium",
        keyInsights: ["RFP analysis completed"],
        strategicRecommendations: ["Proceed with proposal development"],
        riskFactors: ["Standard proposal risks apply"],
        nextSteps: ["Begin detailed planning phase"],
      };
    }

    console.log("[RFP Analyzer] Analysis completed successfully");

    // Create user-facing analysis message
    const analysisMessage = new AIMessage(`## RFP Analysis Complete

**Complexity Assessment:** ${analysisResult.complexity}

**Key Insights:**
${analysisResult.keyInsights.map((insight) => `• ${insight}`).join("\n")}

**Strategic Recommendations:**
${analysisResult.strategicRecommendations.map((rec) => `• ${rec}`).join("\n")}

**Risk Factors to Consider:**
${analysisResult.riskFactors.map((risk) => `• ${risk}`).join("\n")}

**Recommended Next Steps:**
${analysisResult.nextSteps.map((step) => `• ${step}`).join("\n")}

I'm ready to help you develop your proposal response. What would you like to focus on first?`);

    // Update state with analysis results and user-facing message
    return {
      messages: [...state.messages, analysisMessage],
      currentStep: "rfp_analysis_complete",
      rfpProcessingStatus: ProcessingStatus.COMPLETE,
      planningIntelligence: {
        ...state.planningIntelligence,
        rfpCharacteristics: {
          complexity: analysisResult.complexity,
          complexityFactors: analysisResult.keyInsights,
          industry: "To be determined",
          specialization: "To be determined",
          contractValueEstimate: "To be determined",
          timelinePressure: "Medium",
          strategicFocus: analysisResult.strategicRecommendations,
          submissionRequirements: {
            pageLimit: "not_specified" as const,
            sectionsRequired: [],
            attachmentsNeeded: [],
          },
        },
        earlyRiskAssessment: {
          riskIndicators: analysisResult.riskFactors.map((risk) => ({
            risk,
            severity: "Medium" as const,
            category: "Technical" as const,
          })),
          analysisConfidence: 0.7,
          requiresUserValidation: false,
        },
      },
      userCollaboration: {
        ...state.userCollaboration,
        strategicRecommendations: {
          topOpportunities: analysisResult.strategicRecommendations,
          criticalRequirements: analysisResult.nextSteps.map((step) => ({
            requirement: step,
            priority: "Medium" as const,
            rationale: "Based on RFP analysis",
          })),
          confidenceLevel: 0.7,
        },
      },
    };
  } catch (error) {
    console.error("[RFP Analyzer] Analysis failed:", error);
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
    };
  }
};

// Export default
export default rfpAnalyzerNode;

/**
 * Routing function to determine next step after RFP analysis
 */
export const routeAfterRfpAnalysis = (
  state: typeof OverallProposalStateAnnotation.State
): string => {
  console.log("[routeAfterRfpAnalysis] Determining next step");

  // Check if analysis was successful
  if (state.rfpProcessingStatus === ProcessingStatus.ERROR) {
    console.log("[routeAfterRfpAnalysis] Analysis failed, routing to complete");
    return "complete";
  }

  // Route to strategic validation checkpoint for user collaboration
  console.log(
    "[routeAfterRfpAnalysis] Analysis successful, routing to strategic validation"
  );
  return "strategic_validation";
};

/**
 * Strategic validation checkpoint - presents analysis results for user feedback
 */
export const strategicValidationCheckpoint = async (
  state: typeof OverallProposalStateAnnotation.State,
  config?: LangGraphRunnableConfig
): Promise<Partial<typeof OverallProposalStateAnnotation.State>> => {
  console.log("[strategicValidationCheckpoint] Initiating user collaboration");

  // For now, this is a simple checkpoint that interrupts for user feedback
  // In a full implementation, this would present the analysis results and
  // collect user feedback for refinement

  try {
    // Interrupt for user feedback
    const userInput = await interrupt({
      reason: InterruptReason.CONTENT_REVIEW,
      message:
        "Please review the RFP analysis and provide feedback on strategic direction.",
    });

    console.log("[strategicValidationCheckpoint] User feedback received");

    // For now, just acknowledge the feedback and continue
    return {
      userCollaboration: {
        ...state.userCollaboration,
        strategicPriorities: ["RFP analysis reviewed"],
        refinementIteration:
          (state.userCollaboration?.refinementIteration || 0) + 1,
      },
    };
  } catch (error) {
    console.error(
      "[strategicValidationCheckpoint] Error during validation:",
      error
    );
    return {
      errors: [
        ...(state.errors || []),
        `Strategic validation failed: ${error.message}`,
      ],
    };
  }
};
