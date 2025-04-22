import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { Annotation } from "@langchain/langgraph";
import { ProposalStateAnnotation } from "@/state/proposal.state.js";
import {
  interpretIntentTool,
  CommandSchemaType,
} from "../../../tools/interpretIntentTool.js";
import { z } from "zod";

// Helper
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
 */
export async function chatAgentNode(
  state: typeof ProposalStateAnnotation.State
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
    // Extract the parsed command - handle both string and object content
    const parsed: CommandSchemaType =
      typeof toolContent === "string"
        ? safeJSON(toolContent)
        : (toolContent as CommandSchemaType);

    console.log("Parsed intent:", JSON.stringify(parsed));

    // Craft human‑friendly reply confirming/acting on intent
    const replyModel = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.7,
    });

    // Create a filtered message history without ToolMessages for the reply generation
    const filteredMessages = messages.filter(
      (m) => !(m instanceof ToolMessage)
    );
    console.log(
      `Using ${filteredMessages.length} messages for reply generation`
    );

    try {
      // Enhanced system prompt with specific guidance based on intent
      let systemPrompt = `You are a helpful proposal‑workflow assistant. Your goal is to guide users through creating effective business proposals.
      
Respond to the user based on their intent shown below. Be conversational, specific, and action-oriented.

DO NOT mention any internal tools, parsing, or intent recognition in your response.

Available commands you can help with:
- regenerate_section: Help users regenerate specific proposal sections
- modify_section: Assist with modifying existing content
- approve_section: Confirm when a section is approved
- ask_question: Answer questions about proposal writing
- help: Provide guidance on available features
- other: General conversation

Your response should vary based on their specific intent and be tailored to proposal writing context.`;

      // Add specific additional guidance based on the intent type
      if (parsed.command === "regenerate_section") {
        systemPrompt += `\n\nFor regenerate_section intent: Explain how you can help them regenerate the section. Ask for confirmation if they want to proceed with regeneration.`;
      } else if (parsed.command === "modify_section") {
        systemPrompt += `\n\nFor modify_section intent: Ask what specific changes they want to make to the section. Offer suggestions for improvement if appropriate.`;
      } else if (parsed.command === "approve_section") {
        systemPrompt += `\n\nFor approve_section intent: Confirm that the section will be marked as approved. Thank them for their review.`;
      } else if (parsed.command === "ask_question") {
        systemPrompt += `\n\nFor ask_question intent: Provide a detailed, helpful answer to their question about proposal writing.`;
      } else if (parsed.command === "help") {
        systemPrompt += `\n\nFor help intent: Explain the key features of the proposal writing system - regenerating sections, modifying content, approving sections, asking questions.`;
      } else {
        systemPrompt += `\n\nFor other or general intents: Be helpful and conversational. Ask clarifying questions if their intent isn't clear.`;
      }

      const reply = await replyModel.invoke([
        new SystemMessage(systemPrompt),
        ...filteredMessages,
        new HumanMessage(
          `The user's message was: "${filteredMessages[filteredMessages.length - 1]?.content || "Unknown"}"
           
Their interpreted intent is: ${JSON.stringify(parsed)}. 
           
Respond conversationally and helpfully based on this intent, offering specific guidance for their proposal.`
        ),
      ]);

      console.log("Successfully generated reply:", reply.content);

      // Return both the reply and update the intent
      console.log(
        "ChatAgentNode END (tool response): Returning reply and intent"
      );
      return {
        messages: [reply],
        intent: {
          command: parsed.command,
          targetSection: parsed.target_section,
          details: parsed.request_details,
        },
      };
    } catch (error) {
      console.error("Error generating reply:", error);
      // More helpful fallback messages based on intent type
      let fallbackMessage =
        "I'm here to help with your proposal. Could you provide more details about what you need?";

      if (parsed.command === "help") {
        fallbackMessage =
          "I can help you with writing proposals, including generating sections, modifying content, and answering questions. What would you like assistance with specifically?";
      } else if (parsed.command === "ask_question") {
        fallbackMessage =
          "I'd be happy to answer your question about proposal writing. Could you provide more details about what you'd like to know?";
      }

      const fallbackReply = new AIMessage(fallbackMessage);
      console.log(
        "ChatAgentNode END (error fallback): Returning fallback reply"
      );
      return {
        messages: [fallbackReply],
        intent: {
          command: parsed.command,
          targetSection: parsed.target_section,
          details: parsed.request_details,
        },
      };
    }
  }

  // ------------- CASE 2: new human message -------------
  if (last instanceof HumanMessage) {
    console.log("Processing human message:", last.content);

    const model = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0,
    }).bindTools([interpretIntentTool]);

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

Be helpful, conversational and concise.`;

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
 * shouldContinueChat – returns next node key: "chatTools" when tool calls pending, or
 * maps intent→handler after tool processed, else "__end__".
 */
export function shouldContinueChat(
  state: typeof ProposalStateAnnotation.State
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

    let destination;
    switch (state.intent.command) {
      case "regenerate_section":
        destination = "regenerateSection";
        break;
      case "modify_section":
        destination = "modifySection";
        break;
      case "approve_section":
        destination = "approveSection";
        break;
      case "ask_question":
        destination = "answerQuestion";
        break;
      case "load_document":
        destination = "loadDocument";
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
