/**
 * LangGraph Streaming Adapter
 *
 * Provides streaming capabilities for LangGraph nodes,
 * allowing real-time updates from LLM interactions.
 */

import { randomUUID } from "crypto";
import {
  LLMCompletionOptions,
  LLMStreamEvent,
  LLMStreamEventType,
} from "../types.js";
import { StreamManager } from "./stream-manager.js";
import { Logger } from "../../logger.js";

/**
 * Configuration for the LangGraph streaming node
 */
export interface LangGraphStreamConfig {
  /**
   * Channel ID for this stream (defaults to a random UUID)
   */
  channelId?: string;

  /**
   * Whether to aggregate all content into a single full response
   */
  aggregateContent?: boolean;

  /**
   * Whether to enable debug logging
   */
  debug?: boolean;

  /**
   * Event handlers for stream events
   */
  handlers?: {
    onContent?: (content: string, fullContent: string) => void;
    onFunctionCall?: (functionName: string, content: string) => void;
    onError?: (error: Error) => void;
    onComplete?: (metadata: any) => void;
  };
}

/**
 * Structure returned by streaming node functions
 */
export interface StreamingNodeResult<T> {
  /**
   * Channel ID for this stream
   */
  streamId: string;

  /**
   * Whether the stream has completed
   */
  isComplete: boolean;

  /**
   * Content received so far (if aggregating)
   */
  content: string;

  /**
   * Additional data the node might return
   */
  data?: T;

  /**
   * Metadata about the completion (populated when complete)
   */
  metadata?: {
    model: string;
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    timeTakenMs: number;
    cost: number;
  };

  /**
   * Error information if stream failed
   */
  error?: Error;
}

/**
 * Create a streaming function compatible with LangGraph nodes
 *
 * @param options LLM completion options
 * @param config Stream configuration
 * @returns Function that returns a StreamingNodeResult
 */
export function createStreamingNode<T = any>(
  options: LLMCompletionOptions,
  config: LangGraphStreamConfig = {}
): () => Promise<StreamingNodeResult<T>> {
  // Generate a unique channel ID for this stream
  const channelId = config.channelId || randomUUID();
  const logger = Logger.getInstance();
  const debug = config.debug ?? false;
  const aggregateContent = config.aggregateContent ?? true;

  // Get the stream manager instance
  const streamManager = StreamManager.getInstance();

  let fullContent = "";
  let isComplete = false;
  let responseMetadata: any = null;
  let streamError: Error | null = null;

  return async (): Promise<StreamingNodeResult<T>> => {
    if (debug) {
      logger.debug(`[StreamingNode:${channelId}] Starting stream`);
    }

    // Start the streaming process
    streamManager
      .streamCompletion(options, (event: LLMStreamEvent) => {
        switch (event.type) {
          case LLMStreamEventType.Content:
            if (aggregateContent) {
              fullContent += event.content;
            }

            if (debug) {
              logger.debug(
                `[StreamingNode:${channelId}] Content: ${event.content}`
              );
            }

            if (config.handlers?.onContent) {
              config.handlers.onContent(event.content, fullContent);
            }
            break;

          case LLMStreamEventType.FunctionCall:
            if (debug) {
              logger.debug(
                `[StreamingNode:${channelId}] Function call: ${event.functionName}`
              );
            }

            if (config.handlers?.onFunctionCall) {
              config.handlers.onFunctionCall(event.functionName, event.content);
            }
            break;

          case LLMStreamEventType.Error:
            if (debug) {
              logger.debug(
                `[StreamingNode:${channelId}] Error: ${event.error.message}`
              );
            }

            streamError = event.error;

            if (config.handlers?.onError) {
              config.handlers.onError(event.error);
            }
            break;

          case LLMStreamEventType.End:
            isComplete = true;
            responseMetadata = event.metadata;

            if (debug) {
              logger.debug(
                `[StreamingNode:${channelId}] Stream complete: ${JSON.stringify(
                  event.metadata
                )}`
              );
            }

            if (config.handlers?.onComplete) {
              config.handlers.onComplete(event.metadata);
            }
            break;
        }
      })
      .catch((error) => {
        // Handle any errors from the stream completion
        isComplete = true;
        streamError = error;

        if (debug) {
          logger.debug(
            `[StreamingNode:${channelId}] Stream failed: ${error.message}`
          );
        }

        if (config.handlers?.onError) {
          config.handlers.onError(error);
        }
      });

    // Return the streaming node result
    return {
      streamId: channelId,
      isComplete,
      content: fullContent,
      metadata: responseMetadata,
      error: streamError || undefined,
    };
  };
}

/**
 * Create a simple streaming LLM node for LangGraph
 *
 * @param promptTemplate Function that generates the prompt from state
 * @param streamConfig Streaming configuration
 * @returns LangGraph node function
 */
export function createStreamingLLMNode<TState>(
  promptTemplate: (state: TState) => {
    model: string;
    systemMessage?: string;
    messages: Array<{ role: string; content: string }>;
    functions?: Array<{
      name: string;
      description?: string;
      parameters: Record<string, unknown>;
    }>;
  },
  streamConfig: LangGraphStreamConfig = {}
) {
  return async (state: TState) => {
    // Generate prompt from state
    const prompt = promptTemplate(state);

    // Set up LLM options
    const options: LLMCompletionOptions = {
      model: prompt.model,
      systemMessage: prompt.systemMessage,
      messages: prompt.messages as any,
      stream: true,
    };

    if (prompt.functions) {
      options.functions = prompt.functions;
    }

    // Create the streaming node
    const streamingNode = createStreamingNode(options, streamConfig);

    // Run the node
    const result = await streamingNode();

    // Return the result (will be incorporated into state)
    return result;
  };
}
