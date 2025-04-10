/**
 * Stream Manager for handling LLM streaming functionality
 *
 * This class provides a unified interface for working with streaming LLM responses,
 * handling events consistently across different providers, and implementing
 * resilience features like automatic retries and fallbacks.
 */

import { EventEmitter } from "events";
import { Logger } from "../../../logger.js";
import { LLMFactory } from "../llm-factory.js";
import { 
  LLMCompletionOptions, 
  LLMStreamCallback, 
  LLMStreamEvent, 
  LLMStreamEventType 
} from "../types.js";

/**
 * Stream Manager Options
 */
export interface StreamManagerOptions {
  /**
   * Default model to use if none is specified
   */
  defaultModel?: string;
  
  /**
   * Enable automatic fallback to backup models on failure
   */
  enableFallbacks?: boolean;
  
  /**
   * Array of fallback models in order of preference
   */
  fallbackModels?: string[];
  
  /**
   * Number of retry attempts before falling back to another model
   */
  maxRetryAttempts?: number;
  
  /**
   * Delay between retry attempts in milliseconds
   */
  retryDelayMs?: number;
  
  /**
   * Whether to enable debug logging
   */
  debug?: boolean;
}

/**
 * Events emitted by the StreamManager
 */
export enum StreamManagerEvents {
  Started = "stream:started",
  Content = "stream:content",
  FunctionCall = "stream:function_call",
  Error = "stream:error",
  Fallback = "stream:fallback",
  Retry = "stream:retry",
  Complete = "stream:complete",
}

/**
 * Stream Manager for handling streaming LLM responses
 * with resilience features
 */
export class StreamManager extends EventEmitter {
  private static instance: StreamManager;
  private logger: Logger;
  private defaultModel: string;
  private enableFallbacks: boolean;
  private fallbackModels: string[];
  private maxRetryAttempts: number;
  private retryDelayMs: number;
  private debug: boolean;

  /**
   * Private constructor for singleton pattern
   */
  private constructor(options: StreamManagerOptions = {}) {
    super();
    this.logger = Logger.getInstance();
    this.defaultModel = options.defaultModel || "claude-3-7-sonnet";
    this.enableFallbacks = options.enableFallbacks ?? true;
    this.fallbackModels = options.fallbackModels || [
      "gpt-4o-mini",
      "gpt-3.5-turbo",
      "mistral-medium"
    ];
    this.maxRetryAttempts = options.maxRetryAttempts || 3;
    this.retryDelayMs = options.retryDelayMs || 1000;
    this.debug = options.debug ?? false;
  }

  /**
   * Get singleton instance of StreamManager
   */
  public static getInstance(options?: StreamManagerOptions): StreamManager {
    if (!StreamManager.instance) {
      StreamManager.instance = new StreamManager(options);
    } else if (options) {
      // Update options if provided
      const instance = StreamManager.instance;
      if (options.defaultModel) {
        instance.defaultModel = options.defaultModel;
      }
      if (options.enableFallbacks !== undefined) {
        instance.enableFallbacks = options.enableFallbacks;
      }
      if (options.fallbackModels) {
        instance.fallbackModels = options.fallbackModels;
      }
      if (options.maxRetryAttempts !== undefined) {
        instance.maxRetryAttempts = options.maxRetryAttempts;
      }
      if (options.retryDelayMs !== undefined) {
        instance.retryDelayMs = options.retryDelayMs;
      }
      if (options.debug !== undefined) {
        instance.debug = options.debug;
      }
    }
    return StreamManager.instance;
  }

  /**
   * Reset the singleton instance (primarily for testing)
   */
  public static resetInstance(): void {
    StreamManager.instance = null as unknown as StreamManager;
  }

  /**
   * Log debug information if debug mode is enabled
   */
  private logDebug(message: string): void {
    if (this.debug) {
      this.logger.debug(`[StreamManager] ${message}`);
    }
  }

  /**
   * Get LLM client for a specific model
   */
  private getClientForModel(modelId: string) {
    const llmFactory = LLMFactory.getInstance();
    return llmFactory.getClientForModel(modelId);
  }

