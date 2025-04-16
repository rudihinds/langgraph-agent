/**
 * Context Window Manager for managing message context windows and conversation summarization
 *
 * This class provides functionality for:
 * 1. Ensuring messages fit within a model's context window
 * 2. Summarizing conversations that exceed a token threshold
 * 3. Preserving important messages (like system messages)
 *
 * !!! IMPORTANT DEVELOPMENT NOTE !!!
 * This file contains the message truncation functionality for the application.
 * There is NO separate message-truncation.ts utility file.
 * All message truncation logic is implemented as methods of this class.
 * The message-truncation.test.ts file was removed as it was redundant with tests here.
 * !!! END IMPORTANT NOTE !!!
 */

import { EventEmitter } from "events";
import { Logger } from "../logger.js";
import { LLMFactory } from "./llm-factory.js";
import { LLMCompletionOptions } from "./types.js";

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

interface ContextWindowManagerOptions {
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
    try {
      const llmFactory = LLMFactory.getInstance();
      let client;

      try {
        client = llmFactory.getClientForModel(modelId);
      } catch (error: unknown) {
        // Handle client initialization error
        const clientError =
          error instanceof Error ? error : new Error(String(error));

        this.logger.error(
          `Failed to get LLM client for model ${modelId}: ${clientError.message}`
        );
        this.emit("error", {
          category: "LLM_CLIENT_ERROR",
          message: `Failed to get LLM client for token calculation: ${clientError.message}`,
          error: clientError,
        });

        // Fall back to rough token estimation - 4 tokens per word as a rough estimate
        return this.estimateTokensFallback(messages);
      }

      let totalTokens = 0;

      for (const message of messages) {
        try {
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
            this.logDebug(
              `Using cached token count: ${cachedCount} for message`
            );
            continue;
          }

          // Calculate tokens for this message - use string content for estimation
          const tokens = await client.estimateTokens(message.content);
          message.tokenCount = tokens;
          this.tokenCache.set(cacheKey, tokens);
          totalTokens += tokens;
        } catch (error: unknown) {
          // Handle token estimation error for individual message
          const estimationError =
            error instanceof Error ? error : new Error(String(error));

          this.logger.warn(
            `Error estimating tokens for message: ${estimationError.message}`
          );

          // Use fallback calculation for this message only
          const fallbackTokens =
            this.estimateTokensFallbackForSingleMessage(message);
          message.tokenCount = fallbackTokens;
          totalTokens += fallbackTokens;
        }
      }

