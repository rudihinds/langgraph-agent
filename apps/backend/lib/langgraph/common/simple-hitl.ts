/**
 * Simple HITL utilities following native LangGraph.js patterns
 * 
 * Provides minimal, reusable functions for human-in-the-loop workflows
 * using only defined state fields and LangGraph primitives.
 */

import { interrupt, Command } from "@langchain/langgraph";
import { z } from "zod";

// Schema for intent detection
const IntentSchema = z.object({
  intent: z.enum(["approve", "refine", "reject", "ask_question"]),
  reasoning: z.string().optional()
});

// Configuration interfaces
export interface InterruptNodeConfig {
  question: string;
  qaNodeName?: string;
  contextField?: string;
  fallbackQuestion?: string;
}

export interface IntentDetectorConfig {
  routeMap: Record<string, string>;
  qaNodeName?: string;
  contextHint?: string;
}

export interface ApprovalNodeConfig {
  llm: any;
  nextNode: string;
  statusMessage: string;
}

export interface QANodeConfig {
  llm: any;
  returnNode: string;
  contextExtractor: (state: any) => string;
}

/**
 * Creates a simple interrupt node that collects user feedback
 * Uses only existing state fields: userFeedback
 */
export function createInterruptNode(config: string | InterruptNodeConfig) {
  // Support legacy string parameter
  const nodeConfig: InterruptNodeConfig = typeof config === 'string' 
    ? { question: config } 
    : config;
    
  return function(state: any) {
    console.log(`[InterruptNode] === START INTERRUPT NODE EXECUTION ===`);
    console.log(`[InterruptNode] Node config:`, JSON.stringify(nodeConfig, null, 2));
    console.log(`[InterruptNode] Current state - isInHitlReview: ${state.isInHitlReview}, userFeedback: ${state.userFeedback}`);
    
    // Check if we just answered a question
    const lastMessage = state.messages?.[state.messages.length - 1];
    const justAnsweredQ = nodeConfig.qaNodeName && lastMessage?.name === nodeConfig.qaNodeName;
    
    const contextualQuestion = justAnsweredQ 
      ? (nodeConfig.fallbackQuestion || "Ready to proceed? Please choose your next action.")
      : nodeConfig.question;
    
    // Get context from configured field or default to synthesisAnalysis
    const contextField = nodeConfig.contextField || 'synthesisAnalysis';
    const context = state[contextField];
    
    console.log(`[InterruptNode] Calling interrupt() with question: "${contextualQuestion}"`);
    console.log(`[InterruptNode] interrupt() payload:`, JSON.stringify({
      question: contextualQuestion,
      context: context ? `[${contextField} content present]` : `[${contextField} is empty]`,
      timestamp: new Date().toISOString()
    }));
    
    const userInput = interrupt({
      question: contextualQuestion,
      context,
      timestamp: new Date().toISOString()
    });
    
    console.log(`[InterruptNode] interrupt() returned:`, userInput);
    console.log(`[InterruptNode] Type of userInput:`, typeof userInput);
    
    const result = {
      userFeedback: userInput // Use existing state field
    };
    
    console.log(`[InterruptNode] === END INTERRUPT NODE - Returning:`, result);
    
    return result;
  };
}

/**
 * Creates an intent detection node using LLM structured output
 * Uses existing state fields: feedbackIntent, currentStatus, userFeedback
 */
