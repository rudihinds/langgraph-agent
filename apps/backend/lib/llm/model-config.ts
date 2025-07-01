/**
 * Centralized Model Configuration
 * 
 * This file contains configuration for all supported LLM models,
 * allowing easy switching between OpenAI and Anthropic models.
 */

export interface ModelConfig {
  provider: "openai" | "anthropic";
  contextWindow: number;
  maxOutputTokens: number;
  temperature: number;
  maxTokens: number;
  description?: string;
}

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  // OpenAI Models
  "gpt-4.1-nano-2025-04-14": {
    provider: "openai",
    contextWindow: 1000000, // 1M tokens!
    maxOutputTokens: 32000,
    temperature: 0.3,
    maxTokens: 4000,
    description: "Fastest, cheapest GPT-4.1 model with 1M context"
  },
  "gpt-4o": {
    provider: "openai",
    contextWindow: 128000,
    maxOutputTokens: 4096,
    temperature: 0.3,
    maxTokens: 4000,
    description: "GPT-4 Omni - balanced performance"
  },
  "gpt-4o-mini": {
    provider: "openai",
    contextWindow: 128000,
    maxOutputTokens: 16384,
    temperature: 0.3,
    maxTokens: 4000,
    description: "Smaller, faster GPT-4 variant"
  },
  "gpt-4-turbo": {
    provider: "openai",
    contextWindow: 128000,
    maxOutputTokens: 4096,
    temperature: 0.3,
    maxTokens: 4000,
    description: "GPT-4 Turbo - optimized for speed"
  },
  
  // Anthropic Models
  "claude-3-5-sonnet-20241022": {
    provider: "anthropic", 
    contextWindow: 200000,
    maxOutputTokens: 8192,
    temperature: 0.3,
    maxTokens: 4000,
    description: "Claude 3.5 Sonnet - balanced performance"
  },
  "claude-3-haiku-20240307": {
    provider: "anthropic",
    contextWindow: 200000,
    maxOutputTokens: 4096,
    temperature: 0.3,
    maxTokens: 4000,
    description: "Claude 3 Haiku - faster, lighter"
  },
  "claude-3-opus-20240229": {
    provider: "anthropic",
    contextWindow: 200000,
    maxOutputTokens: 4096,
    temperature: 0.1, // Lower temperature for Opus
    maxTokens: 4000,
    description: "Claude 3 Opus - highest capability"
  }
};

// Default model from environment variable or fallback
export const DEFAULT_MODEL = process.env.DEFAULT_MODEL || "gpt-4.1-nano-2025-04-14";

// Validate that the default model exists
if (!MODEL_CONFIGS[DEFAULT_MODEL]) {
  console.warn(`Warning: Default model ${DEFAULT_MODEL} not found in MODEL_CONFIGS. Falling back to gpt-4.1-nano-2025-04-14`);
}