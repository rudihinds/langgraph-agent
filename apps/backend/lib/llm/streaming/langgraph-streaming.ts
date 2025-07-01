/**
 * LangGraph Streaming Utilities
 *
 * Standard implementation of streaming for LangGraph using the native SDK capabilities.
 * This replaces the custom streaming implementation for better compatibility.
 */

import { createModel } from "@/lib/llm/model-factory.js";
import {
  BaseMessage,
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { ChatPromptTemplate, PromptTemplate } from "@langchain/core/prompts";
import { RunnableConfig, RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";

// Model name type for strongly typed model selection
export type SupportedModel = string; // Now supports all models in model factory

/**
 * Creates a streaming model with the specified configuration
 *
 * @param modelName Name of the model to use
 * @param temperature Temperature setting (0-1)
 * @param streaming Whether to enable streaming (default: true)
 * @returns A configured chat model instance
 */
function createStreamingModel(
  modelName: SupportedModel,
  temperature: number = 0.7,
  streaming: boolean = true
) {
  // Use the model factory to create the model
  const model = createModel(modelName, {
    temperature,
    streaming,
  });
  
  return model.withRetry({ stopAfterAttempt: 3 });
}

/**
 * Creates a streaming LLM node for use in LangGraph
 *
 * @param prompt The prompt template to use
 * @param modelName The name of the model
 * @param temperature Temperature setting
 * @returns A runnable that can be used as a LangGraph node
 */
export function createStreamingLLMChain(
  prompt: ChatPromptTemplate | PromptTemplate,
  modelName: SupportedModel = "gpt-4.1-nano-2025-04-14",
  temperature: number = 0.7
) {
  const model = createStreamingModel(modelName, temperature);

  return RunnableSequence.from([prompt, model, new StringOutputParser()]);
}

/**
 * Creates a chat model configured for streaming in LangGraph
 *
 * @param modelName The name of the model to use
 * @param temperature Temperature setting
 * @returns A chat model configured for streaming
 */
export function createStreamingChatModel(
  modelName: SupportedModel = "gpt-4.1-nano-2025-04-14",
  temperature: number = 0.7
) {
  return createStreamingModel(modelName, temperature, true);
}

/**
 * Converts BaseMessages to the format expected by LangChain chat models
 *
 * @param messages Array of messages to convert
 * @returns Converted messages
 */
export function convertMessages(messages: any[]): BaseMessage[] {
  return messages.map((msg) => {
    if (msg.role === "user") {
      return new HumanMessage(msg.content);
    } else if (msg.role === "assistant") {
      return new AIMessage(msg.content);
    } else if (msg.role === "system") {
      return new SystemMessage(msg.content);
    } else {
      // Default to HumanMessage if role is unknown
      return new HumanMessage(msg.content);
    }
  });
}

/**
 * Configuration for LangGraph streaming
 */
export interface StreamingConfig extends RunnableConfig {
  /**
   * Whether to enable streaming (default: true)
   */
  streaming?: boolean;

  /**
   * Maximum number of tokens to generate
   */
  maxTokens?: number;

  /**
   * Temperature for text generation
   */
  temperature?: number;

  /**
   * Top-p for nucleus sampling
   */
  topP?: number;
}

/**
 * Default streaming configuration
 */
export const DEFAULT_STREAMING_CONFIG: StreamingConfig = {
  streaming: true,
  maxTokens: 2000,
  temperature: 0.7,
  topP: 0.95,
};
