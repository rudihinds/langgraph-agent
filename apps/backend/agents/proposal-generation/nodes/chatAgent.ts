/**
 * This file implements the chat agent functionality for the proposal generation system.
 * It handles the conversation flow between the user and the AI, interprets user intents,
 * and routes the workflow to appropriate handlers based on those intents.
 *
 * Key components:
 * 1. chatAgentNode - The main function that processes messages and generates responses
 * 2. shouldContinueChat - Determines the next step in the workflow based on message state
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
import { Annotation } from "@langchain/langgraph";
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

  // Step 2.1: State-based RFP detection (replacing regex pattern matching)
  // Check for RFP auto-start in state metadata instead of message content
  if (state.metadata?.rfpId && state.metadata?.autoStarted) {
    console.log(
      `[ChatAgent] State-based RFP detection: rfpId=${state.metadata.rfpId}, autoStarted=${state.metadata.autoStarted}`
    );

    // Check if document has failed to load
    const hasDocumentError =
      state.rfpDocument && state.rfpDocument.status === "error";

    if (hasDocumentError) {
      console.log(
        `[ChatAgent] Document loading failed previously, offering help to user`
      );
      return {
        intent: {
          command: "askQuestion",
          requestDetails: "Document loading failed",
          confidence: 0.9,
        },
        messages: [
          ...state.messages,
          new AIMessage(
            "I had trouble loading your RFP document. This could be because:\n\n" +
              "• The document doesn't exist in storage\n" +
              "• There was a permission issue\n" +
              "• The file may be corrupted\n\n" +
              "Please try uploading the document again, or contact support if the issue persists."
          ),
        ],
      };
    }

    // Check if document is already loaded and ready for analysis
    const isDocumentLoaded =
      state.rfpDocument &&
      state.rfpDocument.status === "loaded" &&
      state.rfpDocument.text;

    if (isDocumentLoaded) {
      console.log(`[ChatAgent] Document already loaded, starting analysis`);
      return {
        intent: {
          command: "startAnalysis",
          requestDetails: "RFP document analysis",
          confidence: 0.9,
        },
        messages: [
          ...state.messages,
          new AIMessage(
            "I can see your RFP document is loaded. Let me analyze it now..."
          ),
        ],
      };
    } else {
      console.log(
        `[ChatAgent] Document not loaded yet, starting document loading`
      );
      return {
        intent: {
          command: "loadDocument",
          requestDetails: `rfpId: ${state.metadata.rfpId}`,
          confidence: 0.9,
        },
        messages: [
          ...state.messages,
          new AIMessage(
            "I'll analyze your RFP document. Let me load it first..."
          ),
        ],
      };
    }
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
    // The graph routing logic (shouldContinueChat) will use the updated intent
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

    // Check state for context awareness
    const rfpLoaded =
      state.rfpDocument &&
      state.rfpDocument.status === "loaded" &&
      state.rfpDocument.text;

    const researchStarted =
      state.researchStatus && state.researchStatus !== "not_started";

    const solutionStarted =
      state.solutionStatus && state.solutionStatus !== "not_started";

    const sectionsGenerated = state.sections && state.sections.size > 0;

    // Prepare a system message that helps guide the model's tool usage
    const systemPrompt = `You are a helpful assistant for a proposal generation system. 

WHEN TO USE TOOLS:
- When users ask to generate or regenerate proposal sections
- When users want to modify existing proposal content
- When users want to approve sections
- When users want to load or upload documents
- When users ask for help with the proposal system

WHEN TO RESPOND DIRECTLY (WITHOUT TOOLS):
- General questions about proposal writing best practices
- Simple greetings or conversation
- Clarification questions
- When user asks factual questions that don't require system actions

Always use the interpret_intent tool when the user request involves any actions related to the proposal content, workflow, or system functionality. 
This helps the system understand what actions to take.

CURRENT WORKFLOW STATE:
- RFP Document: ${rfpLoaded ? "Loaded" : "Not loaded"}
- Research: ${researchStarted ? "Started" : "Not started"}
- Solution: ${solutionStarted ? "Started" : "Not started"}
- Sections: ${sectionsGenerated ? "Some generated" : "None generated"}

WORKFLOW GUIDANCE:
${
  !rfpLoaded
    ? "The user needs to load an RFP document as the first step. Guide them to provide an RFP ID or text."
    : researchStarted
      ? solutionStarted
        ? sectionsGenerated
          ? "The user is in the section refinement phase. Help them modify, approve, or regenerate sections."
          : "The user needs to generate proposal sections. Guide them to start generating specific sections."
        : "The user needs to develop a solution approach next. Guide them to start the solution development phase."
      : "The user needs to start the research phase next. Guide them to initiate research."
}

Be helpful, conversational and concise while keeping them on the right path in our workflow.`;

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
 * Determines the next node in the workflow based on the current state.
 *
 * Routes to:
 * - "chatTools" when tool calls are pending
 * - Specific handlers based on the intent (regenerateSection, modifySection, etc.)
 * - "__end__" when no further action is needed
 *
 * @param state - The current state of the proposal workflow
 * @returns The key of the next node to execute
 */
