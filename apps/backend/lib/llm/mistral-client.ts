/**
 * Mistral implementation of the LLM client
 */

import {
  LLMClient,
  LLMCompletionOptions,
  LLMCompletionResponse,
  LLMModel,
  LLMStreamCallback,
  LLMStreamEventType,
} from "./types.js";
import { ChatMistralAI } from "@langchain/mistralai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { env } from "../../env.js";

/**
 * Mistral models configuration
 */
const MISTRAL_MODELS: LLMModel[] = [
  {
    id: "mistral-large-latest",
    name: "Mistral Large",
    provider: "mistral",
    contextWindow: 32768,
    inputCostPer1000Tokens: 0.008,
    outputCostPer1000Tokens: 0.024,
    supportsStreaming: true,
  },
  {
    id: "mistral-medium-latest",
    name: "Mistral Medium",
    provider: "mistral",
    contextWindow: 32768,
    inputCostPer1000Tokens: 0.0027,
    outputCostPer1000Tokens: 0.0081,
    supportsStreaming: true,
  },
  {
    id: "mistral-small-latest",
    name: "Mistral Small",
    provider: "mistral",
    contextWindow: 32768,
    inputCostPer1000Tokens: 0.0014,
    outputCostPer1000Tokens: 0.0042,
    supportsStreaming: true,
  },
  {
    id: "open-mistral-7b",
    name: "Open Mistral 7B",
    provider: "mistral",
    contextWindow: 8192,
    inputCostPer1000Tokens: 0.0002,
    outputCostPer1000Tokens: 0.0002,
    supportsStreaming: true,
  },
];

/**
 * Mistral client implementation
 */
export class MistralClient implements LLMClient {
  private client: ChatMistralAI;
  supportedModels = MISTRAL_MODELS;

  /**
   * Create a new Mistral client
   * @param apiKey Optional API key (defaults to env.MISTRAL_API_KEY)
   */
  constructor(apiKey?: string) {
    this.client = new ChatMistralAI({
      apiKey: apiKey || env.MISTRAL_API_KEY,
    }).withRetry({ stopAfterAttempt: 3 });
  }

  /**
   * Convert LangChain message format to Mistral message format
   * @param messages Array of LangChain messages
   * @returns Array of formatted messages for Mistral
   */
  private convertMessages(messages: Array<{ role: string; content: string }>) {
    return messages.map((message) => {
      if (message.role === "system") {
        return new SystemMessage(message.content);
      } else if (message.role === "user" || message.role === "human") {
        return new HumanMessage(message.content);
      } else if (message.role === "assistant" || message.role === "ai") {
        return { role: "assistant", content: message.content };
      }
      // Default to user role for unknown roles
      return new HumanMessage(message.content);
    });
  }

  /**
   * Get a completion from Mistral
   * @param options Completion options
   * @returns Promise with completion response
   */
  async completion(
    options: LLMCompletionOptions
  ): Promise<LLMCompletionResponse> {
    const startTime = Date.now();

    try {
      // Prepare messages
      let messages = this.convertMessages([...options.messages]);

      // Add system message if provided
      if (options.systemMessage) {
        messages = [new SystemMessage(options.systemMessage), ...messages];
      }

      // Configure the model client
      const modelInstance = this.client.bind({
        model: options.model,
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens,
        topP: options.topP,
        tools: options.functions,
        toolChoice: options.functionCall
          ? { type: "function", function: { name: options.functionCall } }
          : undefined,
        responseFormat: options.responseFormat,
      });

      // Execute request
      const response = await modelInstance.invoke(messages);
      const timeTaken = Date.now() - startTime;

      // Approximate token count
      // Mistral's JS client doesn't report exact token counts
      const promptTokens = this.estimateTokens(
        messages
          .map((msg) => (typeof msg === "string" ? msg : msg.content))
          .join(" ")
      );
      const completionTokens = this.estimateTokens(response.content);

      // Calculate cost
      const { cost } = this.calculateCost(
        options.model,
        promptTokens,
        completionTokens
      );

      // Return formatted response
      return {
        content: response.content,
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
      console.error("Mistral completion error:", error);
      throw new Error(`Mistral completion failed: ${(error as Error).message}`);
    }
  }

  /**
   * Stream a completion from Mistral
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
      let messages = this.convertMessages([...options.messages]);

      // Add system message if provided
      if (options.systemMessage) {
        messages = [new SystemMessage(options.systemMessage), ...messages];
      }

      // Configure the model client
      const modelInstance = this.client.bind({
        model: options.model,
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens,
        topP: options.topP,
        streaming: true,
        tools: options.functions,
        toolChoice: options.functionCall
          ? { type: "function", function: { name: options.functionCall } }
          : undefined,
        responseFormat: options.responseFormat,
      });

      let fullContent = "";
      let functionCallContent = "";
      let functionCallName = "";
      let isFunctionCall = false;
      const promptTokens = this.estimateTokens(
        messages
          .map((msg) => (typeof msg === "string" ? msg : msg.content))
          .join(" ")
      );

      // Execute streaming request
      const stream = await modelInstance.stream(messages);

      for await (const chunk of stream) {
        // Regular content
        if (chunk.content && !isFunctionCall) {
          fullContent += chunk.content;
          callback({
            type: LLMStreamEventType.Content,
            content: chunk.content,
          });
        }

        // Handle function calls if present
        if (
          chunk.additional_kwargs?.tool_calls &&
          chunk.additional_kwargs.tool_calls.length > 0
        ) {
          isFunctionCall = true;
          const toolCall = chunk.additional_kwargs.tool_calls[0];

          if (toolCall.function) {
            if (toolCall.function.name && !functionCallName) {
              functionCallName = toolCall.function.name;
            }

            if (toolCall.function.arguments) {
              const newContent = toolCall.function.arguments;
              functionCallContent += newContent;

              callback({
                type: LLMStreamEventType.FunctionCall,
                functionName: functionCallName,
                content: newContent,
              });
            }
          }
        }
      }

      // Calculate completion tokens and cost
      const completionTokens = isFunctionCall
        ? this.estimateTokens(functionCallContent)
        : this.estimateTokens(fullContent);

      const { cost } = this.calculateCost(
        options.model,
        promptTokens,
        completionTokens
      );
      const timeTaken = Date.now() - startTime;

      // Send end event with metadata
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
      console.error("Mistral streaming error:", error);
      callback({
        type: LLMStreamEventType.Error,
        error: new Error(
          `Mistral streaming failed: ${(error as Error).message}`
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
    // Mistral doesn't provide a client-side tokenizer
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
