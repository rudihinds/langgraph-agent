import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { ENV } from "../../lib/config/env.js";
import { AgentType } from "./state.js";
import { createModel } from "@/lib/llm/model-factory.js";

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
  const modelName = options?.model || ENV.DEFAULT_MODEL;
  
  const llm = createModel(modelName, {
    temperature: options?.temperature ?? 0.1,
    maxTokens: options?.maxTokens,
  });
  
  return llm.withRetry({ stopAfterAttempt: 3 });
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
    llmModel: ENV.DEFAULT_MODEL || "gpt-4.1-nano-2025-04-14",
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
