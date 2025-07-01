/**
 * Parallel Dispatcher Node for RFP Analysis
 * 
 * This node validates the RFP document, extracts metadata, and dispatches
 * analysis tasks to 4 specialized agents in parallel using LangGraph's Send API.
 * 
 * Replaces the simple rfp_analyzer_v2.ts with a sophisticated multi-agent approach.
 */

import { Send, LangGraphRunnableConfig } from "@langchain/langgraph";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { ProcessingStatus } from "@/state/modules/types.js";
import { createModel } from "@/lib/llm/model-factory.js";

// Schema for extracting company and industry information
const CompanyIndustrySchema = z.object({
  company: z.string().describe("The name of the company or organization issuing the RFP"),
  industry: z.string().describe("The industry or sector this RFP belongs to (e.g., Healthcare, Technology, Education, Government, Non-profit, etc.)"),
  confidence: z.number().min(0).max(1).describe("Confidence level in the extraction (0-1)")
});

// Initialize LLM for extraction
const extractionModel = createModel(undefined, {
  temperature: 0.1,
  maxTokens: 500,
});

/**
 * Validates and processes RFP document, then dispatches to parallel analysis agents
 */
export async function parallelDispatcherNode(
  state: typeof OverallProposalStateAnnotation.State,
  config?: LangGraphRunnableConfig
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
  company?: string;
  industry?: string;
}> {
  console.log("[RFP Parallel Dispatcher] Starting multi-agent RFP analysis");
  
  // Emit initial status
  if (config?.writer) {
    config.writer({
      message: "Initializing RFP analysis..."
    });
  }

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
    
    // Emit document analysis status
    if (config?.writer) {
      config.writer({
        message: `Analyzing ${complexity.toLowerCase()} RFP document (${wordCount.toLocaleString()} words)...`
      });
    }

    // Extract company and industry information
    console.log("[RFP Parallel Dispatcher] Extracting company and industry information");
    
    // Emit extraction status
    if (config?.writer) {
      config.writer({
        message: "Identifying organization and industry context..."
      });
    }
    
    let company = "";
    let industry = "";
    
    try {
      const llmWithSchema = extractionModel.withStructuredOutput(CompanyIndustrySchema);
      
      // Take first 3000 characters of RFP for extraction (usually contains key info)
      const rfpSample = rfpText.substring(0, 3000);
      
      const extractionResult = await llmWithSchema.invoke([{
        role: "system",
        content: `Extract the company/organization name and industry from this RFP document. 
Look for:
- Company names in headers, titles, or "issued by" sections
- Industry context from the project description and requirements
- Government agency names if it's a government RFP
- Non-profit organization names if applicable

If unsure about the exact company name, use the most specific organization mentioned.
If unsure about industry, infer from the context and type of work requested.`
      }, {
        role: "human",
        content: rfpSample
      }]);
      
      company = extractionResult.company;
      industry = extractionResult.industry;
      
      console.log(`[RFP Parallel Dispatcher] Extracted - Company: "${company}", Industry: "${industry}" (confidence: ${extractionResult.confidence})`);
      
    } catch (extractionError) {
      console.warn("[RFP Parallel Dispatcher] Failed to extract company/industry, using defaults:", extractionError);
      company = "Unknown Organization";
      industry = "General";
    }

    console.log(`[RFP Parallel Dispatcher] Prepared for dispatching to 4 parallel analysis agents`);
    
    // Emit dispatch status
    if (config?.writer) {
      config.writer({
        message: `Dispatching to specialized analysis agents for ${company}...`
      });
    }

    // Return state updates - parallel dispatching will be handled by router function
    return {
      rfpAnalysisId: analysisId,
      documentMetadata,
      rfpProcessingStatus: ProcessingStatus.RUNNING,
      isAnalyzingRfp: true,
      currentStatus: `Analyzing RFP document (${complexity} complexity, ${wordCount} words)...`,
      company,
      industry
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