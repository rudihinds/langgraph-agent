/**
 * This file implements the chat agent functionality for the proposal generation system.
 * It handles the conversation flow between the user and the AI, interprets user intents,
 * and routes the workflow to appropriate handlers based on those intents.
 *
 * Key components:
 * 1. chatAgentNode - The main function that processes messages and generates responses
 * 2. routeFromChatAgent - LangGraph-native routing function based on state data
 * 3. Helper functions for parsing and processing messages
 *
 * The system follows a structured workflow:
 * - Load an RFP document
 * - Perform research on the RFP
 * - Develop a solution approach
 * - Generate and refine proposal sections
 */

import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { Annotation, Command } from "@langchain/langgraph";
import { OverallProposalStateAnnotation } from "../../../state/modules/annotations.js";
import {
  interpretIntentTool,
  CommandSchemaType,
} from "../../../tools/interpretIntentTool.js";
import { z } from "zod";

/**
 * Safely parses JSON from a string input.
 * If parsing fails, returns a fallback object with an 'other' command.
 *
 * @param input - String to parse as JSON or any other value
 * @returns Parsed JSON object or fallback object
 */
function safeJSON(input: unknown): any {
  if (typeof input === "string") {
    try {
      return JSON.parse(input);
    } catch {
      console.error("Failed to parse JSON from input:", input);
      // Return fallback object with 'other' command if parsing fails
      return { command: "other", request_details: String(input) };
    }
  }
  return input ?? {};
}

/**
 * Primary chat agent node. Acts differently on first vs second pass:
 *  1. If last message is HumanMessage → call LLM with bound tools (may emit tool_call)
 *  2. If last message is ToolMessage → parse tool result, craft friendly reply, update intent
 *
 * @param state - The current state of the proposal workflow
 * @returns Updated state with new messages and/or intent
 */
export async function chatAgentNode(
  state: typeof OverallProposalStateAnnotation.State
) {
  const messages = state.messages as BaseMessage[];

  console.log("ChatAgentNode START - Total messages:", messages.length);
  if (messages.length > 0) {
    console.log(
      "Message Types:",
      messages.map((m) => m.constructor.name).join(", ")
    );
  }

  if (messages.length === 0) return {};

  const last = messages[messages.length - 1];

  // Enhanced logging to identify exact message type
  console.log(
    "ChatAgentNode processing message type:",
    last.constructor.name,
    "with ID:",
    last.id || "undefined"
  );

  // Special logging for AI messages to debug tool calls
  if (last instanceof AIMessage) {
    console.log("Message is instance of AIMessage");
    if (last.tool_calls?.length) {
      console.log(
        `AIMessage has ${last.tool_calls.length} tool_calls:`,
        JSON.stringify(
          last.tool_calls.map((tc) => ({
            id: tc.id,
            name: tc.name,
            args: tc.args,
          }))
        )
      );
    } else {
      console.log("AIMessage has no tool_calls");
    }
  }

  // For other message types that might have tool_calls but aren't AIMessage instances
  if (
    !last.constructor.name.includes("AIMessage") && // Not already handled above
    typeof last === "object" &&
    last !== null &&
    "type" in last &&
    (last as any).type === "ai" &&
    "tool_calls" in last
  ) {
    console.log(
      "Message has type 'ai' and tool_calls property but is not an AIMessage instance"
    );
    const toolCalls = (last as any).tool_calls;
    if (Array.isArray(toolCalls) && toolCalls.length > 0) {
      console.log(
        `Message contains ${toolCalls.length} tool_calls:`,
        JSON.stringify(
          toolCalls.map((tc) => ({
            id: tc.id,
            name: tc.name,
            args: tc.args,
          }))
        )
      );
    } else {
      console.log(
        "Message has tool_calls property but it's empty or not an array"
      );
    }
  }

  // ------------- CASE 1: tool result just came in -------------
  if (last instanceof ToolMessage) {
    console.log("Processing tool result:", last.content);
    console.log("Tool Call ID:", last.tool_call_id);

    // Parse tool result content
    const toolContent = last.content;
    const parsed: CommandSchemaType =
      typeof toolContent === "string"
        ? safeJSON(toolContent)
        : (toolContent as CommandSchemaType);

    console.log("Parsed intent:", JSON.stringify(parsed));

    // ** CORRECTED LOGIC: **
    // This node's responsibility ends after processing the tool result
    // and setting the intent. It should NOT generate a user-facing reply here.
    // The graph routing logic (routeFromChatAgent) will use the updated intent
    // to determine the next step, and *that* step will handle the next user interaction.

    console.log(
      "ChatAgentNode END (tool response): Returning intent update only"
    );
    // Return ONLY the intent update to be merged into the state.
    return {
      intent: {
        command: parsed.command,
        targetSection: parsed.target_section,
        requestDetails: parsed.request_details,
      },
    };
  }

  // ------------- CASE 2: new human message -------------
  if (last instanceof HumanMessage) {
    console.log("Processing human message:", last.content);

    const model = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0,
    }).bindTools([interpretIntentTool]);

    // STEP 1.1 FIX: Simplified system prompt - no routing decisions
    // routeFromChatAgent() handles all routing, this node just processes messages
    const systemPrompt = `You are a helpful assistant for a proposal generation system.

WHEN TO USE TOOLS:
- When users ask to generate or regenerate proposal sections
- When users want to modify existing proposal content  
- When users want to approve sections
- When users ask for help with the proposal system

WHEN TO RESPOND DIRECTLY (WITHOUT TOOLS):
- General questions about proposal writing best practices
- Simple greetings or conversation  
- Clarification questions
- When user asks factual questions that don't require system actions

Always use the interpret_intent tool when the user request involves any actions related to the proposal content, workflow, or system functionality.

Be helpful, conversational and concise. The system will handle workflow routing automatically.`;

    // Construct the messages array with a system prompt
    const promptMessages = [
      new SystemMessage(systemPrompt),
      ...messages.filter((m) => !(m instanceof SystemMessage)), // Filter out any existing system messages
    ];

    try {
      const response = await model.invoke(promptMessages);
      console.log(
        "Generated AI response with tool calls:",
        response.tool_calls ? response.tool_calls.length : 0,
        "tool calls"
      );

      if (response.tool_calls?.length) {
        console.log("Tool calls:", JSON.stringify(response.tool_calls));
      }

      console.log("ChatAgentNode END (human message): Returning AI response");
      return { messages: [response] }; // will be merged by reducer
    } catch (error) {
      console.error("Error invoking model:", error);
      // Return a fallback response in case of error
      const fallbackResponse = new AIMessage(
        "I'm having trouble processing your request. Could you try again?"
      );
      console.log(
        "ChatAgentNode END (error fallback): Returning fallback response"
      );
      return { messages: [fallbackResponse] };
    }
  }

  // ------------- CASE 3: AI message without tool calls (direct reply) -------------
  if (last instanceof AIMessage && !last.tool_calls?.length) {
    console.log("Processing direct AI response without tool calls");
    // If we get here, the LLM chose to respond directly rather than use tools
    // We can just return empty to keep this message as is
    console.log("ChatAgentNode END (direct AI): No changes");
    return {};
  }

  console.log(
    "ChatAgentNode END: Unhandled message type or state",
    last.constructor.name
  );
  return {}; // Other cases – nothing to do
}

