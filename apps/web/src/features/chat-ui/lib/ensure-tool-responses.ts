import {
  AgentAction,
  AgentFinish,
  AgentStep,
  BaseMessage,
} from "@langchain/core/messages";
import { ChatMessageHistory } from "@langchain/core/chat_history";
import { BaseLanguageModel } from "@langchain/core/language_models/base";

export interface HistoryAwareOutputParserOptions {
  historyMessages: BaseMessage[];
  model: BaseLanguageModel;
}

/**
 * A history aware output parser. This parser looks at the previous
 * steps in the agent's execution and ensures that tool inputs
 * are consistent.
 */
export class HistoryAwareToolOutputParser {
  historyMessages: BaseMessage[];

  model: BaseLanguageModel;

  constructor(options: HistoryAwareOutputParserOptions) {
    this.historyMessages = options.historyMessages;
    this.model = options.model;
  }

  async processPotentialToolCalls(): Promise<string[]> {
    if (this.historyMessages.length === 0) {
      return [];
    }

    const lastMessage = this.historyMessages[this.historyMessages.length - 1];
    // Ensure it's not a system message or a human message, as those don't have tool calls
    if (
      !lastMessage ||
      lastMessage.type === "system" ||
      lastMessage.type === "human"
    ) {
      return [];
    }

    const potentialToolCallMessages: BaseMessage[] = [];
    let i = this.historyMessages.length - 2;
    let continueLooking = true;
    // Search for the last tool call made by the agent
    while (i >= 0 && continueLooking) {
      const message = this.historyMessages[i];
      // Add all messages between the last human message (including it)
      // or sysstem message and the current message
      if (message.type === "human" || message.type === "system") {
        potentialToolCallMessages.push(message);
        if (message.type === "human") {
          // Stop at the last human message
          continueLooking = false;
        }
      } else {
        // Add ai messages
        potentialToolCallMessages.push(message);
      }
      i -= 1;
    }

    potentialToolCallMessages.reverse();

    const historyManager = new ChatMessageHistory();
    for (const message of potentialToolCallMessages) {
      await historyManager.addMessage(message);
    }

    const messages = await historyManager.getMessages();

    // Find the last agent action
    const lastAction = this.findLastToolCall(messages);
    const lastAiMessage = lastMessage;

    if (!lastAction) {
      return [];
    }

    const missingTools: string[] = [];

    const lastAiMessageJson = JSON.stringify(lastAiMessage);
    if (
      !lastAiMessageJson.includes(lastAction.name) ||
      !lastAiMessageJson.includes(lastAction.argsJSON)
    ) {
      missingTools.push(
        JSON.stringify({
          name: lastAction.name,
          arguments: lastAction.argsJSON,
        })
      );
    }

    return missingTools;
  }

  findLastToolCall(messages: BaseMessage[]): {
    name: string;
    argsJSON: string;
  } | null {
    const allSteps: {
      action?: AgentAction;
      observation?: string;
    }[] = [];

    const pairs: [BaseMessage, BaseMessage][] = [];
    for (let i = 0; i < messages.length - 1; i += 1) {
      if (
        messages[i].type === "ai" &&
        messages[i + 1].type !== "ai" &&
        messages[i + 1].type !== "system" &&
        messages[i + 1].type !== "human"
      ) {
        pairs.push([messages[i], messages[i + 1]]);
      }
    }

    for (const [aiMessage, toolMessage] of pairs) {
      try {
        // Some messages don't have additional_kwargs
        if ("additional_kwargs" in aiMessage) {
          // Look for tool calls via OpenAI format
          const { additional_kwargs: kw } = aiMessage;
          if (kw?.tool_calls !== undefined && kw.tool_calls.length > 0) {
            for (const tool_call of kw.tool_calls) {
              const action = {
                tool: tool_call.function.name,
                toolInput: JSON.parse(tool_call.function.arguments),
                log: aiMessage.content as string,
                messageLog: [aiMessage],
                toolCallId: tool_call.id,
              };
              // Look for the observation
              if (
                toolMessage?.additional_kwargs?.tool_call_id === tool_call.id
              ) {
                allSteps.push({
                  action: action as AgentAction,
                  observation: toolMessage.content as string,
                });
              }
            }
          }
        } else if (
          typeof aiMessage.content === "string" &&
          aiMessage.content.includes("Action:")
        ) {
          const actionRegex = /Action: (.*)\nAction Input: (.*)/;
          const match = aiMessage.content.match(actionRegex);

          if (match) {
            const action = match[1];
            const actionInput = match[2];
            let parsedInput;
            try {
              parsedInput = JSON.parse(actionInput);
            } catch (e) {
              parsedInput = actionInput;
            }
            const agentAction = {
              tool: action,
              toolInput: parsedInput,
              log: aiMessage.content as string,
              messageLog: [aiMessage],
            };
            allSteps.push({
              action: agentAction as AgentAction,
              observation: toolMessage?.content as string,
            });
          }
        }
      } catch (e) {
        console.error("Could not parse tool call", e);
      }
    }

    const lastStep = allSteps[allSteps.length - 1];
    if (lastStep?.action) {
      let argsJSON;
      try {
        argsJSON = JSON.stringify(lastStep.action.toolInput);
      } catch (e) {
        argsJSON = "";
      }
      return {
        name: lastStep.action.tool,
        argsJSON,
      };
    }

    return null;
  }
}
