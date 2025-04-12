/**
 * Example usage of the ContextWindowManager with enhanced error handling
 * 
 * This example demonstrates:
 * 1. How to initialize the manager with custom options
 * 2. How to use message preparation with error handling
 * 3. How to monitor and respond to error events
 * 4. How to implement graceful degradation
 */

import { ContextWindowManager, Message } from '../context-window-manager.js';

// Example function showing how to use the ContextWindowManager with error handling
async function conversationWithErrorHandling() {
  // Get singleton instance with custom options
  const contextManager = ContextWindowManager.getInstance({
    summarizationModel: "claude-3-7-sonnet", // Model to use for summarization
    reservedTokens: 1500,                  // Reserve more tokens for response
    maxTokensBeforeSummarization: 8000,    // Higher threshold before summarization
    summarizationRatio: 0.6,               // Summarize 60% of oldest messages
    debug: true                           // Enable debug logging
  });

  // Register error event handlers
  contextManager.on('error', (errorInfo) => {
    const { category, message, error } = errorInfo;
    
    console.error(`ContextWindowManager error [${category}]: ${message}`);
    
    // Handle different error categories
    switch(category) {
      case 'LLM_MODEL_ERROR':
        console.log('Model error detected - falling back to default model');
        // Implementation: Switch to a more reliable model
        break;
        
      case 'LLM_SUMMARIZATION_ERROR':
        console.log('Summarization failed - proceeding with truncation instead');
        // The manager will automatically fall back to truncation
        break;
        
      case 'TOKEN_CALCULATION_ERROR':
        console.log('Token calculation error - using fallback estimation');
        // The manager will use word-based estimation
        break;
        
      case 'CONTEXT_WINDOW_ERROR':
        console.log('Context window error - using minimal message set');
        // The manager will return only system messages and the most recent message
        break;
        
      default:
        console.log('Unknown error - using default fallback');
    }
  });

  // Example conversation history
  const messages: Message[] = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello, how are you?' },
    { role: 'assistant', content: "I'm doing well! How can I help you today?" },
    { role: 'user', content: 'Tell me about artificial intelligence.' },
    { role: 'assistant', content: 'Artificial intelligence (AI) refers to...' } // Long content
  ];

  try {
    // This will handle errors internally and apply fallback strategies
    const preparedMessages = await contextManager.prepareMessages(messages, 'claude-3-7-sonnet');
    
    console.log(`Prepared ${preparedMessages.messages.length} messages`);
    console.log(`Total tokens: ${preparedMessages.totalTokens}`);
    console.log(`Was summarized: ${preparedMessages.wasSummarized}`);
    
    // Use the prepared messages for your LLM call
    return preparedMessages.messages;
  } catch (error) {
    // This should rarely happen as most errors are handled internally
    console.error('Unhandled error in context window management:', error);
    
    // Ultimate fallback - return just the system message and last user message
    const systemMessages = messages.filter(m => m.role === 'system');
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    
    return [...systemMessages, lastUserMessage].filter(Boolean);
  }
}

// Example usage in LangGraph nodes
export async function exampleLangGraphNode(state: any) {
  const { messages, modelId } = state;
  
  // Get the context manager
  const contextManager = ContextWindowManager.getInstance();
  
  try {
    // Prepare messages with built-in error handling and fallbacks
    const prepared = await contextManager.prepareMessages(messages, modelId);
    
    // Update state with prepared messages
    return {
      ...state,
      messages: prepared.messages,
      wasSummarized: prepared.wasSummarized
    };
  } catch (error) {
    // This code will rarely execute due to internal error handling
    console.error('Failed to prepare messages:', error);
    
    // Return state with error information
    return {
      ...state,
      error: {
        source: 'context_window_manager',
        message: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

// Example of listening for specific events
function setupMonitoring() {
  const contextManager = ContextWindowManager.getInstance();
  
  // Track summarization frequency
  let summarizationCount = 0;
  contextManager.on('error', (errorInfo) => {
    if (errorInfo.category === 'LLM_SUMMARIZATION_ERROR') {
      console.warn('Summarization failed:', errorInfo.message);
      // Log to monitoring system
    }
  });
  
  // You could also extend the ContextWindowManager to emit 'summarized' events
  // and track successful summarizations
}