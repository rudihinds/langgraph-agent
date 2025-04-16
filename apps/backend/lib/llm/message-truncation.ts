/**
 * Message Truncation Utilities
 *
 * Part of Task #14.3: Implement strategies for handling context window limitations
 * Provides utilities to truncate message history to fit within model context windows
 */

import { BaseMessage } from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

// Add a constant to make sure this module is properly loaded with named exports
const MESSAGE_TRUNCATION_VERSION = "1.0";

/**
 * Rough token count estimation
 * This is a simple approximation - actual token counts vary by model
 *
 * @param text - Text to estimate token count for
 * @returns Estimated token count
 */
export function estimateTokenCount(text: string): number {
  // Very rough approximation: ~4 chars per token for English text
  return Math.ceil(text.length / 4);
}

/**
 * Estimates token count for an array of messages
 *
 * @param messages - Messages to calculate token count for
 * @returns Estimated token count
 */
export function estimateMessageTokens(messages: BaseMessage[]): number {
  // Handle invalid input
  if (!Array.isArray(messages) || messages.length === 0) {
    return 0;
  }

  // Start with base overhead for the conversation
  let totalTokens = 0;

  // Add tokens for each message
  for (const message of messages) {
    // Add per-message overhead (roles, formatting, etc.)
    totalTokens += 4;

    // Add content tokens
    if (typeof message.content === "string") {
      totalTokens += estimateTokenCount(message.content);
    } else if (Array.isArray(message.content)) {
      // Handle content arrays (e.g., for multi-modal content)
      for (const item of message.content) {
        if (typeof item === "string") {
          totalTokens += estimateTokenCount(item);
        } else if (typeof item === "object" && "text" in item) {
          totalTokens += estimateTokenCount(String(item.text));
        }
      }
    }

    // Add tokens for tool calls if present
    if ("tool_calls" in message && Array.isArray(message.tool_calls)) {
      for (const toolCall of message.tool_calls) {
        // Add tokens for tool name and arguments
        totalTokens += estimateTokenCount(JSON.stringify(toolCall));
      }
    }
  }

  return totalTokens;
}

/**
 * Options for truncating message history
 */
export type TruncateMessagesOptions = {
  /**
   * Maximum token count to target
   */
  maxTokens: number;

  /**
   * Strategy for truncation
   */
  strategy: "sliding-window" | "summarize" | "drop-middle";

  /**
   * Number of most recent messages to always keep
   */
  preserveRecentCount?: number;

  /**
   * Number of initial messages to always keep (e.g., system prompt)
   */
  preserveInitialCount?: number;
};

/**
 * Truncates message history to fit within token limits
 *
 * @param messages - Message history to truncate
 * @param options - Truncation options
 * @returns Truncated message array
 */
export function truncateMessages(
  messages: BaseMessage[],
  options: TruncateMessagesOptions
): BaseMessage[] {
  // Handle invalid input early
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  const {
    maxTokens,
    strategy,
    preserveRecentCount = 4,
    preserveInitialCount = 1,
  } = options;

  // If we're already under the limit, return as is
  const currentTokenCount = estimateMessageTokens(messages);
  if (currentTokenCount <= maxTokens) {
    return messages;
  }

  // Handle different strategies
  switch (strategy) {
    case "sliding-window": {
      // Keep the most recent N messages that fit within the token limit
      const result: BaseMessage[] = [];
      let tokenCount = 0;

      // Always include system message if present
      const systemMessages = messages.slice(0, preserveInitialCount);
      result.push(...systemMessages);
      tokenCount += estimateMessageTokens(systemMessages);

      // Add most recent messages that fit
      const recentMessages = messages.slice(-preserveRecentCount);
      const remainingTokens = maxTokens - tokenCount;

      // If we can't even fit the recent messages, we need a more aggressive strategy
      if (estimateMessageTokens(recentMessages) > remainingTokens) {
        // Just keep the system message and the very last message
        return [
          ...messages.slice(0, preserveInitialCount),
          messages[messages.length - 1],
        ];
      }

      result.push(...recentMessages);
      return result;
    }

    case "drop-middle": {
      // Keep the beginning and end, remove the middle
      const initialMessages = messages.slice(0, preserveInitialCount);
      const recentMessages = messages.slice(-preserveRecentCount);

      // Calculate how many tokens we have available for middle messages
      const endpointsTokens = estimateMessageTokens([
        ...initialMessages,
        ...recentMessages,
      ]);
      const remainingTokens = maxTokens - endpointsTokens;

      if (remainingTokens <= 0) {
        // If we can't fit any middle messages, just return endpoints
        return [...initialMessages, ...recentMessages];
      }

      // Find how many middle messages we can include
      const middleMessages = messages.slice(
        preserveInitialCount,
        -preserveRecentCount
      );
      const resultMessages = [...initialMessages];

      // Add middle messages that fit
      let currentTokens = estimateMessageTokens(initialMessages);
      for (const msg of middleMessages) {
        const msgTokens = estimateMessageTokens([msg]);
        if (
          currentTokens + msgTokens <=
          maxTokens - estimateMessageTokens(recentMessages)
        ) {
          resultMessages.push(msg);
          currentTokens += msgTokens;
        } else {
          break;
        }
      }

      return [...resultMessages, ...recentMessages];
    }

    case "summarize":
      // This would ideally use an LLM to summarize the conversation
      // For now, we'll fall back to sliding-window as this requires an extra LLM call
      return truncateMessages(messages, {
        ...options,
        strategy: "sliding-window",
      });

    default:
      // Default to sliding window if unknown strategy
      return truncateMessages(messages, {
        ...options,
        strategy: "sliding-window",
      });
  }
}

