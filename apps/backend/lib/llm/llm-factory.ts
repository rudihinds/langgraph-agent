/**
 * LLM Factory for creating and managing different LLM clients
 */

import { OpenAIClient } from "./openai-client.js";
import { AnthropicClient } from "./anthropic-client.js";
import { MistralClient } from "./mistral-client.js";
import { GeminiClient } from "./gemini-client.js";
import { LLMClient, LLMModel } from "./types.js";

/**
 * Available LLM providers
 */
type LLMProvider = "openai" | "anthropic" | "mistral" | "gemini";

/**
 * LLM Factory for creating and accessing LLM clients
 */
export class LLMFactory {
  private static instance: LLMFactory;
  private clients: Map<LLMProvider, LLMClient> = new Map();

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    // Initialize clients
    this.clients.set("openai", new OpenAIClient());
    this.clients.set("anthropic", new AnthropicClient());
    this.clients.set("mistral", new MistralClient());
    this.clients.set("gemini", new GeminiClient());
  }

  /**
   * Get the singleton instance of LLMFactory
   */
  public static getInstance(): LLMFactory {
    if (!LLMFactory.instance) {
      LLMFactory.instance = new LLMFactory();
    }
    return LLMFactory.instance;
  }

  /**
   * Get a specific LLM client by provider
   * @param provider The LLM provider
   * @returns The LLM client instance
   */
  public getClient(provider: LLMProvider): LLMClient {
    const client = this.clients.get(provider);
    if (!client) {
      throw new Error(`LLM provider '${provider}' not supported`);
    }
    return client;
  }

  /**
   * Get a client for a specific model ID
   * @param modelId The model ID
   * @returns The appropriate LLM client for this model
   */
  public getClientForModel(modelId: string): LLMClient {
    // Check each client to see if it supports the model
    for (const [_, client] of this.clients) {
      if (client.supportedModels.some((model) => model.id === modelId)) {
        return client;
      }
    }

    throw new Error(`No client found for model ID '${modelId}'`);
  }

  /**
   * Get all available models across all providers
   * @returns Array of all supported models
   */
  public getAllModels(): LLMModel[] {
    const models: LLMModel[] = [];

    for (const [_, client] of this.clients) {
      models.push(...client.supportedModels);
    }

    return models;
  }

  /**
   * Get models filtered by provider
   * @param provider The provider to filter by
   * @returns Array of models from the specified provider
   */
  public getModelsByProvider(provider: LLMProvider): LLMModel[] {
    const client = this.clients.get(provider);
    if (!client) {
      return [];
    }
    return [...client.supportedModels];
  }

  /**
   * Get model by ID
   * @param modelId The model ID to find
   * @returns The model or undefined if not found
   */
  public getModelById(modelId: string): LLMModel | undefined {
    for (const [_, client] of this.clients) {
      const model = client.supportedModels.find(
        (model) => model.id === modelId
      );
      if (model) {
        return model;
      }
    }
    return undefined;
  }
}
