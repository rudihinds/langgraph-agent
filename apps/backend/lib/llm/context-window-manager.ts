/**
 * Context Window Manager for managing message context windows and conversation summarization
 *
 * This class provides functionality for:
 * 1. Ensuring messages fit within a model's context window
 * 2. Summarizing conversations that exceed a token threshold
 * 3. Preserving important messages (like system messages)
 */

import { EventEmitter } from "events";
import { Logger } from "../../logger.js";
import { LLMFactory } from "./llm-factory.js";
import { BaseMessage } from "@langchain/core/messages";
import { ErrorCategory, createErrorEvent } from "./error-classification.js";
// Import functions from the message-truncation module that are used directly
import {
  progressiveTruncation,
  TruncationLevel,
} from "./message-truncation.js";

/**
 * Interface for message objects
 */
export interface Message {
  role: string;
  content: string;
  isSummary?: boolean;
  tokenCount?: number; // Added for token caching
}

export interface PreparedMessages {
  messages: Message[];
  wasSummarized: boolean;
  totalTokens: number;
}

export interface ContextWindowManagerOptions {
  /**
   * Model ID to use for summarization. Defaults to "claude-3-7-sonnet".
   */
  summarizationModel?: string;
  /**
   * Reserved tokens to ensure safe headroom for model responses. Default is 1000.
   */
  reservedTokens?: number;
  /**
   * Maximum number of tokens before summarization is triggered. Default is 6000.
   */
  maxTokensBeforeSummarization?: number;
  /**
   * What portion of messages to summarize when threshold is exceeded.
   * 0.5 means summarize the oldest 50% of messages. Default is 0.5.
   */
  summarizationRatio?: number;
  /**
   * Enable debug logging for token calculations and summarization decisions
   */
  debug?: boolean;
}

/**
 * Manages message context windows and conversation summarization.
 * Ensures messages fit within a model's context window by either
 * summarizing or truncating messages that exceed token limits.
 */
export class ContextWindowManager extends EventEmitter {
  private static instance: ContextWindowManager;
  private logger: Logger;
  private summarizationModel: string;
  private reservedTokens: number;
  private maxTokensBeforeSummarization: number;
  private summarizationRatio: number;
  private debug: boolean;
  private tokenCache: Map<string, number> = new Map();

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor(options: ContextWindowManagerOptions = {}) {
    super();
    this.logger = Logger.getInstance();
    this.summarizationModel = options.summarizationModel || "claude-3-7-sonnet";
    this.reservedTokens = options.reservedTokens || 1000;
    this.maxTokensBeforeSummarization =
      options.maxTokensBeforeSummarization || 6000;
    this.summarizationRatio = options.summarizationRatio || 0.5;
    this.debug = !!options.debug;
  }

  /**
   * Get singleton instance of ContextWindowManager
   */
  public static getInstance(
    options?: ContextWindowManagerOptions
  ): ContextWindowManager {
    if (!ContextWindowManager.instance) {
      ContextWindowManager.instance = new ContextWindowManager(options);
    } else if (options) {
      // Update options if provided
      const instance = ContextWindowManager.instance;
      if (options.summarizationModel) {
        instance.summarizationModel = options.summarizationModel;
      }
      if (options.reservedTokens !== undefined) {
        instance.reservedTokens = options.reservedTokens;
      }
      if (options.maxTokensBeforeSummarization !== undefined) {
        instance.maxTokensBeforeSummarization =
          options.maxTokensBeforeSummarization;
      }
      if (options.summarizationRatio !== undefined) {
        instance.summarizationRatio = options.summarizationRatio;
      }
      if (options.debug !== undefined) {
        instance.debug = options.debug;
      }
    }
    return ContextWindowManager.instance;
  }

  /**
   * Reset the singleton instance (primarily for testing)
   */
  public static resetInstance(): void {
    ContextWindowManager.instance = null as unknown as ContextWindowManager;
  }

  /**
   * Log debug information if debug mode is enabled
   */
  private logDebug(message: string): void {
    if (this.debug) {
      this.logger.debug(`[ContextWindowManager] ${message}`);
    }
  }

  /**
   * Calculate total tokens for an array of messages
   * Uses token cache when possible to avoid repeated calculations
   */
  public async calculateTotalTokens(
    messages: Message[],
    modelId: string
  ): Promise<number> {
    const llmFactory = LLMFactory.getInstance();
    const client = llmFactory.getClientForModel(modelId);

    let totalTokens = 0;

    for (const message of messages) {
      // Generate a cache key based on role, content, and model
      const cacheKey = `${modelId}:${message.role}:${message.content}`;

      // Use cached token count if available
      if (message.tokenCount !== undefined) {
        totalTokens += message.tokenCount;
        this.logDebug(
          `Using cached token count: ${message.tokenCount} for message`
        );
        continue;
      }

      if (this.tokenCache.has(cacheKey)) {
        const cachedCount = this.tokenCache.get(cacheKey) as number;
        totalTokens += cachedCount;
        message.tokenCount = cachedCount; // Store in message object too
        this.logDebug(`Using cached token count: ${cachedCount} for message`);
        continue;
      }

      // Calculate tokens for this message - use string content for estimation
      const tokens = await client.estimateTokens(message.content);
      message.tokenCount = tokens;
      this.tokenCache.set(cacheKey, tokens);
      totalTokens += tokens;
    }

    return totalTokens;
  }