/**
 * Creates a minimal message set from the original messages
 * This is used as a last resort when normal truncation still exceeds context limits
 *
 * @param messages - Original message array
 * @returns Minimal message array with just first and last messages
 */
export function createMinimalMessageSet(
  messages: BaseMessage[]
): BaseMessage[] {
  if (messages.length <= 2) {
    return messages;
  }

  return [
    messages[0], // First message (usually system)
    messages[messages.length - 1], // Last message (usually user query)
  ];
}

/**
 * Different levels of message truncation for escalating context window issues
 */
export enum TruncationLevel {
  /**
   * No truncation needed, messages fit within context window
   */
  NONE = "none",

  /**
   * Light truncation removing some middle messages
   */
  LIGHT = "light",

  /**
   * Moderate truncation removing most historical messages
   */
  MODERATE = "moderate",

  /**
   * Aggressive truncation keeping only essential messages
   */
  AGGRESSIVE = "aggressive",

  /**
   * Extreme truncation keeping only the system prompt and last message
   */
  EXTREME = "extreme",
}

/**
 * Progressive message truncation utility
 * Attempts increasingly aggressive truncation strategies to fit within context window
 *
 * @param messages - Messages to truncate
 * @param maxTokens - Maximum token limit
 * @param level - Starting truncation level (default: LIGHT)
 * @returns Truncated messages and the level of truncation applied
 */
export function progressiveTruncation(
  messages: BaseMessage[],
  maxTokens: number,
  level: TruncationLevel = TruncationLevel.LIGHT
): { messages: BaseMessage[]; level: TruncationLevel } {
  // Check if we even need truncation
  const estimatedTokens = estimateMessageTokens(messages);
  if (estimatedTokens <= maxTokens) {
    return { messages, level: TruncationLevel.NONE };
  }

  // Apply increasingly aggressive truncation based on level
  switch (level) {
    case TruncationLevel.LIGHT: {
      // Try light truncation first - drop some middle messages
      const lightTruncated = truncateMessages(messages, {
        maxTokens,
        strategy: "drop-middle",
        preserveInitialCount: 1,
        preserveRecentCount: 6,
      });

      if (estimateMessageTokens(lightTruncated) <= maxTokens) {
        return { messages: lightTruncated, level: TruncationLevel.LIGHT };
      }

      // If that didn't work, try moderate truncation
      return progressiveTruncation(
        messages,
        maxTokens,
        TruncationLevel.MODERATE
      );
    }

    case TruncationLevel.MODERATE: {
      // Try moderate truncation - sliding window with fewer preserved messages
      const moderateTruncated = truncateMessages(messages, {
        maxTokens,
        strategy: "sliding-window",
        preserveInitialCount: 1,
        preserveRecentCount: 4,
      });

      if (estimateMessageTokens(moderateTruncated) <= maxTokens) {
        return { messages: moderateTruncated, level: TruncationLevel.MODERATE };
      }

      // If that didn't work, try aggressive truncation
      return progressiveTruncation(
        messages,
        maxTokens,
        TruncationLevel.AGGRESSIVE
      );
    }

    case TruncationLevel.AGGRESSIVE: {
      // Try aggressive truncation - keep system prompt and last 2 messages
      const aggressiveTruncated = truncateMessages(messages, {
        maxTokens,
        strategy: "sliding-window",
        preserveInitialCount: 1,
        preserveRecentCount: 2,
      });

      if (estimateMessageTokens(aggressiveTruncated) <= maxTokens) {
        return {
          messages: aggressiveTruncated,
          level: TruncationLevel.AGGRESSIVE,
        };
      }

      // If that didn't work, try extreme truncation
      return progressiveTruncation(
        messages,
        maxTokens,
        TruncationLevel.EXTREME
      );
    }

    case TruncationLevel.EXTREME:
    default: {
      // Extreme truncation - system prompt and only the last message
      const minimalSet = createMinimalMessageSet(messages);
      return { messages: minimalSet, level: TruncationLevel.EXTREME };
    }
  }
}
