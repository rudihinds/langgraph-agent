/**
 * Token Management Utilities
 * 
 * Provides utilities for managing token limits in LLM interactions,
 * including message trimming, token estimation, and context compression.
 */

import { BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { ChatAnthropic } from "@langchain/anthropic";

/**
 * Configuration for token management
 */
export interface TokenConfig {
  maxTokens: number;
  modelName: string;
  preserveSystemMessages?: boolean;
  preserveRecentToolMessages?: number;
  bufferTokens?: number; // Reserve tokens for response
}

/**
 * Default token limits for different models
 */
export const TOKEN_LIMITS = {
  "claude-3-5-sonnet-20241022": 200000,
  "claude-3-haiku-20240307": 200000,
  "claude-3-opus-20240229": 200000,
} as const;

/**
 * Estimates token count for a message
 * This is a rough approximation - actual token count may vary
 */
export function estimateTokens(content: string): number {
  // Rough estimation: ~4 characters per token for English text
  // This is conservative to avoid underestimating
  return Math.ceil(content.length / 3);
}

/**
 * Estimates total tokens for a set of messages
 */
export function estimateMessageTokens(messages: BaseMessage[]): number {
  let totalTokens = 0;
  
  for (const msg of messages) {
    // Add tokens for message content
    const content = typeof msg.content === 'string' 
      ? msg.content 
      : JSON.stringify(msg.content);
    totalTokens += estimateTokens(content);
    
    // Add overhead for message structure
    totalTokens += 20; // Approximate overhead per message
    
    // Add tokens for tool calls if present
    if ('tool_calls' in msg && msg.tool_calls) {
      totalTokens += estimateTokens(JSON.stringify(msg.tool_calls));
    }
  }
  
  return totalTokens;
}

/**
 * Trims messages to fit within token limit while preserving important context
 */
export function trimMessagesToTokenLimit(
  messages: BaseMessage[],
  config: TokenConfig
): BaseMessage[] {
  const { maxTokens, preserveSystemMessages = true, preserveRecentToolMessages = 3, bufferTokens = 4000 } = config;
  const targetTokens = maxTokens - bufferTokens;
  
  // Separate messages by type
  const systemMessages: BaseMessage[] = [];
  const toolMessages: BaseMessage[] = [];
  const otherMessages: BaseMessage[] = [];
  
  for (const msg of messages) {
    if (msg instanceof SystemMessage && preserveSystemMessages) {
      systemMessages.push(msg);
    } else if (msg instanceof ToolMessage) {
      toolMessages.push(msg);
    } else {
      otherMessages.push(msg);
    }
  }
  
  // Start with system messages
  const result: BaseMessage[] = [...systemMessages];
  let currentTokens = estimateMessageTokens(result);
  
  // Add recent tool messages
  const recentTools = toolMessages.slice(-preserveRecentToolMessages);
  for (const msg of recentTools) {
    const msgTokens = estimateMessageTokens([msg]);
    if (currentTokens + msgTokens <= targetTokens) {
      result.push(msg);
      currentTokens += msgTokens;
    }
  }
  
  // Add other messages from most recent
  const reversedOthers = [...otherMessages].reverse();
  for (const msg of reversedOthers) {
    const msgTokens = estimateMessageTokens([msg]);
    if (currentTokens + msgTokens <= targetTokens) {
      result.unshift(msg); // Add to beginning to maintain order
      currentTokens += msgTokens;
    } else {
      break; // Stop if we'd exceed limit
    }
  }
  
  // Sort to maintain chronological order
  return result.sort((a, b) => {
    const aTime = a.additional_kwargs?.timestamp || 0;
    const bTime = b.additional_kwargs?.timestamp || 0;
    return aTime - bTime;
  });
}

/**
 * Compresses tool messages by summarizing their content
 */
export async function compressToolMessages(
  toolMessages: ToolMessage[],
  model: ChatAnthropic
): Promise<AIMessage> {
  const toolContents = toolMessages.map(msg => {
    const content = typeof msg.content === 'string' 
      ? msg.content 
      : JSON.stringify(msg.content);
    return `Tool: ${msg.name}\n${content}`;
  }).join('\n\n---\n\n');
  
  const compressionPrompt = `Summarize these search results into key findings, preserving the most important information:

${toolContents}

Provide a concise summary that captures:
1. Key facts and findings
2. Important names, dates, and figures
3. Relevant patterns or insights`;

  const summary = await model.invoke([
    new SystemMessage("You are a concise summarizer. Extract and preserve key information."),
    new HumanMessage(compressionPrompt)
  ]);
  
  return new AIMessage({
    content: summary.content,
    additional_kwargs: {
      compressed: true,
      originalMessages: toolMessages.length,
      timestamp: Date.now()
    }
  });
}

/**
 * Handles token limit errors with retry and context reduction
 */
export async function handleTokenLimitError<T>(
  operation: () => Promise<T>,
  messages: BaseMessage[],
  config: TokenConfig,
  options: {
    onRetry?: (attemptNumber: number, reducedMessages: BaseMessage[]) => void;
    maxRetries?: number;
  } = {}
): Promise<T> {
  const { onRetry, maxRetries = 3 } = options;
  let currentMessages = messages;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      // Check if it's a token limit error
      if (error instanceof Error && 
          error.message.includes('prompt is too long') &&
          error.message.includes('tokens')) {
        
        console.log(`[Token Management] Token limit exceeded on attempt ${attempt}, reducing context...`);
        
        // Reduce context more aggressively with each attempt
        const reductionFactor = 0.7 ** attempt; // 70%, 49%, 34.3% of original
        const newMaxTokens = Math.floor(config.maxTokens * reductionFactor);
        
        currentMessages = trimMessagesToTokenLimit(currentMessages, {
          ...config,
          maxTokens: newMaxTokens
        });
        
        if (onRetry) {
          onRetry(attempt, currentMessages);
        }
        
        // If we've reduced too much, throw the error
        if (currentMessages.length < 2) {
          throw new Error("Context reduced to minimum but still exceeding token limit");
        }
      } else {
        // Re-throw if not a token limit error
        throw error;
      }
    }
  }
  
  throw new Error(`Failed after ${maxRetries} attempts to fit within token limit`);
}

/**
 * Creates a sliding window of messages based on token budget
 */
export function createMessageWindow(
  messages: BaseMessage[],
  windowSizeTokens: number
): BaseMessage[] {
  const result: BaseMessage[] = [];
  let currentTokens = 0;
  
  // Start from the most recent messages
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const msgTokens = estimateMessageTokens([msg]);
    
    if (currentTokens + msgTokens <= windowSizeTokens) {
      result.unshift(msg);
      currentTokens += msgTokens;
    } else if (msg instanceof SystemMessage) {
      // Always try to keep system messages
      result.unshift(msg);
      break;
    } else {
      break;
    }
  }
  
  return result;
}