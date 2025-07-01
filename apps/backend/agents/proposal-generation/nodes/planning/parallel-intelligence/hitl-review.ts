/**
 * Intelligence Gathering HITL Review Nodes
 * 
 * Human-in-the-loop review nodes for intelligence gathering results.
 * Presents the synthesized intelligence briefing to the user for review.
 */

import { interrupt, Command } from "@langchain/langgraph";
import { z } from "zod";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { ProcessingStatus } from "@/state/modules/types.js";
import { createModel } from "@/lib/llm/model-factory.js";

// Initialize LLM for response generation and parsing
const model = createModel(undefined, {
  temperature: 0.3,
  maxTokens: 2000,
});

// Schema for parsing user feedback
const UserFeedbackSchema = z.object({
  action: z.enum(["approve", "modify", "ask_question", "research_other_targets", "reject"]),
  feedback: z.string().optional(),
});

/**
 * Intelligence Gathering Human Review Node
 * 
 * Interrupts execution to present the intelligence synthesis to the user for review.
 * Returns a Command to route to the feedback router.
 */
export function intelligenceGatheringHumanReview(
  state: typeof OverallProposalStateAnnotation.State
): Command {
  console.log("[Intelligence HITL Review] Presenting intelligence synthesis for review");
  
  // Create structured interrupt payload for the frontend
  const interruptPayload = {
    type: "intelligence_gathering_review",
    nodeName: "intelligenceGatheringHumanReview",
    question: "Please review the intelligence briefing above. How would you like to proceed?",
    options: ["approve", "modify", "ask_question", "research_other_targets", "reject"],
    data: {
      // Include summary stats for frontend display if needed
      summaryStats: {
        company: state.company || "Unknown",
        industry: state.industry || "Unknown",
        initiativesCount: state.intelligenceBriefing?.customer_context?.recent_initiatives?.length || 0,
        vendorsCount: state.intelligenceBriefing?.vendor_landscape?.current_vendors?.length || 0,
        rfpsCount: state.intelligenceBriefing?.procurement_history?.recent_rfps?.length || 0,
        decisionMakersCount: state.intelligenceBriefing?.decision_makers?.length || 0
      }
    },
    timestamp: new Date().toISOString()
  };
  
  // Interrupt and wait for user input
  const userInput = interrupt(interruptPayload);
  
  console.log("[Intelligence HITL Review] Received user input:", userInput);
  
  // Return Command to route to feedback router with user input
  return new Command({
    goto: "intelligenceGatheringFeedbackRouter",
    update: {
      userFeedback: userInput,
      currentStatus: "Processing user feedback from intelligence review"
    }
  });
}

/**
 * Intelligence Gathering Feedback Router Node
 * 
 * Parses user feedback using LLM with structured output and routes to appropriate handler.
 */
export async function intelligenceGatheringFeedbackRouter(
  state: typeof OverallProposalStateAnnotation.State
): Promise<Command> {
  console.log("[Intelligence Feedback Router] Processing user feedback");
  
  const userFeedback = state.userFeedback;
  
  if (!userFeedback) {
    console.warn("[Intelligence Feedback Router] No user feedback found");
    return new Command({
      goto: "intelligenceModificationAgent",
      update: {
        currentStatus: "No feedback provided - defaulting to modification"
      }
    });
  }
  
  let parsedFeedback: z.infer<typeof UserFeedbackSchema>;
  
  try {
    // If userFeedback is already structured, try to parse directly
    if (typeof userFeedback === 'object' && 'action' in userFeedback) {
      parsedFeedback = UserFeedbackSchema.parse(userFeedback);
    } else {
      // Use LLM to parse natural language feedback
      const llmWithSchema = model.withStructuredOutput(UserFeedbackSchema);
      
      const feedbackText = typeof userFeedback === 'string' 
        ? userFeedback 
        : JSON.stringify(userFeedback);
      
      parsedFeedback = await llmWithSchema.invoke([
        {
          role: "system",
          content: `Parse the user's feedback about the intelligence briefing. 
Extract their intended action and any additional feedback.

Actions:
- "approve": User accepts the intelligence and wants to proceed
- "modify": User wants to modify or refine the intelligence
- "ask_question": User has a question about the intelligence
- "research_other_targets": User wants to research additional targets
- "reject": User wants to start over

If the user provides natural language, infer their intent.`
        },
        {
          role: "user",
          content: feedbackText
        }
      ]);
    }
  } catch (error) {
    console.error("[Intelligence Feedback Router] Error parsing feedback:", error);
    
    // Default to modification if parsing fails
    parsedFeedback = {
      action: "modify",
      feedback: typeof userFeedback === 'string' ? userFeedback : JSON.stringify(userFeedback)
    };
  }
  
  // Save parsed feedback to state
  const intelligenceHumanReview = {
    action: parsedFeedback.action,
    feedback: parsedFeedback.feedback,
    timestamp: new Date().toISOString()
  };
  
  // Route based on action
  let nextNode: string;
  switch (parsedFeedback.action) {
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
  }
  
  console.log(`[Intelligence Feedback Router] Routing to ${nextNode} based on action: ${parsedFeedback.action}`);
  
  return new Command({
    goto: nextNode,
    update: {
      intelligenceHumanReview,
      currentStatus: `Processing ${parsedFeedback.action} request`
    }
  });
}

/**
 * Approval Handler for Intelligence Gathering
 * Routes to completion after generating confirmation message.
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
 * Clears previous results and routes back to intelligence agent.
 */
export async function intelligenceGatheringRejectionHandler(
  state: typeof OverallProposalStateAnnotation.State
): Promise<Command> {
  console.log("[Intelligence Rejection] Processing rejection");
  
  const feedback = state.intelligenceHumanReview?.feedback;
  
  const response = await model.invoke([
    {
      role: "system",
      content: "Generate a brief response acknowledging rejection. Ask what to improve and offer to restart with refined focus."
    },
    {
      role: "user",
      content: feedback 
        ? `The user rejected the intelligence briefing with feedback: "${feedback}"`
        : "The user rejected the intelligence briefing. Ask what needs improvement."
    }
  ]);
  
  return new Command({
    goto: "researchAgent",
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
 * Answers user questions and routes back to review.
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