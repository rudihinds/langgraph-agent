/**
 * Parallel Dispatcher Node for RFP Analysis
 * 
 * This node validates the RFP document, extracts metadata, and dispatches
 * analysis tasks to 4 specialized agents in parallel using LangGraph's Send API.
 * 
 * Replaces the simple rfp_analyzer_v2.ts with a sophisticated multi-agent approach.
 */

import { Send } from "@langchain/langgraph";
import { v4 as uuidv4 } from "uuid";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { ProcessingStatus } from "@/state/modules/types.js";

/**
 * Validates and processes RFP document, then dispatches to parallel analysis agents
 */
export async function parallelDispatcherNode(
  state: typeof OverallProposalStateAnnotation.State
): Promise<{
  rfpAnalysisId?: string;
  documentMetadata?: {
    wordCount: number;
    sectionCount: number;
    complexity: "Simple" | "Medium" | "Complex";
  };
  rfpProcessingStatus?: ProcessingStatus;
  isAnalyzingRfp?: boolean;
  currentStatus?: string;
  errors?: string[];
}> {
  console.log("[RFP Parallel Dispatcher] Starting multi-agent RFP analysis");

  try {
    // Validate RFP document exists and has content
    const rfpText = state.rfpDocument?.text;
    if (!rfpText || rfpText.length < 100) {
      console.error("[RFP Parallel Dispatcher] Invalid or missing RFP document");
      return {
        errors: ["Invalid or missing RFP document. Document must be at least 100 characters."],
        rfpProcessingStatus: ProcessingStatus.ERROR,
        isAnalyzingRfp: false,
        currentStatus: "RFP analysis failed - invalid document"
      };
    }

    // Extract document metadata for complexity assessment
    const wordCount = rfpText.split(/\s+/).filter(word => word.length > 0).length;
    const sectionCount = (rfpText.match(/^#+\s/gm) || []).length;
    
    // Determine complexity based on document size and structure
    let complexity: "Simple" | "Medium" | "Complex";
    if (wordCount > 15000 || sectionCount > 20) {
      complexity = "Complex";
    } else if (wordCount > 5000 || sectionCount > 10) {
      complexity = "Medium";
    } else {
      complexity = "Simple";
    }

    const analysisId = uuidv4();
    const documentMetadata = { wordCount, sectionCount, complexity };

    console.log(`[RFP Parallel Dispatcher] Document analysis: ${wordCount} words, ${sectionCount} sections, ${complexity} complexity`);
    console.log(`[RFP Parallel Dispatcher] Generated analysis ID: ${analysisId}`);

    console.log(`[RFP Parallel Dispatcher] Prepared for dispatching to 4 parallel analysis agents`);

    // Return state updates - parallel dispatching will be handled by router function
    return {
      rfpAnalysisId: analysisId,
      documentMetadata,
      rfpProcessingStatus: ProcessingStatus.RUNNING,
      isAnalyzingRfp: true,
      currentStatus: `Analyzing RFP document (${complexity} complexity, ${wordCount} words)...`
    };

  } catch (error) {
    console.error("[RFP Parallel Dispatcher] Unexpected error:", error);
    return {
      errors: [`RFP analysis initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      rfpProcessingStatus: ProcessingStatus.ERROR,
      isAnalyzingRfp: false,
      currentStatus: "RFP analysis failed - system error"
    };
  }
}