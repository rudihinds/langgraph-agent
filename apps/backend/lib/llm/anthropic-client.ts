/**
 * Anthropic implementation of the LLM client
 */

import {
  LLMClient,
  LLMCompletionOptions,
  LLMCompletionResponse,
  LLMModel,
  LLMStreamCallback,
  LLMStreamEventType,
} from "./types.js";
import Anthropic from "@anthropic-ai/sdk";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { env } from "../config/env.js";

/**
 * Anthropic models configuration
 */
const ANTHROPIC_MODELS: LLMModel[] = [
  {
    id: "claude-3-opus-20240229",
    name: "Claude 3 Opus",
    provider: "anthropic",
    contextWindow: 200000,
    inputCostPer1000Tokens: 0.015,
    outputCostPer1000Tokens: 0.075,
    supportsStreaming: true,
  },
  {
    id: "claude-3-7-sonnet-20250219",
    name: "Claude 3.7 Sonnet",
    provider: "anthropic",
    contextWindow: 200000,
    inputCostPer1000Tokens: 0.003,
    outputCostPer1000Tokens: 0.015,
    supportsStreaming: true,
  },
  {
    id: "claude-3-sonnet-20240229",
    name: "Claude 3 Sonnet",
    provider: "anthropic",
    contextWindow: 200000,
    inputCostPer1000Tokens: 0.003,
    outputCostPer1000Tokens: 0.015,
    supportsStreaming: true,
  },
  {
    id: "claude-3-haiku-20240307",
    name: "Claude 3 Haiku",
    provider: "anthropic",
    contextWindow: 200000,
    inputCostPer1000Tokens: 0.00025,
    outputCostPer1000Tokens: 0.00125,
    supportsStreaming: true,
  },
];

/**
 * Anthropic client implementation
 */
export class AnthropicClient implements LLMClient {
  private client: Anthropic;
  supportedModels = ANTHROPIC_MODELS;

  /**
   * Create a new Anthropic client
   * @param apiKey Optional API key (defaults to env.ANTHROPIC_API_KEY)
   */
  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Convert LangChain message format to Anthropic message format
   * @param messages Array of LangChain messages
   * @returns Array of Anthropic messages
   */
  private convertMessages(messages: Array<{ role: string; content: string }>) {
    return messages.map((message) => {
      if (message.role === "system") {
        return { role: "system", content: message.content };
      } else if (message.role === "user" || message.role === "human") {
        return { role: "user", content: message.content };
      } else if (message.role === "assistant" || message.role === "ai") {
        return { role: "assistant", content: message.content };
      }
      // Default to user role for unknown roles
      return { role: "user", content: message.content };
    });
  }

