import { BaseMessage, SystemMessage } from "@langchain/core/messages";
import { getModelContextSize, calculateMaxTokens } from "@langchain/core/language_models/count_tokens";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { logger } from "../../agents/logger";

interface PruneMessageHistoryOptions {
  /**
   * Maximum number of tokens to keep in the message history
   * @default 4000
   */
  maxTokens?: number;
  
  /**
   * Whether to keep all system messages
   * @default true
   */
  keepSystemMessages?: boolean;
  
  /**
   * Optional function to summarize pruned messages
   * Will be called with the messages being removed
   * Should return a single message that summarizes them
   */
  summarize?: (messages: BaseMessage[]) => Promise<BaseMessage>;

  /**
   * Model name to use for token counting
   * @default "gpt-3.5-turbo"
   */
  model?: string;
}

/**
 * Prune message history to prevent context overflow
 * 
 * @param messages Array of messages to prune
 * @param options Options for pruning
 * @returns Pruned message array
 */
export function pruneMessageHistory(
  messages: BaseMessage[],
  options: PruneMessageHistoryOptions = {}
): BaseMessage[] {
  const {
    maxTokens = 4000,
    keepSystemMessages = true,
    model = "gpt-3.5-turbo",
  } = options;

  if (messages.length === 0) {
    return [];
  }

  // Calculate available tokens
  const modelContextSize = getModelContextSize(model);
  const availableTokens = calculateMaxTokens({
    promptMessages: messages,
    modelName: model,
  });

  // If we're under the limit, return all messages
  if (availableTokens >= 0 && availableTokens <= modelContextSize - maxTokens) {
    return messages;
  }

  // We need to prune messages
  logger.debug(`Pruning message history: ${messages.length} messages, need to remove ${-availableTokens} tokens`);

  // Make a copy of the messages
  const prunedMessages = [...messages];

  // Always keep the most recent human/AI message pair
  let tokensToRemove = -availableTokens;
  let i = 0;

  // Keep removing messages from the beginning until we're under the token limit
  // Skip system messages if keepSystemMessages is true
  while (tokensToRemove > 0 && i < prunedMessages.length - 2) {
    const message = prunedMessages[i];
    
    // Skip system messages if we're keeping them
    if (keepSystemMessages && message instanceof SystemMessage) {
      i++;
      continue;
    }

    // Get approximate token count for this message
    const tokenCount = getTokenCount(message);
    tokensToRemove -= tokenCount;
    
    // Remove this message
    prunedMessages.splice(i, 1);
    
    // Don't increment i since we removed an element
  }

  // If we have a summarize function, replace the removed messages
  if (options.summarize && prunedMessages.length < messages.length) {
    // Calculate which messages were removed
    const removedMessages = messages.filter(
      (msg, idx) => !prunedMessages.some(
        (prunedMsg) => prunedMsg === msg
      )
    );
    
    // Add a summary message asynchronously
    // Note: This is async but we return synchronously
    // The summary will be added in a future turn of the event loop
    options.summarize(removedMessages)
      .then((summaryMessage) => {
        // Find index of first non-system message
        let insertIndex = 0;
        while (
          insertIndex < prunedMessages.length && 
          prunedMessages[insertIndex] instanceof SystemMessage &&
          keepSystemMessages
        ) {
          insertIndex++;
        }
        
        // Insert the summary at the appropriate position
        prunedMessages.splice(insertIndex, 0, summaryMessage);
      })
      .catch((error) => {
        logger.error("Error summarizing messages", error);
      });
  }

  return prunedMessages;
}

/**
 * Get token count for a single message
 */
function getTokenCount(message: BaseMessage): number {
  // Use message's own token counting method if available
  if (typeof (message as any).getTokenCount === "function") {
    return (message as any).getTokenCount();
  }
  
  // Fallback to approximate counting
  const content = typeof message.content === "string" 
    ? message.content 
    : JSON.stringify(message.content);
  
  // Rough approximation: 4 chars per token
  return Math.ceil(content.length / 4);
}

/**
 * Create a summary message for a conversation
 */
async function summarizeConversation(
  messages: BaseMessage[], 
  llm: any
): Promise<AIMessage> {
  // Filter out system messages
  const conversationMessages = messages.filter(
    (msg) => !(msg instanceof SystemMessage)
  );
  
  if (conversationMessages.length === 0) {
    return new AIMessage("No conversation to summarize.");
  }
  
  // Create a prompt for the summarization
  const systemMessage = new SystemMessage(
    "Summarize the following conversation in a concise way. " +
    "Preserve key information that might be needed for continuing the conversation. " +
    "Focus on facts, decisions, and important details."
  );
  
  try {
    // Ask the LLM to summarize
    const response = await llm.invoke([
      systemMessage,
      ...conversationMessages,
      new HumanMessage("Please provide a concise summary of our conversation so far."),
    ]);
    
    // Return the summary as an AI message
    return new AIMessage(`[Conversation History Summary: ${response.content}]`);
  } catch (error) {
    logger.error("Error summarizing conversation", error);
    return new AIMessage("[Error summarizing conversation history]");
  }
}