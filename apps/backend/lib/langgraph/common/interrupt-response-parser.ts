/**
 * Interrupt Response Parser Utilities
 * 
 * Utilities for parsing natural language user responses to HITL interrupts
 * into structured decisions and actions.
 */

import { z } from "zod";
import { createModel } from "@/lib/llm/model-factory.js";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

// Initialize LLM for response parsing
const parsingModel = createModel(undefined, {
  temperature: 0.1, // Very low temperature for consistent parsing
  maxTokens: 1000,
});

// Base schema for interrupt responses
export const InterruptResponseSchema = z.object({
  action: z.string().describe("The primary action the user wants to take"),
  confidence: z.number().min(0).max(1).describe("Confidence in parsing accuracy"),
  feedback: z.string().optional().describe("Any specific feedback or comments from user"),
  reasoning: z.string().describe("Brief explanation of why this action was chosen"),
});

export type InterruptResponse = z.infer<typeof InterruptResponseSchema>;

// Schema for RFP synthesis responses specifically
export const RFPSynthesisResponseSchema = z.object({
  action: z.enum(["approve", "modify", "reject", "ask_question"]).describe("The user's decision on the RFP analysis"),
  confidence: z.number().min(0).max(1).describe("Confidence in parsing accuracy"),
  feedback: z.string().optional().describe("Specific feedback, modification requests, or question"),
  reasoning: z.string().describe("Brief explanation of why this action was chosen"),
  specific_requests: z.array(z.string()).optional().describe("Specific areas user wants modified"),
  is_question: z.boolean().optional().describe("Whether the user is asking a question"),
});

export type RFPSynthesisResponse = z.infer<typeof RFPSynthesisResponseSchema>;

// Schema for approval/rejection responses
export const ApprovalResponseSchema = z.object({
  action: z.enum(["approve", "reject", "request_changes"]).describe("The user's approval decision"),
  confidence: z.number().min(0).max(1).describe("Confidence in parsing accuracy"),
  feedback: z.string().optional().describe("Specific feedback or change requests"),
  reasoning: z.string().describe("Brief explanation of why this action was chosen"),
  urgency: z.enum(["high", "medium", "low"]).optional().describe("Urgency level if changes requested"),
});

export type ApprovalResponse = z.infer<typeof ApprovalResponseSchema>;

/**
 * Parse natural language response for RFP synthesis interrupts
 */
export async function parseRFPSynthesisResponse(
  userInput: string,
  synthesisContext?: string
): Promise<RFPSynthesisResponse> {
  const systemPrompt = `You are an expert at parsing user responses to RFP analysis reviews. 

The user has just reviewed a comprehensive RFP analysis and is providing feedback. 
Your job is to determine their intent and extract specific feedback.

Common response patterns:
- Approval: "looks good", "approve", "proceed", "perfect", "yes", "continue"
- Modification: "change X", "update Y", "add more detail", "revise", "modify", "improve"
- Rejection: "no", "reject", "start over", "redo", "completely wrong"
- Question: Contains "?", starts with question words (what, why, how, when, where, who, which, can you explain, tell me about)

IMPORTANT: If the user is asking a question (contains "?" or question patterns), always return action: "ask_question"
Be flexible with language variations and focus on the core intent.
If unclear and not a question, default to "modify" as it's the safest option.`;

  const humanPrompt = `Context: User is reviewing RFP analysis results.
${synthesisContext ? `Analysis Summary: ${synthesisContext}` : ''}

User Response: "${userInput}"

Parse this response to determine if they want to approve, modify, or reject the analysis.
Extract any specific feedback or modification requests.`;

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(humanPrompt)
  ];

  const structuredLlm = parsingModel.withStructuredOutput(RFPSynthesisResponseSchema, {
    name: "RFPSynthesisResponseParser"
  });

  try {
    const result = await structuredLlm.invoke(messages);
    console.log(`[Interrupt Parser] Parsed RFP response: ${result.action} (confidence: ${result.confidence})`);
    return result;
  } catch (error) {
    console.error("[Interrupt Parser] Failed to parse RFP response:", error);
    // Return safe default
    return {
      action: "modify",
      confidence: 0.3,
      feedback: userInput,
      reasoning: "Parsing failed, defaulting to modify with original text as feedback",
      specific_requests: [userInput]
    };
  }
}

