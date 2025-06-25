/**
 * Intelligence Gathering HITL Review Nodes
 * 
 * Human-in-the-loop review nodes for intelligence gathering results using the reusable
 * HITL utilities for natural conversation flow with custom research and modification options.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { interrupt } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { ProcessingStatus } from "@/state/modules/types.js";
import {
  createHumanReviewNode,
  createFeedbackRouterNode,
  createApprovalNode,
  createRejectionNode
} from "@/lib/langgraph/common/hitl-nodes.js";

// Initialize LLM for HITL interactions
const model = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.3,
  maxTokens: 4000,
});

/**
 * Intelligence Gathering Human Review Node
 * 
 * Presents intelligence briefing results to user for review with options:
 * - approve: Continue to team assembly
 * - modify: Send to modification agent
 * - ask_question: Q&A flow
 * - research_other_targets: Custom research
 * - reject: Return to intelligence gathering
 */
export const intelligenceGatheringHumanReview = createHumanReviewNode<typeof OverallProposalStateAnnotation.State>({
  nodeName: "intelligenceGatheringHumanReview",
  llm: model,
  reviewPrompt: `Present the intelligence gathering results for user review.
    
    Highlight key findings from the intelligence briefing including:
    - Customer context and strategic initiatives
    - Current vendor landscape and competitive positioning
    - Procurement history and buying patterns
    - Key decision makers and stakeholders
    
    Explain that this intelligence will guide proposal strategy and positioning.
    Ask the user to review the findings and choose their next action.`,
  interruptConfig: {
    type: "intelligence_gathering_review",
    question: "Please review the intelligence gathering results. The briefing includes customer context, vendor landscape, procurement history, and decision maker analysis. How would you like to proceed?",
    options: ["approve", "modify", "ask_question", "research_other_targets", "reject"],
    dataExtractor: (state) => ({
      intelligenceBriefing: state.intelligenceBriefing,
      company: state.intelligenceBriefing?.customer_context?.company,
      industry: state.intelligenceBriefing?.customer_context?.industry,
      initiativesCount: state.intelligenceBriefing?.customer_context?.recent_initiatives?.length || 0,
      vendorsCount: state.intelligenceBriefing?.vendor_landscape?.current_vendors?.length || 0,
      rfpsCount: state.intelligenceBriefing?.procurement_history?.recent_rfps?.length || 0,
      decisionMakersCount: state.intelligenceBriefing?.decision_makers?.length || 0
    })
  }
});

/**
 * Intelligence Gathering Feedback Router Node
 * 
 * Routes user feedback to appropriate handlers based on their choice
 */
export const intelligenceGatheringFeedbackRouter = createFeedbackRouterNode<typeof OverallProposalStateAnnotation.State>({
  nodeName: "intelligenceGatheringFeedbackRouter",
  parserType: "intelligence_gathering",
  routingMap: {
    "approve": "intelligenceGatheringApprovalHandler",
    "modify": "intelligenceModificationAgent",
    "ask_question": "intelligenceGatheringQuestionAnswering",
    "research_other_targets": "customResearcherNode",
    "reject": "intelligenceGatheringRejectionHandler"
  },
  defaultRoute: "intelligenceModificationAgent",
  stateUpdater: (userInput) => ({
    intelligenceHumanReview: {
      action: userInput.action as any,
      feedback: userInput.feedback,
      timestamp: new Date().toISOString()
    }
  })
});

/**
 * Approval Handler for Intelligence Gathering
 * Confirms approval and routes to team assembly phase
 */
export const intelligenceGatheringApprovalHandler = createApprovalNode<typeof OverallProposalStateAnnotation.State>({
  nodeName: "intelligenceGatheringApprovalHandler",
  llm: model,
  responsePrompt: `Generate an enthusiastic, professional confirmation that the intelligence gathering has been approved.
    Reference the key intelligence insights discovered and express readiness to begin the team assembly phase.
    Mention that the intelligence will guide team selection and proposal strategy. Keep it concise and forward-looking.`,
  nextNode: "teamAssemblyNode", // Continue to next phase of proposal generation
  stateUpdates: {
    intelligenceGatheringStatus: ProcessingStatus.COMPLETE,
    currentPhase: "planning" as const
  }
});

/**
 * Rejection Handler for Intelligence Gathering
 * Handles rejection and returns to intelligence gathering
 */
export const intelligenceGatheringRejectionHandler = createRejectionNode<typeof OverallProposalStateAnnotation.State>({
  nodeName: "intelligenceGatheringRejectionHandler",
  llm: model,
  responsePrompt: `Generate a professional response acknowledging the rejection of the intelligence gathering results.
    Ask what specific aspects need to be improved and express readiness to conduct additional research.
    Offer to restart the intelligence gathering process with refined focus areas.`,
  nextNode: "intelligenceGatheringAgent", // Return to intelligence gathering
  stateUpdates: {
    intelligenceGatheringStatus: ProcessingStatus.QUEUED
  }
});

/**
 * Question Answering Handler for Intelligence Gathering
 * Handles user questions about the intelligence briefing
 */
export async function intelligenceGatheringQuestionAnswering(
  state: typeof OverallProposalStateAnnotation.State
): Promise<{
  currentStatus?: string;
  messages?: any[];
  errors?: string[];
}> {
  console.log("[Intelligence Q&A] Processing user question");
  
  try {
    const userQuestion = state.intelligenceHumanReview?.feedback || "";
    const intelligenceBriefing = state.intelligenceBriefing;
    
    if (!userQuestion) {
      throw new Error("No user question provided");
    }
    
    const systemPrompt = `You are an intelligence analyst answering questions about the intelligence briefing.
    
    Provide clear, specific answers based on the intelligence data. If the information isn't available
    in the briefing, clearly state that and suggest what additional research might be needed.
    
    Be concise but thorough in your responses.`;
    
    const humanPrompt = `User Question: ${userQuestion}
    
    Intelligence Briefing Context:
    ${JSON.stringify(intelligenceBriefing, null, 2)}
    
    Please answer the user's question based on the available intelligence data.`;
    
    const response = await model.invoke([
      { role: "system", content: systemPrompt },
      { role: "human", content: humanPrompt }
    ]);
    
    const answerContent = typeof response.content === "string" 
      ? response.content 
      : "I've processed your question about the intelligence briefing.";
    
    const answerMessage = {
      role: "assistant" as const,
      content: `## 💬 Intelligence Q&A Response

**Your Question**: ${userQuestion}

**Answer**: ${answerContent}

Would you like to ask another question, or are you ready to proceed with the intelligence briefing review?`
    };
    
    return {
      currentStatus: "Answered user question about intelligence briefing",
      messages: [answerMessage],
      errors: []
    };
    
  } catch (error) {
    console.error("[Intelligence Q&A] Error processing question:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error processing question";
    
    return {
      currentStatus: `Question answering failed: ${errorMessage}`,
      errors: [errorMessage]
    };
  }
}
