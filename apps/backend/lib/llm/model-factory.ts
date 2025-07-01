/**
 * Model Factory
 * 
 * Factory functions for creating LLM instances based on configuration.
 * Supports both OpenAI and Anthropic models with easy switching.
 */

import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { MODEL_CONFIGS, DEFAULT_MODEL, type ModelConfig } from "./model-config.js";

export interface ModelOverrides {
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
  [key: string]: any; // Allow additional config options
}

/**
 * Creates a chat model instance based on the specified model name or default.
 * 
 * @param modelName - Optional model name. If not provided, uses DEFAULT_MODEL from env.
 * @param overrides - Optional overrides for temperature and maxTokens.
 * @returns A configured chat model instance (ChatOpenAI or ChatAnthropic).
 * @throws Error if the model is unknown or the provider is unsupported.
 */
export function createModel(
  modelName?: string, 
  overrides?: ModelOverrides
): BaseChatModel {
  const model = modelName || DEFAULT_MODEL;
  const config = MODEL_CONFIGS[model];
  
  if (!config) {
    throw new Error(`Unknown model: ${model}. Please add it to MODEL_CONFIGS.`);
  }
  
  // Extract known parameters and rest
  const { temperature, maxTokens, streaming, ...additionalConfig } = overrides || {};
  
  const finalConfig = {
    modelName: model,
    temperature: temperature ?? config.temperature,
    maxTokens: maxTokens ?? config.maxTokens,
    streaming: streaming ?? false,
    ...additionalConfig, // Pass through any additional config options
  };
  
  console.log(`[Model Factory] Creating ${config.provider} model: ${model} (context: ${config.contextWindow} tokens)`);
  
  switch (config.provider) {
    case "openai":
      return new ChatOpenAI(finalConfig);
    
    case "anthropic":
      return new ChatAnthropic(finalConfig);
    
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

/**
 * Gets the configuration for a specific model.
 * 
 * @param modelName - Optional model name. If not provided, uses DEFAULT_MODEL from env.
 * @returns The model configuration object.
 * @throws Error if the model is unknown.
 */
export function getModelConfig(modelName?: string): ModelConfig {
  const model = modelName || DEFAULT_MODEL;
  const config = MODEL_CONFIGS[model];
  
  if (!config) {
    throw new Error(`Unknown model: ${model}`);
  }
  
  return config;
}

/**
 * Gets the current default model name.
 * 
 * @returns The default model name from environment or fallback.
 */
export function getDefaultModel(): string {
  return DEFAULT_MODEL;
}

/**
 * Lists all available models.
 * 
 * @returns An array of available model names.
 */
export function listAvailableModels(): string[] {
  return Object.keys(MODEL_CONFIGS);
}

/**
 * Lists models by provider.
 * 
 * @param provider - The provider to filter by ("openai" or "anthropic").
 * @returns An array of model names for the specified provider.
 */
export function listModelsByProvider(provider: "openai" | "anthropic"): string[] {
  return Object.entries(MODEL_CONFIGS)
    .filter(([_, config]) => config.provider === provider)
    .map(([modelName]) => modelName);
}