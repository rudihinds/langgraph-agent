/**
 * Core types for LLM integration
 */

import { ChatCompletionCreateParams } from "openai/resources/chat/completions";

/**
 * Common interface for all LLM models
 */
export interface LLMModel {
  /** Unique identifier for the model */
  id: string;
  /** Display name for the model */
  name: string;
  /** Provider of the model (e.g., OpenAI, Anthropic) */
  provider: "openai" | "anthropic" | "azure" | "gemini" | "mistral" | "other";
  /** Maximum context window size in tokens */
  contextWindow: number;
  /** Cost per 1000 input tokens in USD */
  inputCostPer1000Tokens: number;
  /** Cost per 1000 output tokens in USD */
  outputCostPer1000Tokens: number;
  /** Whether the model supports streaming */
  supportsStreaming: boolean;
  /** Maximum tokens to generate */
  maxTokens?: number;
}

/**
 * Response from an LLM completion
 */
export interface LLMCompletionResponse {
  /** The generated text */
  content: string;
  /** Additional metadata about the completion */
  metadata: {
    /** Model used for the completion */
    model: string;
    /** Total tokens used (input + output) */
    totalTokens: number;
    /** Tokens used in the prompt */
    promptTokens: number;
    /** Tokens generated in the completion */
    completionTokens: number;
    /** Time taken for the completion in milliseconds */
    timeTakenMs: number;
    /** Cost of the completion in USD */
    cost: number;
    /** Function call if the model called a function */
    functionCall?: { name: string; args: Record<string, any> };
  };
  /** Optional usage information */
  usage?: {
    /** Total tokens used */
    total_tokens: number;
    /** Tokens used in the prompt */
    prompt_tokens: number;
    /** Tokens used in the completion */
    completion_tokens: number;
  };
}

/**
 * Options for LLM completion
 */
export interface LLMCompletionOptions {
  /** The model to use */
  model: string;
  /** The system message to use */
  systemMessage?: string;
  /** The message history */
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  /** Whether to stream the response */
  stream?: boolean;
  /** Max tokens to generate */
  maxTokens?: number;
  /** Temperature for sampling */
  temperature?: number;
  /** Top-p for nucleus sampling */
  topP?: number;
  /** Response format (e.g., json_object) */
  responseFormat?: { type: "json_object" } | { type: "text" };
  /** Whether to cache the response */
  cache?: boolean;
  /** Array of functions the model may generate JSON inputs for */
  functions?: Array<{
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  }>;
  /** Controls which function is called by the model */
  functionCall?: string | { name: string };
  /** Optional timeout in milliseconds */
  timeoutMs?: number;
  /** Optional retry configuration */
  retry?: {
    /** Number of retries */
    attempts: number;
    /** Backoff factor for retries */
    backoffFactor: number;
    /** Initial backoff in milliseconds */
    initialBackoffMs: number;
  };
}

/**
 * Event types for streaming responses
 */
export enum LLMStreamEventType {
  Content = "content",
  FunctionCall = "function_call",
  Error = "error",
  End = "end",
}

/**
 * Stream event for content
 */
export interface LLMStreamContentEvent {
  type: LLMStreamEventType.Content;
  content: string;
}

/**
 * Stream event for function calls
 */
export interface LLMStreamFunctionCallEvent {
  type: LLMStreamEventType.FunctionCall;
  functionName: string;
  content: string;
}

/**
 * Stream event for errors
 */
export interface LLMStreamErrorEvent {
  type: LLMStreamEventType.Error;
  error: Error;
}

/**
 * Stream event for end of stream
 */
export interface LLMStreamEndEvent {
  type: LLMStreamEventType.End;
  /** Metadata about the completion */
  metadata: {
    model: string;
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    timeTakenMs: number;
    cost: number;
    functionCall?: { name: string; args: Record<string, any> };
  };
}

/**
 * Union type for all stream events
 */
export type LLMStreamEvent =
  | LLMStreamContentEvent
  | LLMStreamFunctionCallEvent
  | LLMStreamErrorEvent
  | LLMStreamEndEvent;

/**
 * Callback for handling stream events
 */
export type LLMStreamCallback = (event: LLMStreamEvent) => void;

/**
 * Interface for all LLM clients
 */
export interface LLMClient {
  /** List of supported models */
  supportedModels: LLMModel[];

  /**
   * Get a completion from the LLM
   * @param options Options for the completion
   * @returns Promise with the completion response
   */
  completion(options: LLMCompletionOptions): Promise<LLMCompletionResponse>;

  /**
   * Stream a completion from the LLM
   * @param options Options for the completion
   * @param callback Callback for handling stream events
   * @returns Promise that resolves when the stream is complete
   */
  streamCompletion(
    options: LLMCompletionOptions,
    callback: LLMStreamCallback
  ): Promise<void>;

  /**
   * Estimate tokens for a message
   * @param text Text to estimate tokens for
   * @returns Estimated number of tokens
   */
  estimateTokens(text: string): number;
}
