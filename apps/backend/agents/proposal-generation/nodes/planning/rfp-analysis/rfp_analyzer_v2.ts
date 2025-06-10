/**
 * RFP Analyzer V2 - LangGraph-native multi-agent implementation
 * Based on documented multi-agent multi-turn conversation pattern
 */

import { z } from "zod";
import { ChatAnthropic } from "@langchain/anthropic";
import { BaseMessage, AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import {
  MessagesAnnotation,
  Command,
  interrupt,
  END
} from "@langchain/langgraph";
import { ProcessingStatus } from "@/state/modules/types.js";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";

// Initialize LLMs
const model = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.3,
  maxTokens: 4000,
});

// Schema for structured output following documented pattern
const AnalysisOutputSchema = z.object({
  response: z.string().describe("The RFP analysis results formatted for the user"),
  goto: z.enum(["humanReview"]).describe("Always go to humanReview after analysis"),
});

const FeedbackIntentSchema = z.object({
  response: z.string().describe("Response to user about their feedback"),
  goto: z.enum(["approve", "refine", "reject"]).describe("User's intent based on their feedback"),
});

/**
 * Call LLM with structured output following documented pattern
 */
function callAnalysisLlm(messages: BaseMessage[]) {
  return model.withStructuredOutput(AnalysisOutputSchema, { name: "AnalysisResponse" }).invoke(messages);
}

function callFeedbackLlm(messages: BaseMessage[]) {
  return model.withStructuredOutput(FeedbackIntentSchema, { name: "FeedbackResponse" }).invoke(messages);
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
 * Human Review Node - Following documented pattern exactly
 */
export function humanReview(
  state: typeof OverallProposalStateAnnotation.State
): Command {
  const userInput: string = interrupt("Ready for your feedback on the analysis.");
  
  return new Command({
    goto: "feedbackRouter",
    update: {
      messages: [
        new HumanMessage(userInput)
      ]
    }
  });
}

/**
 * Feedback Router Node - Interprets user intent
 */
export async function feedbackRouter(
  state: typeof OverallProposalStateAnnotation.State
): Promise<Command> {
  const systemPrompt = 
    "You are analyzing user feedback about an RFP analysis. " +
    "Determine if they want to: approve (satisfied), refine (want changes), or reject (start over). " +
    "Respond naturally acknowledging their feedback.";

  const messages = [
    new SystemMessage(systemPrompt),
    ...state.messages
  ];

  const response = await callFeedbackLlm(messages);
  
  const aiMsg = new AIMessage({
    content: response.response,
    name: "feedbackRouter"
  });

  let goto: string = response.goto;
  if (goto === "approve") {
    goto = "approvalHandler";
  } else if (goto === "reject") {
    goto = "rejectionHandler";
  } else {
    goto = "rfpAnalyzer"; // refine goes back to analyzer
  }

  return new Command({
    goto,
    update: { messages: [aiMsg] }
  });
}

/**
 * Approval Handler Node
 */
export async function approvalHandler(
  state: typeof OverallProposalStateAnnotation.State
): Promise<Command> {
  const aiMsg = new AIMessage({
    content: "✅ Analysis approved. Ready to proceed to research planning phase.",
    name: "approvalHandler"
  });

  return new Command({
    goto: "researchPlanning",
    update: { 
      messages: [aiMsg],
      rfpProcessingStatus: ProcessingStatus.COMPLETE
    }
  });
}

/**
 * Rejection Handler Node
 */
export async function rejectionHandler(
  state: typeof OverallProposalStateAnnotation.State
): Promise<Command> {
  const aiMsg = new AIMessage({
    content: "Starting fresh analysis. Please provide any specific requirements for the new analysis.",
    name: "rejectionHandler"
  });

  return new Command({
    goto: "rfpAnalyzer",
    update: { 
      messages: [aiMsg]
    }
  });
}