  /**
   * Summarize a conversation using an LLM
   */
  public async summarizeConversation(messages: Message[]): Promise<Message> {
    // Filter out system messages to focus on conversation
    const nonSystemMessages = messages.filter(
      (message) => message.role !== "system"
    );

    // Handle case where there's nothing to summarize
    if (nonSystemMessages.length === 0) {
      return {
        role: "assistant",
        content: "Conversation summary: No conversation to summarize yet.",
        isSummary: true,
      };
    }

    // Format conversation for the summarization prompt
    const conversationText = nonSystemMessages
      .map((message) => `${message.role}: ${message.content}`)
      .join("\n\n");

    try {
      const llmFactory = LLMFactory.getInstance();
      const client = llmFactory.getClientForModel(this.summarizationModel);
      const response = await client.completion({
        model: this.summarizationModel,
        systemMessage: `You are a highly efficient summarization assistant. 
          Summarize the following conversation accurately, preserving all important details.
          Make the summary clear, concise, and in the third person.
          Focus on the key points, decisions, and information shared.`,
        messages: [
          {
            role: "user",
            content: `Please summarize this conversation:\n\n${conversationText}`,
          },
        ],
      });

      return {
        role: "assistant",
        content: response.content.trim(),
        isSummary: true,
      };
    } catch (error) {
      this.logger.error(
        `Error summarizing conversation: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      // Emit error event
      this.emit(
        "error",
        createErrorEvent({
          category: ErrorCategory.LLM_SUMMARIZATION_ERROR,
          error: error instanceof Error ? error : new Error(String(error)),
          source: "ContextWindowManager.summarizeConversation",
          modelId: this.summarizationModel,
        })
      );

      // Fallback summary
      return {
        role: "assistant",
        content: `Conversation summary: ${nonSystemMessages.length} messages exchanged.`,
        isSummary: true,
      };
    }
  }

  /**
   * Prepare messages for a model by managing context window
   * Will summarize or truncate messages if they exceed the token limit
   */
  public async prepareMessages(
    messages: Message[],
    modelId: string
  ): Promise<PreparedMessages> {
    if (!messages.length) {
      return { messages: [], wasSummarized: false, totalTokens: 0 };
    }

    try {
      // Calculate tokens for the current message set
      const totalTokens = await this.calculateTotalTokens(messages, modelId);
      this.logDebug(`Current conversation is ${totalTokens} tokens`);

      // Extract system messages (always preserved)
      const systemMessages = messages.filter(
        (message) => message.role === "system"
      );
      const nonSystemMessages = messages.filter(
        (message) => message.role !== "system"
      );

      const llmFactory = LLMFactory.getInstance();
      const modelInfo = llmFactory.getModelById(modelId);

      if (!modelInfo) {
        throw new Error(`Model information not found for ${modelId}`);
      }

      const maxTokens = modelInfo.contextWindow - this.reservedTokens; // Leave room for response

      this.logDebug(
        `Model ${modelId} has ${maxTokens} usable tokens (${modelInfo.contextWindow} - ${this.reservedTokens} reserved)`
      );

      // If we're under the limit, return as-is
      if (totalTokens <= maxTokens) {
        this.logDebug(
          `Conversation fits within context window (${totalTokens} <= ${maxTokens})`
        );
        return { messages, wasSummarized: false, totalTokens };
      }

      // We're over the limit. First, check if we should summarize
      // Only summarize if conversation is over the summarization threshold
      if (totalTokens >= this.maxTokensBeforeSummarization) {
        this.logDebug(
          `Conversation exceeds summarization threshold (${totalTokens} >= ${this.maxTokensBeforeSummarization})`
        );

        // Determine how many messages to summarize (based on summarizationRatio)
        const messagesToSummarizeCount = Math.max(
          1,
          Math.floor(nonSystemMessages.length * this.summarizationRatio)
        );
        this.logDebug(
          `Will summarize ${messagesToSummarizeCount} of ${nonSystemMessages.length} messages`
        );

        // Messages to be summarized (older messages)
        const messagesToSummarize = nonSystemMessages.slice(
          0,
          messagesToSummarizeCount
        );

        // Messages to keep as-is (newer messages)
        const messagesToKeep = nonSystemMessages.slice(
          messagesToSummarizeCount
        );

        // Create summary
        const summary = await this.summarizeConversation(messagesToSummarize);
        this.logDebug(
          `Created summary: ${summary.content.substring(0, 50)}...`
        );

        // Build the new message array
        const summarizedMessages = [
          ...systemMessages,
          summary,
          ...messagesToKeep,
        ];

        // Check if we're still over the limit
        const summarizedTokens = await this.calculateTotalTokens(
          summarizedMessages,
          modelId
        );
        this.logDebug(
          `After summarization: ${summarizedTokens} tokens (limit: ${maxTokens})`
        );

        // If still over limit, use progressive truncation
        if (summarizedTokens > maxTokens) {
          this.logDebug(
            `Still exceeding token limit after summarization, will truncate`
          );

          // Convert our Message format to BaseMessage format for truncation
          const baseMessages = summarizedMessages.map((msg) => {
            // Create a simplified version that matches what we need
            const baseMsg = {
              content: msg.content,
              _getType: function () {
                return msg.role === "system"
                  ? "system"
                  : msg.role === "user"
                    ? "human"
                    : "ai";
              },
              additional_kwargs: {
                isSummary: msg.isSummary || false,
              },
            } as unknown as BaseMessage;

            return baseMsg;
          });

          // Use progressive truncation strategy
          const { messages: truncatedBaseMessages } = progressiveTruncation(
            baseMessages,
            maxTokens,
            TruncationLevel.MODERATE
          );

          // Convert back to our Message format
          const truncatedMessages = truncatedBaseMessages.map((msg) => ({
            role:
              msg._getType() === "system"
                ? "system"
                : msg._getType() === "human"
                  ? "user"
                  : "assistant",
            content: String(msg.content),
            isSummary: msg.additional_kwargs?.isSummary === true,
          }));

          const finalTokens = await this.calculateTotalTokens(
            truncatedMessages,
            modelId
          );

          return {
            messages: truncatedMessages,
            wasSummarized: true,
            totalTokens: finalTokens,
          };
        }

        return {
          messages: summarizedMessages,
          wasSummarized: true,
          totalTokens: summarizedTokens,
        };
      } else {
        // Over the limit but under summarization threshold, use progressive truncation
        this.logDebug(
          `Conversation exceeds token limit but under summarization threshold, truncating directly`
        );

        // Convert our Message format to BaseMessage format for truncation
        const baseMessages = messages.map((msg) => {
          // Create a simplified version that matches what we need
          const baseMsg = {
            content: msg.content,
            _getType: function () {
              return msg.role === "system"
                ? "system"
                : msg.role === "user"
                  ? "human"
                  : "ai";
            },
            additional_kwargs: {
              isSummary: msg.isSummary || false,
            },
          } as unknown as BaseMessage;

          return baseMsg;
        });

        // Use progressive truncation strategy
        const { messages: truncatedBaseMessages } = progressiveTruncation(
          baseMessages,
          maxTokens,
          TruncationLevel.LIGHT
        );

        // Convert back to our Message format
        const truncatedMessages = truncatedBaseMessages.map((msg) => ({
          role:
            msg._getType() === "system"
              ? "system"
              : msg._getType() === "human"
                ? "user"
                : "assistant",
          content: String(msg.content),
          isSummary: msg.additional_kwargs?.isSummary === true,
        }));

        const truncatedTokens = await this.calculateTotalTokens(
          truncatedMessages,
          modelId
        );

        return {
          messages: truncatedMessages,
          wasSummarized: false,
          totalTokens: truncatedTokens,
        };
      }
    } catch (error) {
      this.logger.error(
        `Error preparing messages: ${
          error instanceof Error ? error.message : String(error)
        }`
      );

      // Emit error event
      this.emit(
        "error",
        createErrorEvent({
          category: ErrorCategory.CONTEXT_WINDOW_ERROR,
          error: error instanceof Error ? error : new Error(String(error)),
          source: "ContextWindowManager.prepareMessages",
          modelId,
        })
      );

      // If anything fails, use minimal message set as a fallback
      const systemMessages = messages.filter(
        (message) => message.role === "system"
      );
      const lastMessage = messages[messages.length - 1];
      const criticalMessages = [
        ...systemMessages,
        lastMessage, // Always include the last message
      ];

      return {
        messages: criticalMessages,
        wasSummarized: false,
        totalTokens: -1, // Mark as unknown
      };
    }
  }
}

// Re-export types and functions from message-truncation.ts
export {
  estimateTokenCount,
  estimateMessageTokens,
  truncateMessages,
  TruncateMessagesOptions,
  progressiveTruncation,
  TruncationLevel,
  createMinimalMessageSet,
} from "./message-truncation.js";