export function shouldContinueChat(
  state: typeof OverallProposalStateAnnotation.State
): string {
  console.log("\n--------- shouldContinueChat START ---------");
  console.log(
    "Intent in state:",
    state.intent ? JSON.stringify(state.intent) : "none"
  );

  const msgs = state.messages;
  if (!msgs || msgs.length === 0) {
    console.log("shouldContinueChat: No messages, ending");
    console.log("--------- shouldContinueChat END ---------\n");
    return "__end__";
  }

  // Print message chain summary for debugging
  console.log(
    "Message chain:",
    msgs
      .map(
        (m, i) =>
          `[${i}] ${m.constructor.name}${m instanceof ToolMessage && m.tool_call_id ? ` (tool_call_id: ${m.tool_call_id})` : ""}`
      )
      .join(" → ")
  );

  const last = msgs[msgs.length - 1];
  if (!last) {
    console.log("shouldContinueChat: No last message, ending");
    console.log("--------- shouldContinueChat END ---------\n");
    return "__end__";
  }

  console.log(
    "shouldContinueChat processing last message type:",
    last.constructor.name,
    last.id ? `(ID: ${last.id})` : ""
  );

  // Enhanced tool call detection with deep inspection of message structure
  let hasToolCalls = false;
  let toolCalls = null;

  // Log the full message structure for debugging
  console.log(
    "Message structure:",
    JSON.stringify(last, (key, value) =>
      key === "content" && typeof value === "string" && value.length > 100
        ? value.substring(0, 100) + "..."
        : value
    )
  );

  // Case 1: Standard AIMessage with tool_calls property
  if (
    last instanceof AIMessage &&
    Array.isArray(last.tool_calls) &&
    last.tool_calls.length > 0
  ) {
    hasToolCalls = true;
    toolCalls = last.tool_calls;
  }

  // Case 2: AIMessageChunk inspection - check various possible locations
  else if (last.constructor.name.includes("AIMessage")) {
    // Check additional_kwargs
    if (
      last.additional_kwargs &&
      last.additional_kwargs.tool_calls &&
      Array.isArray(last.additional_kwargs.tool_calls) &&
      last.additional_kwargs.tool_calls.length > 0
    ) {
      hasToolCalls = true;
      toolCalls = last.additional_kwargs.tool_calls;
      console.log("Found tool_calls in additional_kwargs");
    }
    // Direct property
    else if (
      "tool_calls" in last &&
      Array.isArray((last as any).tool_calls) &&
      (last as any).tool_calls.length > 0
    ) {
      hasToolCalls = true;
      toolCalls = (last as any).tool_calls;
      console.log("Found tool_calls directly on the message");
    }
  }

  // Case 3: Generic object inspection (last resort)
  else if (typeof last === "object" && last !== null) {
    // Direct property check
    if (
      "tool_calls" in last &&
      Array.isArray((last as any).tool_calls) &&
      (last as any).tool_calls.length > 0
    ) {
      hasToolCalls = true;
      toolCalls = (last as any).tool_calls;
      console.log("Found tool_calls on generic object");
    }
    // Check additional_kwargs
    else if (
      "additional_kwargs" in last &&
      (last as any).additional_kwargs &&
      "tool_calls" in (last as any).additional_kwargs &&
      Array.isArray((last as any).additional_kwargs.tool_calls) &&
      (last as any).additional_kwargs.tool_calls.length > 0
    ) {
      hasToolCalls = true;
      toolCalls = (last as any).additional_kwargs.tool_calls;
      console.log("Found tool_calls in additional_kwargs of generic object");
    }
  }

  // If tool calls were found, route to chatTools
  if (hasToolCalls && toolCalls) {
    console.log(
      `shouldContinueChat: Found ${toolCalls.length} tool calls, routing to chatTools`
    );
    console.log(
      "Tool calls:",
      JSON.stringify(
        toolCalls.map((tc: any) => ({
          name: tc.name || "unnamed",
          id: tc.id || "no-id",
          type: tc.type || "no-type",
        }))
      )
    );
    console.log("--------- shouldContinueChat END ---------\n");
    return "chatTools";
  }

  // Route based on intent if present
  if (state.intent?.command) {
    console.log(
      `shouldContinueChat: Routing based on intent: ${state.intent.command}`
    );

    // Normalize command to handle snake_case variants
    const commandString = state.intent.command as string;
    const normalizedCommand =
      commandString === "load_document" ? "loadDocument" : state.intent.command;

    let destination;
    switch (normalizedCommand) {
      case "regenerateSection":
        destination = "regenerateSection";
        break;
      case "modifySection":
        destination = "modifySection";
        break;
      case "approveSection":
        destination = "approveSection";
        break;
      case "askQuestion":
        destination = "answerQuestion";
        break;
      case "loadDocument":
        destination = "loadDocument";
        break;
      case "startAnalysis":
        destination = "startAnalysis";
        break;
      default:
        console.log(
          `shouldContinueChat: Unrecognized command "${state.intent.command}", ending`
        );
        destination = "__end__";
    }

    console.log(`shouldContinueChat: Routing to ${destination}`);
    console.log("--------- shouldContinueChat END ---------\n");
    return destination;
  }

  console.log("shouldContinueChat: No recognized routing condition, ending");
  console.log("--------- shouldContinueChat END ---------\n");
  return "__end__";
}
