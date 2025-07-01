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
  "gpt-3.5-turbo": {
    provider: "openai",
    contextWindow: 16385,
    maxOutputTokens: 4096,
    temperature: 0.3,
    maxTokens: 4000,
    description: "GPT-3.5 Turbo - fast and efficient"
  },
  
  // Anthropic Models
  "claude-3-5-sonnet-20241022": {
    provider: "anthropic", 
    contextWindow: 200000,
    maxOutputTokens: 8192,
    temperature: 0.3,
    maxTokens: 4000,
    description: "Claude 3.5 Sonnet - latest version"
  },
  "claude-3-5-sonnet-20240620": {
    provider: "anthropic", 
    contextWindow: 200000,
    maxOutputTokens: 8192,
    temperature: 0.3,
    maxTokens: 4000,
    description: "Claude 3.5 Sonnet - older version"
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
let defaultModel = process.env.DEFAULT_MODEL || "gpt-4.1-nano-2025-04-14";

// Handle provider-prefixed default model (e.g., "anthropic/claude-3-5-sonnet")
if (defaultModel.includes('/')) {
  const parts = defaultModel.split('/');
  if (parts.length === 2) {
    defaultModel = parts[1];
  }
}

export const DEFAULT_MODEL = defaultModel;

// Validate that the default model exists
if (!MODEL_CONFIGS[DEFAULT_MODEL]) {
  console.warn(`Warning: Default model ${DEFAULT_MODEL} not found in MODEL_CONFIGS. Falling back to gpt-4.1-nano-2025-04-14`);
}