      return totalTokens;
    } catch (error: unknown) {
      // Handle any other errors in token calculation
      const generalError =
        error instanceof Error ? error : new Error(String(error));

      this.logger.error(`Failed to calculate tokens: ${generalError.message}`);
      this.emit("error", {
        category: "TOKEN_CALCULATION_ERROR",
        message: `Failed to calculate message tokens: ${generalError.message}`,
        error: generalError,
      });

      // Fall back to rough token estimation
      return this.estimateTokensFallback(messages);
    }
  }

  /**
   * Fallback token estimation when LLM client fails
   * Uses a simple heuristic - 4 tokens per word as a rough estimate
   */
  private estimateTokensFallback(messages: Message[]): number {
    let totalTokens = 0;

    for (const message of messages) {
      totalTokens += this.estimateTokensFallbackForSingleMessage(message);
    }

    // Add a 20% buffer to account for potential underestimation
    return Math.ceil(totalTokens * 1.2);
  }

  /**
   * Estimate tokens for a single message using a simple word-count heuristic
   */
  private estimateTokensFallbackForSingleMessage(message: Message): number {
    const content = message.content || "";
    // Estimate 4 tokens per word as a rough approximation (words + punctuation + formatting)
    const words = content.split(/\s+/).length;
    return Math.max(1, words * 4) + 4; // Add 4 tokens for message format overhead
  }

  /**
   * Summarize a conversation using an LLM
   */
  public async summarizeConversation(messages: Message[]): Promise<Message> {
    try {
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

      // Get the LLM client for summarization
      const llmFactory = LLMFactory.getInstance();
      try {
        const client = llmFactory.getClientForModel(this.summarizationModel);

        this.logDebug(
          `Summarizing conversation with ${this.summarizationModel}`
        );

        const completionOptions: LLMCompletionOptions = {
          model: this.summarizationModel,
          messages: [
            {
              role: "system" as const,
              content:
                "You are a conversation summarizer. Your task is to summarize the key points of the conversation. Focus on capturing important factual information, any specific tasks or requirements mentioned, and key questions that were asked. Keep your summary clear, concise, and informative.",
            },
            {
              role: "user" as const,
              content: `Please summarize the following conversation. Focus on preserving context about specific tasks, data, or requirements mentioned:\n\n${conversationText}`,
            },
          ],
        };

        try {
          // Generate the summary
          const completion = await client.completion(completionOptions);

          // Return the summary as a special message
          return {
            role: "assistant",
            content: `Conversation summary: ${completion.content}`,
            isSummary: true,
          };
        } catch (error: unknown) {
          // Handle LLM completion errors
          const completionError =
            error instanceof Error ? error : new Error(String(error));

          this.logger.error(
            `Error during LLM summarization: ${completionError.message}`
          );
          this.emit("error", {
            category: "LLM_SUMMARIZATION_ERROR",
            message: `Failed to generate summary with LLM: ${completionError.message}`,
            error: completionError,
          });

          // Create a fallback summary based on conversation size
          return this.createFallbackSummary(nonSystemMessages);
        }
      } catch (error: unknown) {
        // Handle client initialization errors
        const clientError =
          error instanceof Error ? error : new Error(String(error));

        this.logger.error(
          `Error getting LLM client for summarization: ${clientError.message}`
        );
        this.emit("error", {
          category: "LLM_CLIENT_ERROR",
          message: `Failed to initialize LLM client: ${clientError.message}`,
          error: clientError,
        });

        // Create a fallback summary
        return this.createFallbackSummary(nonSystemMessages);
      }
    } catch (error: unknown) {
      // Handle any other errors
      const generalError =
        error instanceof Error ? error : new Error(String(error));

      this.logger.error(
        `Unexpected error during summarization: ${generalError.message}`
      );
      this.emit("error", {
        category: "LLM_SUMMARIZATION_ERROR",
        message: `Unexpected error during summarization: ${generalError.message}`,
        error: generalError,
      });

      // Return a generic fallback summary
      return {
        role: "assistant",
        content:
          "Conversation summary: Unable to summarize the conversation due to an error.",
        isSummary: true,
      };
    }
  }

  /**
   * Create a minimal fallback summary when LLM summarization fails
   * This method attempts to extract key information without using an LLM
   */
  private createFallbackSummary(messages: Message[]): Message {
    try {
      // Get message count
      const messageCount = messages.length;

      // Extract basic statistics as a minimal summary
      const userMessages = messages.filter((m) => m.role === "user").length;
      const assistantMessages = messages.filter(
        (m) => m.role === "assistant"
      ).length;

      // Extract topics by looking at the first few words of user messages
      const userTopics = messages
        .filter((m) => m.role === "user")
        .map((m) => m.content.split(" ").slice(0, 5).join(" ") + "...")
        .slice(-3); // Just take last 3 user messages

      // Create a basic summary
      const content = [
        `Conversation summary (fallback): Conversation with ${messageCount} messages (${userMessages} user, ${assistantMessages} assistant).`,
        userTopics.length > 0
          ? `Recent topics: ${userTopics.join(" | ")}`
          : "No topics extracted.",
      ].join(" ");

      return {
        role: "assistant",
        content,
        isSummary: true,
      };
    } catch (error) {
      // Last resort summary if even the fallback fails
      return {
        role: "assistant",
        content: `Conversation summary (minimal): Conversation with approximately ${messages.length} messages.`,
        isSummary: true,
      };
    }
  }

  /**
   * Prepare messages to fit within the context window.
   * May summarize or truncate messages as necessary.
   */
  public async prepareMessages(
    messages: Message[],
    modelId: string
  ): Promise<PreparedMessages> {
    try {
      const llmFactory = LLMFactory.getInstance();
      const model = llmFactory.getModelById(modelId);

      if (!model) {
        const error = new Error(`Model ${modelId} not found`);
        this.emit("error", {
          category: "LLM_MODEL_ERROR",
          message: error.message,
          error,
        });
        throw error;
      }

      // Calculate available tokens (context window minus reserved tokens)
      const availableTokens = model.contextWindow - this.reservedTokens;
      this.logDebug(
        `Model: ${modelId}, Context window: ${model.contextWindow}, Available tokens: ${availableTokens}`
      );

      try {
        // Calculate total tokens in current messages
        const totalTokens = await this.calculateTotalTokens(messages, modelId);
        this.logDebug(
          `Total tokens in ${messages.length} messages: ${totalTokens}`
        );

        // If messages fit within available tokens, return them as is
        if (totalTokens <= availableTokens) {
          this.logDebug("Messages fit within available tokens");
          return {
            messages,
            wasSummarized: false,
            totalTokens,
          };
        }

        // If total tokens exceed summarization threshold, summarize older messages
        if (totalTokens > this.maxTokensBeforeSummarization) {
          this.logDebug(
            `Total tokens (${totalTokens}) exceed summarization threshold (${this.maxTokensBeforeSummarization}). Summarizing.`
          );

          // Calculate split point based on summarizationRatio
          // e.g., with 10 messages and ratio 0.5, we summarize the oldest 5 messages
          const splitIndex = Math.max(
            1,
            Math.floor(messages.length * this.summarizationRatio)
          );

          // Split messages into those to summarize and those to keep
          const systemMessages = messages.filter((m) => m.role === "system");
          const nonSystemMessages = messages.filter((m) => m.role !== "system");

          const messagesToSummarize = nonSystemMessages.slice(0, splitIndex);
          const messagesToKeep = nonSystemMessages.slice(splitIndex);

          this.logDebug(
            `Summarizing ${messagesToSummarize.length} messages out of ${nonSystemMessages.length} total`
          );

          // Create an array with: system message(s) + messages to summarize
          const messagesForSummarization = [
            ...systemMessages,
            ...messagesToSummarize,
          ];

          try {
            // Generate summary
            const summaryMessage = await this.summarizeConversation(
              messagesForSummarization
            );

            // Create new array with: system message(s) + summary + messages to keep
            const preparedMessages = [
              ...systemMessages,
              summaryMessage,
              ...messagesToKeep,
            ];

            // Verify new total fits within context window
            const newTotalTokens = await this.calculateTotalTokens(
              preparedMessages,
              modelId
            );

            // If still too large, truncate
            if (newTotalTokens > availableTokens) {
              this.logDebug(
                `Summarized messages still exceed available tokens (${newTotalTokens} > ${availableTokens}). Truncating.`
              );
              return {
                messages: await this.truncateMessages(
                  preparedMessages,
                  modelId,
                  availableTokens
                ),
                wasSummarized: true,
                totalTokens: newTotalTokens,
              };
            }

            return {
              messages: preparedMessages,
              wasSummarized: true,
              totalTokens: newTotalTokens,
            };
          } catch (error: unknown) {
            // Handle errors during summarization
            const summarizationError =
              error instanceof Error ? error : new Error(String(error));

            this.logger.warn(
              `Error during conversation summarization: ${summarizationError.message}. Falling back to truncation.`
            );
            this.emit("error", {
              category: "LLM_SUMMARIZATION_ERROR",
              message: `Failed to summarize conversation: ${summarizationError.message}`,
              error: summarizationError,
            });

            // Fall back to truncation
            return {
              messages: await this.truncateMessages(
                messages,
                modelId,
                availableTokens
              ),
              wasSummarized: false,
              totalTokens,
            };
          }
        }

        // If total tokens exceed available tokens but are below summarization threshold, truncate
        this.logDebug(
          `Total tokens (${totalTokens}) exceed available tokens (${availableTokens}) but below summarization threshold. Truncating.`
        );

        return {
          messages: await this.truncateMessages(
            messages,
            modelId,
            availableTokens
          ),
          wasSummarized: false,
          totalTokens,
        };
      } catch (error: unknown) {
        // Handle errors during token calculation
        const tokenError =
          error instanceof Error ? error : new Error(String(error));

        this.logger.error(`Error calculating tokens: ${tokenError.message}`);
        this.emit("error", {
          category: "TOKEN_CALCULATION_ERROR",
          message: `Failed to calculate message tokens: ${tokenError.message}`,
          error: tokenError,
        });

        // Apply aggressive truncation as fallback - keep system messages and recent messages
        const systemMessages = messages.filter((m) => m.role === "system");
        const nonSystemMessages = messages.filter((m) => m.role !== "system");

        // Keep only the most recent messages as a fallback
        const maxMessagesToKeep = 5; // Arbitrary safety limit
        const recentMessages = nonSystemMessages.slice(-maxMessagesToKeep);

        return {
          messages: [...systemMessages, ...recentMessages],
          wasSummarized: false,
          totalTokens: 0, // We don't know the real token count
        };
      }
    } catch (error: unknown) {
      // Catch any other errors in the overall process
      const generalError =
        error instanceof Error ? error : new Error(String(error));

      this.logger.error(`Error preparing messages: ${generalError.message}`);
      this.emit("error", {
        category: "CONTEXT_WINDOW_ERROR",
        message: `Failed to prepare messages: ${generalError.message}`,
        error: generalError,
      });

      // Last resort - return only system messages or a minimal set
      const systemMessages = messages.filter((m) => m.role === "system");
      const lastMessage = messages[messages.length - 1];
      const fallbackMessages =
        systemMessages.length > 0
          ? systemMessages
          : [
              {
                role: "system",
                content: "Unable to process message history due to an error.",
              },
            ];

      // Add the last message if it exists and isn't a system message
      if (lastMessage && lastMessage.role !== "system") {
        fallbackMessages.push(lastMessage);
      }

      return {
        messages: fallbackMessages,
        wasSummarized: false,
        totalTokens: 0,
      };
    }
  }

  /**
   * Truncate messages to fit within available tokens.
   * Always preserves system messages and most recent non-system messages.
   */
  private async truncateMessages(
    messages: Message[],
    modelId: string,
    availableTokens: number
  ): Promise<Message[]> {
    // Separate system and non-system messages
    const systemMessages = messages.filter(
      (message) => message.role === "system"
    );
    const nonSystemMessages = messages.filter(
      (message) => message.role !== "system"
    );

    // If no non-system messages, return just system messages
    if (nonSystemMessages.length === 0) {
      return systemMessages;
    }

    // Calculate token count for system messages
    const systemTokens = await this.calculateTotalTokens(
      systemMessages,
      modelId
    );
    const remainingTokens = availableTokens - systemTokens;

    this.logDebug(
      `System messages use ${systemTokens} tokens. Remaining for non-system: ${remainingTokens}`
    );

    // Approach: Keep as many recent messages as possible
    const result = [...systemMessages];
    let currentTokens = systemTokens;

    // Add messages from newest to oldest until we can't add more
    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      const message = nonSystemMessages[i];
      const messageTokens = message.tokenCount || 0;

      if (currentTokens + messageTokens <= availableTokens) {
        result.unshift(message); // Add at beginning to maintain order
        currentTokens += messageTokens;
      } else {
        // Can't fit this message
        break;
      }
    }

    this.logDebug(
      `Truncated to ${result.length} messages using approximately ${currentTokens} tokens`
    );

    return result;
  }
}
