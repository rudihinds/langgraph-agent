import { BaseMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { ProposalStateAnnotation } from "@/state/proposal.state.js";
import { interpretIntentTool } from "../../../tools/interpretIntentTool.js";

/**
 * A custom ToolNode implementation that processes tool calls from AI responses
 * and creates appropriate tool response messages.
 *
 * This is explicitly defined instead of using the built-in ToolNode to ensure
 * proper handling of the tool response cycle according to LangGraph best practices.
 */
export async function processToolsNode(
  state: typeof ProposalStateAnnotation.State
) {
  console.log("ToolProcessor START");
  const messages = state.messages;

  if (!messages || messages.length === 0) {
    console.log("ToolProcessor: No messages found in state");
    return {};
  }

  const lastMessage = messages[messages.length - 1];
  console.log(
    `ToolProcessor: Last message type: ${lastMessage.constructor.name}`
  );

  // Extract tool calls with enhanced detection for AIMessageChunk
  let toolCalls = null;

  // Case 1: Standard AIMessage with tool_calls property
  if (
    lastMessage instanceof AIMessage &&
    Array.isArray(lastMessage.tool_calls) &&
    lastMessage.tool_calls.length > 0
  ) {
    toolCalls = lastMessage.tool_calls;
    console.log("ToolProcessor: Found tool_calls in AIMessage");
  }
  // Case 2: AIMessageChunk or similar with tool_calls in additional_kwargs
  else if (
    lastMessage.constructor.name.includes("AIMessage") &&
    lastMessage.additional_kwargs &&
    lastMessage.additional_kwargs.tool_calls &&
    Array.isArray(lastMessage.additional_kwargs.tool_calls) &&
    lastMessage.additional_kwargs.tool_calls.length > 0
  ) {
    toolCalls = lastMessage.additional_kwargs.tool_calls;
    console.log("ToolProcessor: Found tool_calls in additional_kwargs");
  }
  // Case 3: Direct tool_calls property on any message type
  else if (
    typeof lastMessage === "object" &&
    lastMessage !== null &&
    "tool_calls" in lastMessage &&
    Array.isArray((lastMessage as any).tool_calls) &&
    (lastMessage as any).tool_calls.length > 0
  ) {
    toolCalls = (lastMessage as any).tool_calls;
    console.log("ToolProcessor: Found tool_calls directly on message");
  }

  // If no tool calls found, return empty
  if (!toolCalls || !toolCalls.length) {
    console.log("ToolProcessor: No tool calls found to process");
    return {};
  }

  console.log(`ToolProcessor: Found ${toolCalls.length} tool calls to process`);
  console.log(`ToolProcessor: Tool calls: ${JSON.stringify(toolCalls)}`);

  // Process each tool call and create corresponding tool response messages
  const toolResponseMessages: ToolMessage[] = [];

  for (const toolCall of toolCalls) {
    console.log(
      `ToolProcessor: Processing tool call: ${toolCall.name || toolCall.function?.name} (ID: ${toolCall.id})`
    );

    try {
      // Handle different tool call formats (direct or nested in function)
      const toolName = toolCall.name || toolCall.function?.name;
      const toolArgs =
        toolCall.args ||
        (toolCall.function?.arguments
          ? typeof toolCall.function.arguments === "string"
            ? JSON.parse(toolCall.function.arguments)
            : toolCall.function.arguments
          : {});

      // Only process interpret_intent tool calls for now
      if (toolName === "interpret_intent") {
        console.log(`ToolProcessor: Tool args - ${JSON.stringify(toolArgs)}`);

        // Execute the tool with the provided arguments
        const result = await interpretIntentTool.invoke(toolArgs);
        console.log(`ToolProcessor: Tool result - ${JSON.stringify(result)}`);

        // Create a tool response message
        const toolResponse = new ToolMessage({
          tool_call_id: toolCall.id,
          name: toolName,
          content: JSON.stringify(result),
        });

        toolResponseMessages.push(toolResponse);
      } else {
        console.warn(`ToolProcessor: Unknown tool '${toolName}', skipping`);
      }
    } catch (error) {
      console.error(`ToolProcessor: Error processing tool call:`, error);
      // Create an error response
      const errorResponse = new ToolMessage({
        tool_call_id: toolCall.id,
        name: toolCall.name || toolCall.function?.name || "unknown_tool",
        content: JSON.stringify({
          error: `Failed to process tool: ${error.message}`,
          command: "other", // Fallback command
        }),
      });

      toolResponseMessages.push(errorResponse);
    }
  }

  console.log(
    `ToolProcessor END: Returning ${toolResponseMessages.length} tool response messages`
  );

  // Return the tool responses to be merged into the messages array
  return {
    messages: toolResponseMessages,
  };
}
