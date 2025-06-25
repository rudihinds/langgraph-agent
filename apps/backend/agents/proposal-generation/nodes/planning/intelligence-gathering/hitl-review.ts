/**
 * Intelligence Gathering HITL Review Nodes
 * 
 * Human-in-the-loop review nodes for intelligence gathering results.
 * Presents the synthesized intelligence briefing to the user for review.
 */

import { interrupt, Command } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { ProcessingStatus } from "@/state/modules/types.js";

// Initialize LLM for response generation
const model = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.3,
  maxTokens: 2000,
});

/**
 * Intelligence Gathering Human Review Node
 * 
 * Simply presents the intelligence synthesis to the user for review
 */
export async function intelligenceGatheringHumanReview(
  state: typeof OverallProposalStateAnnotation.State
) {
  console.log("[Intelligence HITL Review] Presenting intelligence synthesis for review");
  
  // Interrupt with the synthesis for user review
  const userInput = interrupt({
    type: "intelligence_gathering_review",
    question: "Please review the intelligence gathering results and executive briefing. How would you like to proceed?",
    options: ["approve", "modify", "ask_question", "research_other_targets", "reject"],
    data: {
      intelligenceSynthesis: state.intelligenceSynthesis || "Intelligence synthesis not available",
      summaryStats: {
        company: state.intelligenceBriefing?.customer_context?.company,
        industry: state.intelligenceBriefing?.customer_context?.industry,
        initiativesCount: state.intelligenceBriefing?.customer_context?.recent_initiatives?.length || 0,
        vendorsCount: state.intelligenceBriefing?.vendor_landscape?.current_vendors?.length || 0,
        rfpsCount: state.intelligenceBriefing?.procurement_history?.recent_rfps?.length || 0,
        decisionMakersCount: state.intelligenceBriefing?.decision_makers?.length || 0
      }
    },
    timestamp: new Date().toISOString()
  });
  
  console.log("[Intelligence HITL Review] Received user input:", userInput);
  
  return {
    intelligenceHumanReview: {
      action: userInput.action || userInput,
      feedback: userInput.feedback || userInput,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Intelligence Gathering Feedback Router Node
 * 
 * Routes user feedback to appropriate handlers
 */
export async function intelligenceGatheringFeedbackRouter(
  state: typeof OverallProposalStateAnnotation.State
): Promise<Command> {
  console.log("[Intelligence Feedback Router] Processing user feedback");
  
  const action = state.intelligenceHumanReview?.action;
  
  // Simple routing based on action
  let nextNode: string;
  switch (action) {
    case "approve":
      nextNode = "intelligenceGatheringApprovalHandler";
      break;
    case "modify":
      nextNode = "intelligenceModificationAgent";
      break;
    case "ask_question":
      nextNode = "intelligenceGatheringQuestionAnswering";
      break;
    case "research_other_targets":
      nextNode = "customResearcherNode";
      break;
    case "reject":
      nextNode = "intelligenceGatheringRejectionHandler";
      break;
    default:
      console.log(`[Intelligence Feedback Router] Unrecognized action: ${action}, defaulting to modification`);
      nextNode = "intelligenceModificationAgent";
  }
  
  return new Command({
    goto: nextNode,
    update: {
      currentStatus: `Routing to ${nextNode} based on user ${action}`
    }
  });
}

/**
 * Approval Handler for Intelligence Gathering
 */
export async function intelligenceGatheringApprovalHandler(
  state: typeof OverallProposalStateAnnotation.State
): Promise<Command> {
  console.log("[Intelligence Approval] Processing approval");
  
  const response = await model.invoke([
    {
      role: "system",
      content: "Generate a brief, enthusiastic confirmation that intelligence gathering is approved. Mention readiness for next phase."
    },
    {
      role: "user",
      content: `The user approved the intelligence briefing for ${state.company} in ${state.industry}. Acknowledge and indicate we're ready for team assembly.`
    }
  ]);
  
  return new Command({
    goto: "complete", // TODO: Replace with team assembly when implemented
    update: {
      intelligenceGatheringStatus: ProcessingStatus.COMPLETE,
      currentStatus: "Intelligence gathering approved",
      messages: [{
        role: "assistant" as const,
        content: response.content
      }]
    }
  });
}

/**
 * Rejection Handler for Intelligence Gathering
 */
export async function intelligenceGatheringRejectionHandler(
  _state: typeof OverallProposalStateAnnotation.State
): Promise<Command> {
  console.log("[Intelligence Rejection] Processing rejection");
  
  const response = await model.invoke([
    {
      role: "system",
      content: "Generate a brief response acknowledging rejection. Ask what to improve and offer to restart with refined focus."
    },
    {
      role: "user",
      content: "The user rejected the intelligence briefing. Ask what needs improvement."
    }
  ]);
  
  return new Command({
    goto: "intelligenceGatheringAgent",
    update: {
      intelligenceGatheringStatus: ProcessingStatus.QUEUED,
      intelligenceBriefing: undefined, // Clear previous results
      intelligenceSynthesis: undefined,
      currentStatus: "Restarting intelligence gathering",
      messages: [{
        role: "assistant" as const,
        content: response.content
      }]
    }
  });
}

/**
 * Question Answering Handler for Intelligence Gathering
 */
export async function intelligenceGatheringQuestionAnswering(
  state: typeof OverallProposalStateAnnotation.State
): Promise<Command> {
  console.log("[Intelligence Q&A] Processing user question");
  
  const userQuestion = state.intelligenceHumanReview?.feedback || "";
  
  if (!userQuestion) {
    return new Command({
      goto: "intelligenceGatheringHumanReview",
      update: {
        currentStatus: "No question provided",
        messages: [{
          role: "assistant" as const,
          content: "I didn't receive a question. Please let me know what you'd like to know about the intelligence briefing."
        }]
      }
    });
  }
  
  // Answer based on the synthesis and raw data
  const response = await model.invoke([
    {
      role: "system",
      content: "Answer questions about the intelligence briefing. Use both the executive synthesis and raw data to provide comprehensive answers."
    },
    {
      role: "user",
      content: `Question: ${userQuestion}

Executive Synthesis:
${state.intelligenceSynthesis}

Raw Intelligence Data:
${JSON.stringify(state.intelligenceBriefing, null, 2)}`
    }
  ]);
  
  return new Command({
    goto: "intelligenceGatheringHumanReview",
    update: {
      currentStatus: "Answered user question",
      messages: [{
        role: "assistant" as const,
        content: `## 💬 Intelligence Q&A

**Your Question**: ${userQuestion}

${response.content}

Would you like to ask another question or proceed with your review?`
      }]
    }
  });
}