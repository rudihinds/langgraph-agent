/**
 * Gemini implementation of the LLM client
 */

import { 
  LLMClient, 
  LLMCompletionOptions, 
  LLMCompletionResponse, 
  LLMModel, 
  LLMStreamCallback,
  LLMStreamEventType
} from './types.js';
import { GoogleGenerativeAI, GenerativeModel, Part } from '@google/generative-ai';
import { env } from '../../env.js';

/**
 * Gemini models configuration
 */
const GEMINI_MODELS: LLMModel[] = [
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'gemini',
    contextWindow: 1000000, // 1M tokens context window
    inputCostPer1000Tokens: 0.0010,
    outputCostPer1000Tokens: 0.0020,
    supportsStreaming: true,
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'gemini',
    contextWindow: 1000000, // 1M tokens context window
    inputCostPer1000Tokens: 0.00035,
    outputCostPer1000Tokens: 0.00070,
    supportsStreaming: true,
  },
  {
    id: 'gemini-1.0-pro',
    name: 'Gemini 1.0 Pro',
    provider: 'gemini',
    contextWindow: 32768,
    inputCostPer1000Tokens: 0.00025,
    outputCostPer1000Tokens: 0.0005,
    supportsStreaming: true,
  },
];

/**
 * Interface for Gemini function calling
 */
interface GeminiFunctionCallResult {
  name: string;
  args: Record<string, any>;
}

/**
 * Gemini client implementation
 */
export class GeminiClient implements LLMClient {
  private client: GoogleGenerativeAI;
  supportedModels = GEMINI_MODELS;

  /**
   * Create a new Gemini client
   * @param apiKey Optional API key (defaults to env.GEMINI_API_KEY)
   */
  constructor(apiKey?: string) {
    this.client = new GoogleGenerativeAI(apiKey || env.GEMINI_API_KEY);
  }

  /**
   * Convert messages to Gemini format
   * @param messages Array of messages with role and content
   * @param systemMessage Optional system message
   * @returns Formatted content parts for Gemini
   */
  private convertMessages(
    messages: Array<{ role: string; content: string }>,
    systemMessage?: string
  ): Part[] {
    const parts: Part[] = [];
    
    // If there's a system message, add it as a first user message
    if (systemMessage) {
      parts.push({
        role: 'user',
        parts: [{ text: systemMessage }]
      });
      
      // If the first message is from a user, add an empty assistant response
      // to maintain the proper conversation flow after the system message
      if (messages.length > 0 && (messages[0].role === 'user' || messages[0].role === 'human')) {
        parts.push({
          role: 'model',
          parts: [{ text: '' }]
        });
      }
    }
    
    // Convert and add the rest of the messages
    for (const message of messages) {
      if (message.role === 'user' || message.role === 'human') {
        parts.push({
          role: 'user',
          parts: [{ text: message.content }]
        });
      } else if (message.role === 'assistant' || message.role === 'ai') {
        parts.push({
          role: 'model',
          parts: [{ text: message.content }]
        });
      }
      // Ignore system messages as they were handled above
    }
    
    return parts;
  }

