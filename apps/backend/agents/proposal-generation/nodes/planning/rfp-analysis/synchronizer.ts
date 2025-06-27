/**
 * RFP Analysis Synchronizer Node
 * 
 * Ensures all parallel analysis agents have completed before synthesis.
 * Handles partial failures and provides retry capability.
 */

import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { LangGraphRunnableConfig, Command } from "@langchain/langgraph";

/**
 * Synchronizer node that checks completion of all RFP analysis agents
 * and handles failures gracefully.
 */
export async function rfpAnalysisSynchronizer(
  state: typeof OverallProposalStateAnnotation.State,
  config?: LangGraphRunnableConfig
): Promise<any> {
  console.log("[RFP Analysis Synchronizer] Checking analysis completion status");

  const {
    rfpAnalysisCompletion = {
      linguistic: false,
      requirements: false,
      structure: false,
      strategic: false,
    },
    rfpAnalysisFailures = [],
    rfpAnalysisRetryCount = 0,
    linguisticAnalysis,
    requirementsAnalysis,
    structureAnalysis,
    strategicAnalysis,
  } = state;

  // Check which analyses are complete
  const completionStatus = {
    linguistic: rfpAnalysisCompletion.linguistic || !!linguisticAnalysis,
    requirements: rfpAnalysisCompletion.requirements || !!requirementsAnalysis,
    structure: rfpAnalysisCompletion.structure || !!structureAnalysis,
    strategic: rfpAnalysisCompletion.strategic || !!strategicAnalysis,
  };

  // Determine missing analyses
  const missingAnalyses = Object.entries(completionStatus)
    .filter(([_, complete]) => !complete)
    .map(([name]) => name);

  const allComplete = missingAnalyses.length === 0;

  console.log("[RFP Analysis Synchronizer] Completion status:", completionStatus);
  console.log(`[RFP Analysis Synchronizer] Missing analyses: ${missingAnalyses.join(", ") || "None"}`);
  console.log(`[RFP Analysis Synchronizer] Failures reported: ${rfpAnalysisFailures.length}`);

  // If all complete, proceed to synthesis
  if (allComplete) {
    console.log("[RFP Analysis Synchronizer] All analyses complete - proceeding to synthesis");
    return {
      currentStatus: "All RFP analyses complete - ready for synthesis",
      readyForSynthesis: true,
    };
  }

  // Handle partial completion
  const MAX_RETRIES = 2;
  
  // If we haven't exceeded retry limit and have missing analyses, retry them
  if (rfpAnalysisRetryCount < MAX_RETRIES && missingAnalyses.length > 0) {
    console.log(
      `[RFP Analysis Synchronizer] Retrying failed analyses (attempt ${rfpAnalysisRetryCount + 1}/${MAX_RETRIES})`
    );

    // Map missing analyses to their agent names for retry
    const retryAgents = missingAnalyses.map(analysis => {
      switch (analysis) {
        case "linguistic":
          return "linguisticPatterns";
        case "requirements":
          return "requirementsExtraction";
        case "structure":
          return "documentStructure";
        case "strategic":
          return "strategicSignals";
        default:
          return null;
      }
    }).filter(Boolean) as string[];

    // Route back to dispatcher for retry
    return new Command({
      goto: "parallelDispatcher",
      update: {
        rfpAnalysisRetryAgents: retryAgents,
        rfpAnalysisRetryCount: rfpAnalysisRetryCount + 1,
        currentStatus: `Retrying ${missingAnalyses.length} failed analyses`,
      },
    });
  }

  // If retries exhausted or no retries needed, proceed with partial results
  console.log("[RFP Analysis Synchronizer] Proceeding with partial results");
  
  // Create a partial synthesis strategy
  const completedAnalyses = Object.entries(completionStatus)
    .filter(([_, complete]) => complete)
    .map(([name]) => name);

  const partialSynthesisMetadata = {
    completedAnalyses,
    missingAnalyses,
    totalFailures: rfpAnalysisFailures.length,
    retriesAttempted: rfpAnalysisRetryCount,
    fallbackMode: true,
  };

  // Add the partial synthesis metadata to state
  return {
    currentStatus: `Proceeding with partial synthesis - ${completedAnalyses.length}/4 analyses complete`,
    readyForSynthesis: true,
    partialSynthesisMetadata,
    synthesisAnalysis: {
      partial: true,
      metadata: partialSynthesisMetadata,
    },
  };
}

/**
 * Helper function to determine if we should skip synthesis entirely
 */
export function shouldSkipSynthesis(state: typeof OverallProposalStateAnnotation.State): boolean {
  const {
    linguisticAnalysis,
    requirementsAnalysis,
    structureAnalysis,
    strategicAnalysis,
  } = state;

  // Count how many analyses we have
  const availableAnalyses = [
    linguisticAnalysis,
    requirementsAnalysis,
    structureAnalysis,
    strategicAnalysis,
  ].filter(Boolean).length;

  // Skip synthesis if we have less than 2 analyses
  // (not enough data to synthesize meaningfully)
  return availableAnalyses < 2;
}

/**
 * Create a fallback synthesis for critical failures
 */
export function createFallbackSynthesis(
  state: typeof OverallProposalStateAnnotation.State
): Record<string, any> {
  const availableAnalyses = [];
  
  if (state.linguisticAnalysis) availableAnalyses.push("linguistic");
  if (state.requirementsAnalysis) availableAnalyses.push("requirements");
  if (state.structureAnalysis) availableAnalyses.push("structure");
  if (state.strategicAnalysis) availableAnalyses.push("strategic");

  return {
    synthesisType: "fallback",
    availableAnalyses,
    criticalFindings: {
      requirements: state.requirementsAnalysis?.explicit_requirements || [],
      riskFactors: state.strategicAnalysis?.risk_factors || [],
      winThemes: state.strategicAnalysis?.win_theme_signals || [],
    },
    recommendation: "Manual review recommended due to incomplete analysis",
    confidence: 0.3,
  };
}