  /**
   * Stream completion with automatic retries and fallbacks
   * 
   * @param options Completion options
   * @param callback Callback for streaming events
   * @returns Promise that resolves when streaming is complete
   */
  public async streamCompletion(
    options: LLMCompletionOptions,
    callback: LLMStreamCallback
  ): Promise<void> {
    const model = options.model || this.defaultModel;
    this.logDebug(`Starting stream with model: ${model}`);

    let currentAttempt = 0;
    let currentModelIndex = -1;
    let currentModel = model;

    // Function to try streaming with the current model
    const tryStream = async (): Promise<void> => {
      currentAttempt++;
      this.logDebug(`Attempt ${currentAttempt} with model ${currentModel}`);
      
      try {
        const client = this.getClientForModel(currentModel);
        
        // Create a wrapper callback to handle events
        const wrappedCallback: LLMStreamCallback = (event: LLMStreamEvent) => {
          // Forward all events to the original callback
          callback(event);
          
          // Also emit events on the StreamManager
          switch (event.type) {
            case LLMStreamEventType.Content:
              this.emit(StreamManagerEvents.Content, {
                model: currentModel,
                attempt: currentAttempt,
                content: event.content,
              });
              break;
            case LLMStreamEventType.FunctionCall:
              this.emit(StreamManagerEvents.FunctionCall, {
                model: currentModel,
                attempt: currentAttempt,
                functionName: event.functionName,
                content: event.content,
              });
              break;
            case LLMStreamEventType.Error:
              this.emit(StreamManagerEvents.Error, {
                model: currentModel,
                attempt: currentAttempt,
                error: event.error,
              });
              break;
            case LLMStreamEventType.End:
              this.emit(StreamManagerEvents.Complete, {
                model: currentModel,
                attempt: currentAttempt,
                metadata: event.metadata,
              });
              break;
          }
        };
        
        // Ensure we're streaming
        const streamOptions = {
          ...options,
          model: currentModel,
          stream: true,
        };
        
        // Emit the started event
        this.emit(StreamManagerEvents.Started, {
          model: currentModel,
          attempt: currentAttempt,
        });
        
        // Perform the streaming completion
        await client.streamCompletion(streamOptions, wrappedCallback);
        
        // If we get here, streaming completed successfully
        return;
        
      } catch (error) {
        this.logDebug(`Error streaming with ${currentModel}: ${error}`);
        
        // Emit the error event
        this.emit(StreamManagerEvents.Error, {
          model: currentModel,
          attempt: currentAttempt,
          error,
        });
        
        // Check if we should retry with the same model
        if (currentAttempt < this.maxRetryAttempts) {
          this.logDebug(`Retrying with the same model (${currentModel})`);
          this.emit(StreamManagerEvents.Retry, {
            model: currentModel,
            attempt: currentAttempt,
            nextAttempt: currentAttempt + 1,
            error,
          });
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, this.retryDelayMs));
          return tryStream();
        }
        
        // If we shouldn't retry or have exhausted retries, check for fallback
        if (this.enableFallbacks && this.fallbackModels.length > 0) {
          // Move to the next fallback model
          currentModelIndex++;
          
          // Check if we have another fallback model
          if (currentModelIndex < this.fallbackModels.length) {
            currentModel = this.fallbackModels[currentModelIndex];
            currentAttempt = 0; // Reset attempt counter for the new model
            
            this.logDebug(`Falling back to model: ${currentModel}`);
            this.emit(StreamManagerEvents.Fallback, {
              previousModel: options.model,
              fallbackModel: currentModel,
              error,
            });
            
            // Try with the fallback model
            return tryStream();
          }
        }
        
        // If we get here, we've exhausted all retries and fallbacks
        this.logDebug("Exhausted all retry attempts and fallback models");
        
        // Forward the final error to the callback
        callback({
          type: LLMStreamEventType.Error,
          error: new Error(
            `Failed to stream completion after ${currentAttempt} attempts` +
            ` with model ${currentModel}: ${(error as Error).message}`
          ),
        });
        
        // Re-throw to signal completion failure
        throw error;
      }
    };
    
    // Start the streaming process
    await tryStream();
  }

  /**
   * Stream a completion with a specific model
   * (Simplified version without retries or fallbacks)
   */
  public async streamWithModel(
    modelId: string,
    options: Omit<LLMCompletionOptions, "model">,
    callback: LLMStreamCallback
  ): Promise<void> {
    const completionOptions: LLMCompletionOptions = {
      ...options,
      model: modelId,
      stream: true,
    };
    
    return this.streamCompletion(completionOptions, callback);
  }
}