export function createIntentDetector(llm: any, config: IntentDetectorConfig) {
  return async function(state: any): Promise<Command> {
    console.log(`[IntentDetector] Starting intent detection`);
    console.log(`[IntentDetector] User feedback: "${state.userFeedback}"`);
    console.log(`[IntentDetector] Current state - isInHitlReview: ${state.isInHitlReview}`);
    console.log(`[IntentDetector] Full state keys:`, Object.keys(state));
    
    // If no userFeedback, we can't detect intent
    if (!state.userFeedback) {
      console.log(`[IntentDetector] WARNING: No userFeedback in state, cannot detect intent`);
      throw new Error("No userFeedback available for intent detection");
    }
    
    const llmWithSchema = llm.withStructuredOutput(IntentSchema);
    
    // Check conversation context
    const recentMessages = state.messages?.slice(-3) || [];
    const justAnsweredQuestion = config.qaNodeName && 
      recentMessages.some((m: any) => m.name === config.qaNodeName);
    
    const contextHint = config.contextHint || 'the content';
    
    console.log(`[IntentDetector] Just answered question: ${justAnsweredQuestion}`);
    console.log(`[IntentDetector] Recent message count: ${recentMessages.length}`);
    
    const result = await llmWithSchema.invoke([{
      role: "system",
      content: `Detect the user's intent from their message. Choose one:

- approve: User explicitly approves or accepts the content
- refine: User wants to MODIFY or CHANGE the content itself
- reject: User rejects the content and wants it redone
- ask_question: User is asking for CLARIFICATION, EXPLANATION, or MORE DETAILS (not requesting changes)

Important distinction:
- Use "ask_question" when the user wants to understand something better without changing it
- Use "refine" ONLY when the user explicitly wants to modify the actual content

Examples:
- "explain the win probability" → ask_question
- "tell me more about the risks" → ask_question
- "what does this assessment mean?" → ask_question
- "can you clarify the conclusion?" → ask_question
- "change the risk assessment to be more conservative" → refine
- "update the analysis to include X" → refine
- "modify the conclusion" → refine
- "make the opportunities section more detailed" → refine

${justAnsweredQuestion ? `Context: The user just received an answer to their question about ${contextHint}. They may now want to make a decision.` : ""}`
    }, {
      role: "human", 
      content: state.userFeedback
    }]);
    
    console.log(`[IntentDetector] Detected intent: ${result.intent}`);
    console.log(`[IntentDetector] Intent reasoning: ${result.reasoning}`);
    
    // Map intent to feedbackIntent field (refine = modify)
    const feedbackIntent = result.intent === "ask_question" ? "refine" : 
                          result.intent === "refine" ? "refine" : result.intent;
    
    // Use configured route map
    const targetNode = config.routeMap[result.intent];
    if (!targetNode) {
      console.error(`[IntentDetector] ERROR: No route configured for intent: ${result.intent}`);
      throw new Error(`No route configured for intent: ${result.intent}`);
    }
    
    console.log(`[IntentDetector] Routing to node: ${targetNode}`);
    console.log(`[IntentDetector] Setting feedbackIntent to: ${feedbackIntent}`);
    
    return new Command({
      goto: targetNode,
      update: {
        feedbackIntent, // Use existing field
        currentStatus: `Processing ${result.intent} request` // Use existing field
      }
    });
  };
}

/**
 * Creates a simple approval node that routes to next phase
 * Uses existing state fields: messages, currentStatus
 */
export function createApprovalNode(config: ApprovalNodeConfig) {
  return async function(state: any) {
    const message = await config.llm.invoke([{
      role: "system",
      content: "Generate a brief confirmation message for the user's approval."
    }, {
      role: "human",
      content: state.userFeedback || "Approved"
    }]);
    
    return new Command({
      goto: config.nextNode,
      update: {
        messages: [message],
        currentStatus: config.statusMessage
      }
    });
  };
}

/**
 * Creates a simple Q&A node that answers questions
 * Uses existing state fields: messages, currentStatus
 */
export function createQANode(config: QANodeConfig) {
  return async function(state: any) {
    const context = config.contextExtractor(state);
    
    const answer = await config.llm.invoke([{
      role: "system",
      content: `Answer the user's question based on this context:\n${context}`
    }, {
      role: "human",
      content: state.userFeedback
    }]);
    
    return new Command({
      goto: config.returnNode,
      update: {
        messages: [answer],
        currentStatus: "Answered question - please continue review"
      }
    });
  };
}

/**
 * USAGE EXAMPLES FOR OTHER STAGES:
 * 
 * 1. Section Review HITL:
 * ```typescript
 * export const sectionHumanReview = createInterruptNode({
 *   question: "Please review this section. You can approve, request modifications, reject, or ask questions.",
 *   qaNodeName: "sectionQuestionAnswering",
 *   contextField: "currentSection",
 *   fallbackQuestion: "Ready to proceed? You can approve, modify, reject, or ask another question about this section."
 * });
 * 
 * export const sectionFeedbackRouter = createIntentDetector(model, {
 *   routeMap: {
 *     "approve": "sectionApprovalHandler",
 *     "refine": "sectionModificationHandler",
 *     "reject": "sectionRejectionHandler",
 *     "ask_question": "sectionQuestionAnswering"
 *   },
 *   qaNodeName: "sectionQuestionAnswering",
 *   contextHint: "the section content"
 * });
 * ```
 * 
 * 2. Intelligence Review HITL:
 * ```typescript
 * export const intelligenceReview = createInterruptNode({
 *   question: "Please review the intelligence gathering results. You can approve to proceed, request more research, or ask questions.",
 *   qaNodeName: "intelligenceQA",
 *   contextField: "planningIntelligence",
 *   fallbackQuestion: "What would you like to do next with the intelligence findings?"
 * });
 * ```
 * 
 * 3. Final Proposal Review:
 * ```typescript
 * export const finalReview = createInterruptNode({
 *   question: "Please review the complete proposal. Ready to submit?",
 *   qaNodeName: "finalQA",
 *   contextField: "completeProposal",
 *   fallbackQuestion: "Any final changes before submission?"
 * });
 * ```
 */