  /**
   * Get a completion from Anthropic
   * @param options Completion options
   * @returns Promise with completion response
   */
  async completion(
    options: LLMCompletionOptions
  ): Promise<LLMCompletionResponse> {
    const startTime = Date.now();

    try {
      // Prepare messages
      const messages = [...options.messages];
      const anthropicMessages = this.convertMessages(messages);

      // Set up the request parameters
      const params: Anthropic.MessageCreateParams = {
        model: options.model,
        messages: anthropicMessages,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.7,
        system: options.systemMessage,
      };

      // Add response format if provided
      if (
        options.responseFormat &&
        options.responseFormat.type === "json_object"
      ) {
        params.response_format = { type: "json_object" };
      }

      // Execute request
      const response = await this.client.messages.create(params);
      const timeTaken = Date.now() - startTime;

      // Calculate tokens and cost
      const promptTokens = response.usage.input_tokens;
      const completionTokens = response.usage.output_tokens;
      const { cost } = this.calculateCost(
        options.model,
        promptTokens,
        completionTokens
      );

      // Return formatted response
      return {
        content: response.content[0].text,
        metadata: {
          model: options.model,
          totalTokens: promptTokens + completionTokens,
          promptTokens,
          completionTokens,
          timeTakenMs: timeTaken,
          cost,
        },
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
        },
      };
    } catch (error) {
      console.error("Anthropic completion error:", error);
      throw new Error(
        `Anthropic completion failed: ${(error as Error).message}`
      );
    }
  }

  /**
   * Stream a completion from Anthropic
   * @param options Completion options
   * @param callback Callback for handling stream events
   * @returns Promise that resolves when streaming is complete
   */
  async streamCompletion(
    options: LLMCompletionOptions,
    callback: LLMStreamCallback
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Prepare messages
      const messages = [...options.messages];
      const anthropicMessages = this.convertMessages(messages);

      // Set up the request parameters
      const params: Anthropic.MessageCreateParams = {
        model: options.model,
        messages: anthropicMessages,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.7,
        system: options.systemMessage,
        stream: true,
      };

      // Add response format if provided
      if (
        options.responseFormat &&
        options.responseFormat.type === "json_object"
      ) {
        params.response_format = { type: "json_object" };
      }

      // Execute streaming request
      const stream = await this.client.messages.create(params);

      let fullContent = "";
      let promptTokens = 0;
      let completionTokens = 0;

      for await (const chunk of stream) {
        if (chunk.type === "content_block_delta" && chunk.delta.text) {
          fullContent += chunk.delta.text;
          callback({
            type: LLMStreamEventType.Content,
            content: chunk.delta.text,
          });
        }

        // Update token counts if available
        if (chunk.usage) {
          promptTokens = chunk.usage.input_tokens;
          completionTokens = chunk.usage.output_tokens;
        }
      }

      // If we don't have token counts from the stream, estimate them
      if (promptTokens === 0) {
        // For Anthropic, estimating tokens is less reliable, but we can approximate
        promptTokens = Math.ceil(
          options.messages.reduce((acc, msg) => acc + msg.content.length, 0) / 4
        );
        if (options.systemMessage) {
          promptTokens += Math.ceil(options.systemMessage.length / 4);
        }
      }

      if (completionTokens === 0) {
        completionTokens = Math.ceil(fullContent.length / 4);
      }

      // Send end event with metadata
      const timeTaken = Date.now() - startTime;
      const { cost } = this.calculateCost(
        options.model,
        promptTokens,
        completionTokens
      );

      callback({
        type: LLMStreamEventType.End,
        metadata: {
          model: options.model,
          totalTokens: promptTokens + completionTokens,
          promptTokens,
          completionTokens,
          timeTakenMs: timeTaken,
          cost,
        },
      });
    } catch (error) {
      console.error("Anthropic streaming error:", error);
      callback({
        type: LLMStreamEventType.Error,
        error: new Error(
          `Anthropic streaming failed: ${(error as Error).message}`
        ),
      });
    }
  }

  /**
   * Estimate tokens for a piece of text
   * @param text Text to estimate tokens for
   * @returns Estimated number of tokens
   */
  estimateTokens(text: string): number {
    // Anthropic doesn't provide a client-side tokenizer
    // This is a rough approximation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate cost for a completion
   * @param modelId Model ID
   * @param promptTokens Number of prompt tokens
   * @param completionTokens Number of completion tokens
   * @returns Cost information
   */
  private calculateCost(
    modelId: string,
    promptTokens: number,
    completionTokens: number
  ): { cost: number; completionTokens: number } {
    const model = this.getModelById(modelId);

    if (!model) {
      return { cost: 0, completionTokens };
    }

    const promptCost = (promptTokens / 1000) * model.inputCostPer1000Tokens;
    const completionCost =
      (completionTokens / 1000) * model.outputCostPer1000Tokens;

    return {
      cost: promptCost + completionCost,
      completionTokens,
    };
  }

  /**
   * Get a model by ID
   * @param modelId Model ID
   * @returns Model object or undefined if not found
   */
  private getModelById(modelId: string): LLMModel | undefined {
    return this.supportedModels.find((model) => model.id === modelId);
  }
}
