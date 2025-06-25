/**
 * Company Info HITL Collection Node
 * 
 * Collects missing company and industry information from the user
 * when the automated extraction from RFP fails.
 */

import { interrupt } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";
import { z } from "zod";
import { AIMessage } from "@langchain/core/messages";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";

// Schema for extracting company and industry from user response
const CompanyInfoResponseSchema = z.object({
  company: z.string().describe("The company or organization name provided by the user"),
  industry: z.string().describe("The industry or sector provided by the user"),
});

// LLM for parsing user response
const model = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.1,
  maxTokens: 500,
});

/**
 * HITL node for collecting company and industry information
 */
export async function companyInfoHitlCollection(
  state: typeof OverallProposalStateAnnotation.State
) {
  console.log("[Company Info HITL] Starting company/industry collection");
  
  const missing = [];
  if (!state.company || state.company === "Unknown Organization" || state.company === "") {
    missing.push("• The name of the company or organization issuing this RFP");
  }
  if (!state.industry || state.industry === "General" || state.industry === "Unknown Industry" || state.industry === "") {
    missing.push("• The industry or sector they operate in (e.g., Healthcare, Technology, Government, Education, etc.)");
  }
  
  const prompt = `I was unable to automatically determine some information from the RFP text. Could you please provide:

${missing.join('\n')}

This information will help me conduct more targeted intelligence gathering for your proposal.`;

  // Interrupt and wait for user response
  const userResponse = interrupt({
    question: prompt,
    context: state.rfpDocument?.text?.substring(0, 1000) || "RFP document not available",
    timestamp: new Date().toISOString()
  });
  
  console.log("[Company Info HITL] Received user response:", userResponse);
  
  return {
    userFeedback: userResponse
  };
}

/**
 * Process the user's response and extract company/industry info
 */
export async function companyInfoProcessor(
  state: typeof OverallProposalStateAnnotation.State
) {
  console.log("[Company Info Processor] Processing user response");
  
  try {
    const userResponse = state.userFeedback;
    if (!userResponse) {
      throw new Error("No user response available");
    }
    
    // Use LLM to extract structured information from natural language response
    const llmWithSchema = model.withStructuredOutput(CompanyInfoResponseSchema);
    
    const extraction = await llmWithSchema.invoke([{
      role: "system",
      content: `Extract the company name and industry from the user's response. 
If the user provides variations or multiple possibilities, choose the most specific one.
Common industry categories include: Healthcare, Technology, Education, Government, Financial Services, 
Manufacturing, Retail, Non-profit, Energy, Transportation, Telecommunications, etc.`
    }, {
      role: "human",
      content: String(userResponse)
    }]);
    
    console.log(`[Company Info Processor] Extracted - Company: "${extraction.company}", Industry: "${extraction.industry}"`);
    
    // Return updated state - edge will route to research agent
    return {
      company: extraction.company,
      industry: extraction.industry,
      currentStatus: `Starting intelligence gathering for ${extraction.company} in ${extraction.industry} sector`,
      messages: [new AIMessage({
        content: `Thank you! I'll now begin intelligence gathering for ${extraction.company} in the ${extraction.industry} sector.`,
        name: "companyInfoProcessor"
      })],
      userFeedback: undefined, // Clear user feedback after processing
    };
    
  } catch (error) {
    console.error("[Company Info Processor] Error processing user response:", error);
    
    // Fallback: return error state
    return {
      currentStatus: "Error processing response - please try again",
      messages: [new AIMessage({
        content: "I had trouble understanding your response. Could you please provide the company name and industry again?",
        name: "companyInfoProcessor"
      })],
      userFeedback: undefined,
      errors: [error instanceof Error ? error.message : "Failed to process company info"]
    };
  }
}