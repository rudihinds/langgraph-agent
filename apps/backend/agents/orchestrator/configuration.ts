import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { ENV } from "../../lib/config/env.js";
import { AgentType } from "./state.js";

/**
 * Configuration options for the workflow orchestrator
 */
export interface OrchestratorConfig {
  /**
   * Maximum number of retries for failed steps
   */
  maxRetries: number;

  /**
   * Delay in milliseconds between retries
   */
  retryDelayMs: number;

  /**
   * Timeout in milliseconds for each step
   */
  stepTimeoutMs: number;

  /**
   * Timeout in milliseconds for the entire workflow
   */
  workflowTimeoutMs: number;

  /**
   * Whether to persist state between steps
   */
  persistState: boolean;

  /**
   * Whether to enable debug logging
   */
  debug: boolean;

  /**
   * The LLM model to use for orchestration tasks
   */
  llmModel: string;

  /**
   * Custom agent-specific configurations
   */
  agentConfigs: Record<string, any>;
}

/**
 * Available LLM provider options
 */
type LLMProvider = "openai" | "anthropic";

/**
 * Custom LLM configuration options
 */
interface LLMOptions {
  provider: LLMProvider;
  model?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

/**
 * Create the default LLM based on environment and configuration
 */
function createDefaultLLM(options?: Partial<LLMOptions>): BaseLanguageModel {
  const provider =
    options?.provider ||
    (ENV.DEFAULT_MODEL.includes("anthropic") ? "anthropic" : "openai");

  switch (provider) {
    case "anthropic":
      return new ChatAnthropic({
        temperature: options?.temperature ?? 0.1,
        modelName: options?.model ?? "claude-3-5-sonnet-20240620",
        maxTokens: options?.maxTokens,
      }).withRetry({ stopAfterAttempt: 3 });
    case "openai":
    default:
      return new ChatOpenAI({
        temperature: options?.temperature ?? 0.1,
        modelName: options?.model ?? "gpt-4o",
        maxTokens: options?.maxTokens,
      }).withRetry({ stopAfterAttempt: 3 });
  }
}

/**
 * Create a default configuration with sensible defaults
 */
export function createDefaultConfig(): OrchestratorConfig {
  return {
    maxRetries: 3,
    retryDelayMs: 1000,
    stepTimeoutMs: 60000, // 1 minute
    workflowTimeoutMs: 600000, // 10 minutes
    persistState: true,
    debug: false,
    llmModel: "gpt-4-turbo",
    agentConfigs: {},
  };
}

/**
 * Merge user configuration with default values
 */
function mergeConfig(
  userConfig: Partial<OrchestratorConfig> = {}
): OrchestratorConfig {
  return {
    ...createDefaultConfig(),
    ...userConfig,
    // Deep merge for nested objects
    agentConfigs: {
      ...createDefaultConfig().agentConfigs,
      ...userConfig.agentConfigs,
    },
  };
}

/**
 * Map of available agents by type
 */
const AVAILABLE_AGENTS: Record<AgentType, string> = {
  proposal: "ProposalAgent",
  research: "ResearchAgent",
  solution_analysis: "SolutionAnalysisAgent",
  evaluation: "EvaluationAgent",
};
