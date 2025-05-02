/**
 * OpenAI implementation of the LLM client
 */

import {
  LLMClient,
  LLMCompletionOptions,
  LLMCompletionResponse,
  LLMModel,
  LLMStreamCallback,
  LLMStreamEventType,
} from "./types.js";
import OpenAI from "openai";
import tiktoken from "tiktoken";
import { env } from "../config/env.js";

/**
 * OpenAI models configuration
 */
const OPENAI_MODELS: LLMModel[] = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    contextWindow: 128000,
    inputCostPer1000Tokens: 0.005,
    outputCostPer1000Tokens: 0.015,
    supportsStreaming: true,
  },
  {
    id: "o3-mini",
    name: "O3 Mini",
    provider: "openai",
    contextWindow: 200000,
    inputCostPer1000Tokens: 0.00025,
    outputCostPer1000Tokens: 0.00075,
    supportsStreaming: true,
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    contextWindow: 128000,
    inputCostPer1000Tokens: 0.00015,
    outputCostPer1000Tokens: 0.0006,
    supportsStreaming: true,
  },
  {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    provider: "openai",
    contextWindow: 128000,
    inputCostPer1000Tokens: 0.01,
    outputCostPer1000Tokens: 0.03,
    supportsStreaming: true,
  },
  {
    id: "gpt-4",
    name: "GPT-4",
    provider: "openai",
    contextWindow: 8192,
    inputCostPer1000Tokens: 0.03,
    outputCostPer1000Tokens: 0.06,
    supportsStreaming: true,
  },
  {
    id: "gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    provider: "openai",
    contextWindow: 16385,
    inputCostPer1000Tokens: 0.0005,
    outputCostPer1000Tokens: 0.0015,
    supportsStreaming: true,
  },
];

/**
 * OpenAI client implementation
 */
export class OpenAIClient implements LLMClient {
  private client: OpenAI;
  private encoderCache: Record<string, tiktoken.Tiktoken | null> = {};
  supportedModels = OPENAI_MODELS;