  /**
   * Get a completion from Gemini
   * @param options Completion options
   * @returns Promise with completion response
   */
  async completion(options: LLMCompletionOptions): Promise<LLMCompletionResponse> {
    const startTime = Date.now();

    try {
      // Create model instance
      const model = this.client.getGenerativeModel({
        model: options.model,
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens,
          topP: options.topP,
        },
        // Configure tools/functions if provided
        tools: options.functions ? [{
          functionDeclarations: options.functions.map(func => ({
            name: func.name,
            description: func.description || '',
            parameters: func.parameters
          }))
        }] : undefined,
      });

      // Prepare messages
      const parts = this.convertMessages([...options.messages], options.systemMessage);
      
      // Start token counting
      const promptText = parts.map(part => 
        part.parts.map(p => ('text' in p) ? p.text : '').join(' ')
      ).join(' ');
      const promptTokens = this.estimateTokens(promptText);
      
      // Make the completion request
      const response = await model.generateContent({
        contents: [{ role: 'user', parts }],
        tools: options.functions ? [{
          functionDeclarations: options.functions.map(func => ({
            name: func.name,
            description: func.description || '',
            parameters: func.parameters
          }))
        }] : undefined,
        toolConfig: options.functionCall ? {
          toolChoice: {
            functionCalling: {
              functionName: options.functionCall
            }
          }
        } : undefined,
      });
      
      const result = response.response;
      const timeTaken = Date.now() - startTime;
      
      // Extract text content or function call
      let content = '';
      let functionCallResult: GeminiFunctionCallResult | undefined;
      
      if (result.functionCalling) {
        // Handle function call response
        const functionCall = result.functionCalling[0];
        functionCallResult = {
          name: functionCall.name,
          args: functionCall.args
        };
        content = JSON.stringify(functionCallResult);
      } else {
        // Handle regular text response
        content = result.text();
      }
      
      // Estimate completion tokens
      const completionTokens = this.estimateTokens(content);
      
      // Calculate cost
      const { cost } = this.calculateCost(
        options.model,
        promptTokens,
        completionTokens
      );

      // Return formatted response
      return {
        content: content,
        metadata: {
          model: options.model,
          totalTokens: promptTokens + completionTokens,
          promptTokens,
          completionTokens,
          timeTakenMs: timeTaken,
          cost,
          functionCall: functionCallResult,
        },
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
        },
      };
    } catch (error) {
      console.error('Gemini completion error:', error);
      throw new Error(`Gemini completion failed: ${(error as Error).message}`);
    }
  }

  /**
   * Stream a completion from Gemini
   * @param options Completion options
   * @param callback Callback for handling stream events
   * @returns Promise that resolves when streaming is complete
   */
  async streamCompletion(
    options: LLMCompletionOptions,
    callback: LLMStreamCallback
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Create model instance
      const model = this.client.getGenerativeModel({
        model: options.model,
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens,
          topP: options.topP,
        },
        // Configure tools/functions if provided
        tools: options.functions ? [{
          functionDeclarations: options.functions.map(func => ({
            name: func.name,
            description: func.description || '',
            parameters: func.parameters
          }))
        }] : undefined,
      });

      // Prepare messages
      const parts = this.convertMessages([...options.messages], options.systemMessage);
      
      // Start token counting
      const promptText = parts.map(part => 
        part.parts.map(p => ('text' in p) ? p.text : '').join(' ')
      ).join(' ');
      const promptTokens = this.estimateTokens(promptText);
      
      // Make the streaming request
      const streamingResponse = await model.generateContentStream({
        contents: [{ role: 'user', parts }],
        tools: options.functions ? [{
          functionDeclarations: options.functions.map(func => ({
            name: func.name,
            description: func.description || '',
            parameters: func.parameters
          }))
        }] : undefined,
        toolConfig: options.functionCall ? {
          toolChoice: {
            functionCalling: {
              functionName: options.functionCall
            }
          }
        } : undefined,
      });
      
      let fullContent = '';
      let functionCallResult: GeminiFunctionCallResult | undefined;
      
      // Process the stream chunks
      for await (const chunk of streamingResponse.stream) {
        const text = chunk.text();
        
        // Check for function calls
        if (chunk.functionCalling) {
          // Process function call chunks
          const functionCall = chunk.functionCalling[0];
          functionCallResult = {
            name: functionCall.name,
            args: functionCall.args
          };
          
          // Send function call event
          callback({
            type: LLMStreamEventType.FunctionCall,
            functionName: functionCall.name,
            content: JSON.stringify(functionCall.args),
          });
        } else if (text) {
          // Process regular text chunks
          fullContent += text;
          
          // Send content event
          callback({
            type: LLMStreamEventType.Content,
            content: text,
          });
        }
      }
      
      // Calculate completion tokens and cost
      const completionContent = functionCallResult 
        ? JSON.stringify(functionCallResult)
        : fullContent;
      const completionTokens = this.estimateTokens(completionContent);
      
      const { cost } = this.calculateCost(
        options.model,
        promptTokens,
        completionTokens
      );
      
      const timeTaken = Date.now() - startTime;
      
      // Send end event with metadata
      callback({
        type: LLMStreamEventType.End,
        metadata: {
          model: options.model,
          totalTokens: promptTokens + completionTokens,
          promptTokens,
          completionTokens,
          timeTakenMs: timeTaken,
          cost,
          functionCall: functionCallResult,
        },
      });
    } catch (error) {
      console.error('Gemini stream error:', error);
      
      // Send error event
      callback({
        type: LLMStreamEventType.Error,
        error: new Error(`Gemini streaming failed: ${(error as Error).message}`),
      });
    }
  }

  /**
   * Estimate tokens for a string
   * @param text Text to estimate tokens for
   * @returns Estimated token count
   * 
   * Note: This is a rough approximation as Gemini doesn't expose token counting
   */
  estimateTokens(text: string): number {
    // Rough approximation of tokens (approx 4 chars per token)
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate cost based on token usage
   * @param modelId Model ID
   * @param promptTokens Number of prompt tokens
   * @param completionTokens Number of completion tokens
   * @returns Object with cost and completion tokens
   */
  private calculateCost(
    modelId: string,
    promptTokens: number,
    completionTokens: number
  ): { cost: number; completionTokens: number } {
    const model = this.getModelById(modelId);
    
    if (!model) {
      return { cost: 0, completionTokens };
    }
    
    const promptCost = (promptTokens / 1000) * model.inputCostPer1000Tokens;
    const completionCost = (completionTokens / 1000) * model.outputCostPer1000Tokens;
    
    return {
      cost: promptCost + completionCost,
      completionTokens,
    };
  }

  /**
   * Get model by ID
   * @param modelId Model ID to find
   * @returns Model if found, undefined otherwise
   */
  private getModelById(modelId: string): LLMModel | undefined {
    return this.supportedModels.find((model) => model.id === modelId);
  }
}