/**
 * LangGraph-native routing function for chat agent
 * Routes based on state data following LangGraph best practices
 */
export function routeFromChatAgent(
  state: typeof OverallProposalStateAnnotation.State
): string {
  console.log("[routeFromChatAgent] Determining next step");

  const msgs = state.messages;
  if (!msgs || msgs.length === 0) {
    console.log("[routeFromChatAgent] → __end__: No messages");
    return "__end__";
  }

  const lastMessage = msgs[msgs.length - 1];

  // Check for tool calls that need processing
  const hasToolCalls = checkForToolCalls(lastMessage);
  if (hasToolCalls) {
    console.log("[routeFromChatAgent] → chatTools: Tool calls detected");
    return "chatTools";
  }

  // Check if we have an RFP to process
  if (state.metadata?.rfpId) {
    // Check if document is loaded
    const isDocumentLoaded =
      state.rfpDocument &&
      state.rfpDocument.status === "loaded" &&
      (state.rfpDocument.text || state.rfpDocument.metadata?.raw);

    if (!isDocumentLoaded) {
      console.log("[routeFromChatAgent] → documentLoader: Need to load document");
      return "documentLoader";
    } else {
      console.log("[routeFromChatAgent] → rfpAnalyzer: Document ready for analysis");
      return "rfpAnalyzer";
    }
  }

  // Default: continue conversation
  console.log("[routeFromChatAgent] → __end__: Normal conversation complete");
  return "__end__";
}

/**
 * Helper function to detect tool calls in messages
 */
function checkForToolCalls(message: any): boolean {
  // Case 1: Standard AIMessage with tool_calls property
  if (
    message instanceof AIMessage &&
    Array.isArray(message.tool_calls) &&
    message.tool_calls.length > 0
  ) {
    return true;
  }

  // Case 2: Check additional_kwargs
  if (
    message.additional_kwargs?.tool_calls &&
    Array.isArray(message.additional_kwargs.tool_calls) &&
    message.additional_kwargs.tool_calls.length > 0
  ) {
    return true;
  }

  // Case 3: Direct property check
  if (
    "tool_calls" in message &&
    Array.isArray(message.tool_calls) &&
    message.tool_calls.length > 0
  ) {
    return true;
  }

  return false;
}