  /**
   * Create a new OpenAI client
   * @param apiKey Optional API key (defaults to env.OPENAI_API_KEY)
   */
  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || env.OPENAI_API_KEY,
    });
  }

  /**
   * Get a completion from OpenAI
   * @param options Completion options
   * @returns Promise with completion response
   */
  async completion(
    options: LLMCompletionOptions
  ): Promise<LLMCompletionResponse> {
    const startTime = Date.now();

    try {
      // Prepare messages array with system message if provided
      const messages = options.systemMessage
        ? [
            { role: "system", content: options.systemMessage },
            ...options.messages,
          ]
        : [...options.messages];

      // Estimate tokens to ensure we don't exceed max_tokens
      const promptTokens = this.estimateInputTokens(messages, options.model);
      const model = this.getModelById(options.model);
      const maxOutputTokens =
        options.maxTokens ||
        (model
          ? Math.min(
              4096,
              Math.floor((model.contextWindow - promptTokens) * 0.8)
            )
          : 4096);

      // Create completion request
      const completionRequest: any = {
        model: options.model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: maxOutputTokens,
        top_p: options.topP ?? 1,
      };

      // Add function calling options if provided
      if (options.functions) {
        completionRequest.functions = options.functions;
      }

      if (options.functionCall) {
        completionRequest.function_call = options.functionCall;
      }

      // Add response format if provided
      if (options.responseFormat) {
        completionRequest.response_format = options.responseFormat;
      }

      // Execute request
      const response =
        await this.client.chat.completions.create(completionRequest);
      const timeTaken = Date.now() - startTime;

      // Calculate costs
      const { cost, completionTokens } = this.calculateCost(
        options.model,
        response.usage?.prompt_tokens || promptTokens,
        response.usage?.completion_tokens || 0
      );

      // Return formatted response
      return {
        content: response.choices[0]?.message?.content || "",
        metadata: {
          model: options.model,
          totalTokens: response.usage?.total_tokens || 0,
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          timeTakenMs: timeTaken,
          cost,
        },
        usage: response.usage,
      };
    } catch (error) {
      console.error("OpenAI completion error:", error);
      throw new Error(`OpenAI completion failed: ${(error as Error).message}`);
    }
  }

  /**
   * Stream a completion from OpenAI
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
      // Prepare messages array with system message if provided
      const messages = options.systemMessage
        ? [
            { role: "system", content: options.systemMessage },
            ...options.messages,
          ]
        : [...options.messages];

      // Estimate tokens to ensure we don't exceed max_tokens
      const promptTokens = this.estimateInputTokens(messages, options.model);
      const model = this.getModelById(options.model);
      const maxOutputTokens =
        options.maxTokens ||
        (model
          ? Math.min(
              4096,
              Math.floor((model.contextWindow - promptTokens) * 0.8)
            )
          : 4096);

      // Create completion request
      const completionRequest: any = {
        model: options.model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: maxOutputTokens,
        top_p: options.topP ?? 1,
        stream: true,
      };

      // Add function calling options if provided
      if (options.functions) {
        completionRequest.functions = options.functions;
      }

      if (options.functionCall) {
        completionRequest.function_call = options.functionCall;
      }

      // Add response format if provided
      if (options.responseFormat) {
        completionRequest.response_format = options.responseFormat;
      }

      // Execute streaming request
      const stream =
        await this.client.chat.completions.create(completionRequest);

      let fullContent = "";
      let completionTokens = 0;

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullContent += content;
          completionTokens += this.estimateTokens(content);
          callback({
            type: LLMStreamEventType.Content,
            content,
          });
        }

        // Handle function calls if present
        if (chunk.choices[0]?.delta?.function_call) {
          const functionCall = chunk.choices[0].delta.function_call;
          callback({
            type: LLMStreamEventType.FunctionCall,
            functionName: functionCall.name || "",
            content: functionCall.arguments || "",
          });
        }
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
      console.error("OpenAI streaming error:", error);
      callback({
        type: LLMStreamEventType.Error,
        error: new Error(
          `OpenAI streaming failed: ${(error as Error).message}`
        ),
      });
    }
  }

  /**
   * Estimate tokens for a piece of text
   * @param text Text to estimate tokens for
   * @param model Optional model ID for more accurate estimation
   * @returns Estimated number of tokens
   */
  estimateTokens(text: string, model?: string): number {
    try {
      const encoding = this.getTokenEncoder(model || "gpt-4");
      if (!encoding) return Math.ceil(text.length / 3); // Fallback approximation

      const tokens = encoding.encode(text);
      return tokens.length;
    } catch (e) {
      console.warn("Error estimating tokens, using approximation:", e);
      return Math.ceil(text.length / 3);
    }
  }

  /**
   * Estimate input tokens for messages
   * @param messages Array of messages
   * @param model Model ID
   * @returns Estimated number of tokens
   */
  private estimateInputTokens(
    messages: Array<{ role: string; content: string }>,
    model: string
  ): number {
    // Base tokens for the request
    let tokenCount = 3; // Every request starts with 3 tokens for basic formatting

    for (const message of messages) {
      // Add tokens for message formatting (role formatting)
      tokenCount += 4;

      // Add tokens for content
      tokenCount += this.estimateTokens(message.content, model);
    }

    return tokenCount;
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

  /**
   * Get a token encoder for a model
   * @param model Model name or ID
   * @returns Tiktoken encoder or null if not available
   */
  private getTokenEncoder(model: string): tiktoken.Tiktoken | null {
    if (this.encoderCache[model]) {
      return this.encoderCache[model];
    }

    try {
      let encoding: tiktoken.Tiktoken;

      if (model.startsWith("gpt-4")) {
        encoding = tiktoken.encoding_for_model("gpt-4");
      } else if (model.startsWith("gpt-3.5")) {
        encoding = tiktoken.encoding_for_model("gpt-3.5-turbo");
      } else {
        encoding = tiktoken.get_encoding("cl100k_base"); // Default for newer models
      }

      this.encoderCache[model] = encoding;
      return encoding;
    } catch (e) {
      console.warn(`Could not load tiktoken for ${model}:`, e);
      this.encoderCache[model] = null;
      return null;
    }
  }
}
