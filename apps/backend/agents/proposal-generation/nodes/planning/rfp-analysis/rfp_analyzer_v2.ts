/**
 * RFP Analyzer V2 - LangGraph-native multi-agent implementation
 * Based on documented multi-agent multi-turn conversation pattern
 */

import { z } from "zod";
import { BaseMessage, AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import {
  MessagesAnnotation,
  Command,
  END
} from "@langchain/langgraph";
import { ProcessingStatus } from "@/state/modules/types.js";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { 
  createApprovalNode, 
  createRejectionNode
} from "@/lib/langgraph/common/hitl-nodes.js";
import { 
  createRFPSynthesisReviewFlow
} from "@/lib/langgraph/common/enhanced-hitl-nodes.js";
import { createModel } from "@/lib/llm/model-factory.js";

// Initialize LLMs
const model = createModel(undefined, {
  temperature: 0.3,
  maxTokens: 4000,
});

// Schema for structured output following documented pattern
const AnalysisOutputSchema = z.object({
  response: z.string().describe("The RFP analysis results formatted for the user"),
  goto: z.enum(["humanReview"]).describe("Always go to humanReview after analysis"),
});

/**
 * Call LLM with structured output following documented pattern
 */
function callAnalysisLlm(messages: BaseMessage[]) {
  return model.withStructuredOutput(AnalysisOutputSchema, { name: "AnalysisResponse" }).invoke(messages);
}

/**
 * Get RFP content from state
 */
function getRfpContent(state: typeof OverallProposalStateAnnotation.State): string | null {
  // Check document text
  if (state.rfpDocument?.text) {
    return state.rfpDocument.text;
  }
  
  // Check document metadata
  if (state.rfpDocument?.metadata?.raw) {
    return state.rfpDocument.metadata.raw;
  }
  
  return null;
}

/**
 * RFP Analyzer Node - Following documented pattern exactly
 */
export async function rfpAnalyzer(
  state: typeof OverallProposalStateAnnotation.State
): Promise<Command> {
  console.log("[RFP Analyzer V2] Starting analysis");

  // Check for RFP content
  const rfpContent = getRfpContent(state);
  if (!rfpContent) {
    const errorMsg = new AIMessage({
      content: "No RFP document found. Please upload an RFP document to analyze.",
      name: "rfpAnalyzer"
    });
    
    return new Command({
      goto: END,
      update: { 
        messages: [errorMsg],
        rfpProcessingStatus: ProcessingStatus.ERROR
      }
    });
  }

  // Check if this is a refinement
  const messages = state.messages;
  const hasAnalysis = messages.some(msg => 
    msg.name === "rfpAnalyzer" && msg instanceof AIMessage
  );
  
  const systemPrompt = hasAnalysis
    ? `You are an RFP analysis expert. The user has provided feedback on your previous analysis. 
       Refine your analysis based on their feedback. Consider the entire conversation history.`
    : `You are an RFP analysis expert. I have an RFP document that needs analysis. Please provide strategic insights.
       
       Start with a brief acknowledgment that you're analyzing the document, then provide:
       
       RFP Document:
       ${rfpContent}
       
       Analysis should include:
       1. Complexity assessment (Simple/Medium/Complex)
       2. Key insights (3-8 points)
       3. Strategic recommendations (3-6 points)  
       4. Risk factors (2-5 points)
       5. Next steps (3-6 points)
       
       Format as a clear, professional analysis report with an appropriate greeting.`;

  const llmMessages = [
    new SystemMessage(systemPrompt), 
    ...messages
  ];

  const response = await callAnalysisLlm(llmMessages);
  
  const aiMsg = new AIMessage({
    content: response.response,
    name: "rfpAnalyzer"
  });

  return new Command({
    goto: response.goto,
    update: { 
      messages: [aiMsg],
      currentStatus: "Analysis complete. Awaiting your feedback...",
      isAnalyzingRfp: false
    }
  });
}

/**
 * Enhanced HITL Flow for RFP Analysis Review - Uses natural language parsing with Q&A
 */
const rfpReviewFlow = createRFPSynthesisReviewFlow<typeof OverallProposalStateAnnotation.State>({
  reviewNodeName: "humanReview",
  routerNodeName: "feedbackRouter", 
  approvalNodeName: "approvalHandler",
  rejectionNodeName: "rejectionHandler",
  modificationNodeName: "rfpAnalyzer", // Route back to analyzer for modifications
  qaNodeName: "rfpQuestionAnswering", // Question answering node
  llm: model
});

// Export the nodes from the flow
export const humanReview = rfpReviewFlow.humanReview;
export const feedbackRouter = rfpReviewFlow.feedbackRouter;
export const rfpQuestionAnswering = rfpReviewFlow.qaNode;

/**
 * Approval Handler Node - Using reusable utility with dynamic responses
 */
export const approvalHandler = createApprovalNode<typeof OverallProposalStateAnnotation.State>({
  nodeName: "approvalHandler",
  llm: model,
  responsePrompt: "Generate a professional, enthusiastic confirmation that the RFP analysis has been approved and we're ready to move to the research planning phase. Keep it concise and natural.",
  nextNode: "researchPlanning",
  stateUpdates: {
    rfpProcessingStatus: ProcessingStatus.COMPLETE
  }
});

/**
 * Rejection Handler Node - Using reusable utility with dynamic responses
 */
export const rejectionHandler = createRejectionNode<typeof OverallProposalStateAnnotation.State>({
  nodeName: "rejectionHandler",
  llm: model,
  responsePrompt: "Generate a professional, understanding response acknowledging the user wants to start the RFP analysis fresh. Ask if they have any specific requirements or focus areas for the new analysis. Keep it natural and conversational.",
  nextNode: "rfpAnalyzer"
});