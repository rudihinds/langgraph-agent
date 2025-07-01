/**
 * Model Factory Tests
 * 
 * Tests for the centralized model factory that supports both OpenAI and Anthropic models
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { createModel } from "../model-factory.js";
import { MODEL_CONFIGS } from "../model-config.js";

// Mock the model constructors
vi.mock("@langchain/openai", () => ({
  ChatOpenAI: vi.fn().mockImplementation((config) => ({
    ...config,
    _type: "openai",
    invoke: vi.fn(),
    stream: vi.fn(),
  })),
}));

vi.mock("@langchain/anthropic", () => ({
  ChatAnthropic: vi.fn().mockImplementation((config) => ({
    ...config,
    _type: "anthropic",
    invoke: vi.fn(),
    stream: vi.fn(),
  })),
}));

// Mock environment variable
const originalEnv = process.env;

describe("Model Factory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("createModel", () => {
    it("should create OpenAI model when specified", () => {
      const model = createModel("gpt-4.1-nano-2025-04-14");
      
      expect(ChatOpenAI).toHaveBeenCalledWith({
        modelName: "gpt-4.1-nano-2025-04-14",
        temperature: 0.3,
        maxTokens: 4000,
        streaming: false,
      });
      expect(model._type).toBe("openai");
    });

    it("should create Anthropic model when specified", () => {
      const model = createModel("claude-3-5-sonnet-20241022");
      
      expect(ChatAnthropic).toHaveBeenCalledWith({
        modelName: "claude-3-5-sonnet-20241022",
        temperature: 0.3,
        maxTokens: 4000,
        streaming: false,
      });
      expect(model._type).toBe("anthropic");
    });

    it("should use default model when none specified", () => {
      process.env.DEFAULT_MODEL = "gpt-4.1-nano-2025-04-14";
      
      const model = createModel();
      
      expect(ChatOpenAI).toHaveBeenCalledWith({
        modelName: "gpt-4.1-nano-2025-04-14",
        temperature: 0.3,
        maxTokens: 4000,
        streaming: false,
      });
    });

    it("should fall back to hardcoded default when env not set", () => {
      delete process.env.DEFAULT_MODEL;
      
      const model = createModel();
      
      expect(ChatOpenAI).toHaveBeenCalledWith({
        modelName: "gpt-4.1-nano-2025-04-14",
        temperature: 0.3,
        maxTokens: 4000,
        streaming: false,
      });
    });

    it("should override temperature and maxTokens", () => {
      const model = createModel("gpt-4o-mini", {
        temperature: 0.8,
        maxTokens: 2000,
      });
      
      expect(ChatOpenAI).toHaveBeenCalledWith({
        modelName: "gpt-4o-mini",
        temperature: 0.8,
        maxTokens: 2000,
        streaming: false,
      });
    });

    it("should handle streaming option", () => {
      const model = createModel("claude-3-haiku-20240307", {
        streaming: true,
      });
      
      expect(ChatAnthropic).toHaveBeenCalledWith({
        modelName: "claude-3-haiku-20240307",
        temperature: 0.3,
        maxTokens: 4000,
        streaming: true,
      });
    });

    it("should throw error for unknown model", () => {
      expect(() => createModel("unknown-model")).toThrow(
        "Unknown model: unknown-model. Please add it to MODEL_CONFIGS."
      );
    });

    it("should respect model-specific defaults", () => {
      const model = createModel("claude-3-opus-20240229");
      
      expect(ChatAnthropic).toHaveBeenCalledWith({
        modelName: "claude-3-opus-20240229",
        temperature: 0.1, // Opus has lower default temperature
        maxTokens: 4000,
        streaming: false,
      });
    });

    it("should handle all configured models", () => {
      // Test that all models in MODEL_CONFIGS can be created
      Object.keys(MODEL_CONFIGS).forEach(modelName => {
        expect(() => createModel(modelName)).not.toThrow();
      });
    });

    it("should pass through additional config options", () => {
      const model = createModel("gpt-4-turbo", {
        temperature: 0.5,
        maxTokens: 1000,
        streaming: true,
        topP: 0.9,
        frequencyPenalty: 0.5,
      } as any);
      
      expect(ChatOpenAI).toHaveBeenCalledWith({
        modelName: "gpt-4-turbo",
        temperature: 0.5,
        maxTokens: 1000,
        streaming: true,
        topP: 0.9,
        frequencyPenalty: 0.5,
      });
    });
  });

  describe("Model Configuration", () => {
    it("should have correct GPT-4.1 Nano configuration", () => {
      const config = MODEL_CONFIGS["gpt-4.1-nano-2025-04-14"];
      
      expect(config.provider).toBe("openai");
      expect(config.contextWindow).toBe(1000000); // 1M tokens
      expect(config.maxOutputTokens).toBe(32000);
      expect(config.temperature).toBe(0.3);
      expect(config.maxTokens).toBe(4000);
    });

    it("should have correct Claude configuration", () => {
      const config = MODEL_CONFIGS["claude-3-5-sonnet-20241022"];
      
      expect(config.provider).toBe("anthropic");
      expect(config.contextWindow).toBe(200000);
      expect(config.maxOutputTokens).toBe(8192);
      expect(config.temperature).toBe(0.3);
      expect(config.maxTokens).toBe(4000);
    });
  });
});