/**
 * Standard LangGraph streaming node implementation
 * 
 * This file provides node functions that can be used directly in LangGraph,
 * with built-in streaming support using the standard LangGraph/LangChain mechanisms.
 */

import { BaseMessage, AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatPromptTemplate, PromptTemplate } from "@langchain/core/prompts";
import { RunnableConfig } from "@langchain/core/runnables";
import { 
  createStreamingChatModel, 
  createStreamingLLMChain, 
  SupportedModel,
  convertMessages,
  StreamingConfig,
  DEFAULT_STREAMING_CONFIG
} from "./langgraph-streaming.js";

/**
 * Creates a streaming LLM node for a LangGraph application
 * 
 * @param systemPrompt The system prompt to use
 * @param modelName The name of the model to use
 * @param config Additional configuration options
 * @returns A function that can be used as a LangGraph node
 */
export function createStreamingNode<TState extends { messages: any[] }>(
  systemPrompt: string,
  modelName: SupportedModel = "gpt-4o",
  config: Partial<StreamingConfig> = {}
) {
  // Merge with default config
  const fullConfig: StreamingConfig = {
    ...DEFAULT_STREAMING_CONFIG,
    ...config
  };
  
  // Create the streaming model
  const model = createStreamingChatModel(
    modelName, 
    fullConfig.temperature
  );
  
  // Return a function that can be used as a LangGraph node
  return async (state: TState): Promise<{ messages: TState["messages"] }> => {
    // Get messages from state
    const messages = state.messages;
    
    // Convert messages to LangChain format if needed
    const langchainMessages = Array.isArray(messages[0]?.role) 
      ? convertMessages(messages) 
      : messages;
    
    // Add system message if not already present
    if (!langchainMessages.some(msg => msg instanceof SystemMessage)) {
      langchainMessages.unshift(new SystemMessage(systemPrompt));
    }
    
    // Invoke the model with streaming
    const response = await model.invoke(
      langchainMessages,
      { ...fullConfig }
    );
    
    // Return updated messages (actual state update happens in LangGraph)
    return {
      messages: [...messages, response]
    };
  };
}

/**
 * Creates a streaming LLM chain node for a LangGraph application
 * 
 * @param promptTemplate The prompt template to use
 * @param inputMapping Function to map state to prompt input values
 * @param modelName The name of the model to use
 * @param config Additional configuration options
 * @returns A function that can be used as a LangGraph node
 */
export function createStreamingChainNode<TState extends object>(
  promptTemplate: string | ChatPromptTemplate | PromptTemplate,
  inputMapping: (state: TState) => Record<string, any>,
  modelName: SupportedModel = "gpt-4o",
  config: Partial<StreamingConfig> = {}
) {
  // Merge with default config
  const fullConfig: StreamingConfig = {
    ...DEFAULT_STREAMING_CONFIG,
    ...config
  };
  
  // Create prompt template if string is provided
  const prompt = typeof promptTemplate === 'string'
    ? PromptTemplate.fromTemplate(promptTemplate)
    : promptTemplate;
  
  // Create the chain
  const chain = createStreamingLLMChain(
    prompt, 
    modelName, 
    fullConfig.temperature
  );
  
  // Return a function that can be used as a LangGraph node
  return async (state: TState) => {
    // Get input values from state
    const inputValues = inputMapping(state);
    
    // Invoke the chain with streaming
    const response = await chain.invoke(
      inputValues,
      { ...fullConfig }
    );
    
    // Return the response (to be handled by calling code or LangGraph)
    return response;
  };
}

/**
 * Creates a streaming tool node for a LangGraph application
 * 
 * @param tools Array of tools that can be called
 * @param systemPrompt The system prompt to use
 * @param modelName The name of the model to use
 * @param config Additional configuration options
 * @returns A function that can be used as a LangGraph node
 */
export function createStreamingToolNode<TState extends { messages: any[] }>(
  tools: any[],
  systemPrompt: string,
  modelName: SupportedModel = "gpt-4o",
  config: Partial<StreamingConfig> = {}
) {
  // Merge with default config
  const fullConfig: StreamingConfig = {
    ...DEFAULT_STREAMING_CONFIG,
    ...config
  };
  
  // Create the streaming model with tools
  const model = createStreamingChatModel(
    modelName, 
    fullConfig.temperature
  );
  
  // Configure the model to use the tools
  model.bindTools(tools);
  
  // Return a function that can be used as a LangGraph node
  return async (state: TState): Promise<{ messages: TState["messages"] }> => {
    // Get messages from state
    const messages = state.messages;
    
    // Convert messages to LangChain format if needed
    const langchainMessages = Array.isArray(messages[0]?.role) 
      ? convertMessages(messages) 
      : messages;
    
    // Add system message if not already present
    if (!langchainMessages.some(msg => msg instanceof SystemMessage)) {
      langchainMessages.unshift(new SystemMessage(systemPrompt));
    }
    
    // Invoke the model with streaming
    const response = await model.invoke(
      langchainMessages,
      { ...fullConfig }
    );
    
    // Return updated messages (actual state update happens in LangGraph)
    return {
      messages: [...messages, response]
    };
  };
}