/**
 * Parse natural language response for general approval interrupts
 */
export async function parseApprovalResponse(
  userInput: string,
  context?: string
): Promise<ApprovalResponse> {
  const systemPrompt = `You are an expert at parsing user responses to approval requests.

The user is responding to a request for approval/review of some content or decision.
Your job is to determine their intent and extract specific feedback.

Common response patterns:
- Approval: "approve", "yes", "looks good", "proceed", "accept", "confirm"
- Rejection: "no", "reject", "decline", "don't approve", "stop"
- Request Changes: "change X", "modify Y", "needs work", "revise", "update"

Be flexible with language variations and focus on the core intent.`;

  const humanPrompt = `Context: User is reviewing content for approval.
${context ? `Content Summary: ${context}` : ''}

User Response: "${userInput}"

Parse this response to determine if they want to approve, reject, or request changes.
Extract any specific feedback or change requests.`;

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(humanPrompt)
  ];

  const structuredLlm = parsingModel.withStructuredOutput(ApprovalResponseSchema, {
    name: "ApprovalResponseParser"
  });

  try {
    const result = await structuredLlm.invoke(messages);
    console.log(`[Interrupt Parser] Parsed approval response: ${result.action} (confidence: ${result.confidence})`);
    return result;
  } catch (error) {
    console.error("[Interrupt Parser] Failed to parse approval response:", error);
    // Return safe default
    return {
      action: "request_changes",
      confidence: 0.3,
      feedback: userInput,
      reasoning: "Parsing failed, defaulting to request_changes with original text as feedback"
    };
  }
}

/**
 * Parse natural language response with custom schema and valid actions
 */
export async function parseGenericInterruptResponse<T extends z.ZodSchema>(
  userInput: string,
  validActions: string[],
  customSchema: T,
  context?: string
): Promise<z.infer<T>> {
  const systemPrompt = `You are an expert at parsing user responses to interactive prompts.

The user is responding to a request and you need to parse their intent.
Valid actions for this context: ${validActions.join(", ")}

Be flexible with language variations and focus on the core intent.
If unclear, choose the most appropriate action from the valid options.`;

  const humanPrompt = `Context: ${context || "User is responding to an interactive prompt"}

User Response: "${userInput}"

Parse this response to determine their intent from the valid actions: ${validActions.join(", ")}
Extract any specific feedback or requests.`;

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(humanPrompt)
  ];

  const structuredLlm = parsingModel.withStructuredOutput(customSchema, {
    name: "GenericInterruptResponseParser"
  });

  try {
    const result = await structuredLlm.invoke(messages);
    console.log(`[Interrupt Parser] Parsed generic response with custom schema`);
    return result;
  } catch (error) {
    console.error("[Interrupt Parser] Failed to parse generic response:", error);
    throw error;
  }
}

/**
 * Simple intent extraction using pattern matching (fallback for when LLM isn't needed)
 */
export function extractSimpleIntent(userInput: string, validIntents: string[]): string {
  const lowerInput = userInput.toLowerCase();
  
  // Try exact matches first
  for (const intent of validIntents) {
    if (lowerInput.includes(intent.toLowerCase())) {
      return intent;
    }
  }
  
  // Try common synonyms
  const synonymMap: Record<string, string[]> = {
    "approve": ["yes", "good", "proceed", "accept", "confirm", "ok", "fine"],
    "reject": ["no", "bad", "stop", "decline", "cancel"],
    "modify": ["change", "update", "revise", "edit", "improve", "fix"],
    "retry": ["again", "retry", "redo", "repeat"],
    "help": ["help", "guide", "explain", "how", "what"]
  };
  
  for (const [intent, synonyms] of Object.entries(synonymMap)) {
    if (validIntents.includes(intent)) {
      for (const synonym of synonyms) {
        if (lowerInput.includes(synonym)) {
          return intent;
        }
      }
    }
  }
  
  // Default to first valid intent
  return validIntents[0];
}