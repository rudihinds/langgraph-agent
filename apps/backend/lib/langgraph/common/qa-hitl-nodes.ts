/**
 * Question-Answering HITL Node Utilities
 * 
 * Reusable utilities for creating HITL nodes that can answer questions
 * about any part of the application state before returning to the review flow.
 */

import { BaseMessage, AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";

// Configuration for question-answering nodes
interface QuestionAnsweringNodeConfig<TState = any> {
  /** Name identifier for this node */
  nodeName: string;
  /** LLM instance for generating answers */
  llm: any;
  /** System prompt template for answering questions */
  systemPromptTemplate: string;
  /** Function to extract relevant context from state */
  contextExtractor: (state: TState) => {
    primaryContext: any;
    additionalContext?: Record<string, any>;
    metadata?: Record<string, any>;
  };
  /** Node to return to after answering (usually the review node) */
  returnNode: string;
  /** Maximum context length to prevent token overflow */
  maxContextLength?: number;
}

/**
 * Creates a question-answering node that can respond to user questions
 * about the current state and return to the review flow.
 * 
 * @param config - Configuration for the QA node
 * @returns LangGraph-compatible node function
 * 
 * @example
 * ```typescript
 * const qaNode = createQuestionAnsweringNode({
 *   nodeName: "rfpQuestionAnswering",
 *   llm: model,
 *   systemPromptTemplate: "You are an expert analyst helping users understand RFP analysis results...",
 *   contextExtractor: (state) => ({
 *     primaryContext: state.synthesisAnalysis,
 *     additionalContext: {
 *       linguistic: state.linguisticAnalysis,
 *       requirements: state.requirementsAnalysis
 *     }
 *   }),
 *   returnNode: "humanReview"
 * });
 * ```
 */
export function createQuestionAnsweringNode<TState extends Record<string, any>>(
  config: QuestionAnsweringNodeConfig<TState>
) {
  return async function(state: TState): Promise<Command> {
    console.log(`[${config.nodeName}] Processing user question`);

    // Extract the user's question from parsed feedback
    const parsedFeedback = (state as any).parsedFeedback;
    const userQuestion = parsedFeedback?.feedback || (state as any).userFeedback || "No question provided";

    // Extract context using the provided extractor
    const contextData = config.contextExtractor(state);
    
    // Prepare context for the LLM
    let contextString = "";
    
    // Add primary context
    if (contextData.primaryContext) {
      contextString += `Primary Context:\n${JSON.stringify(contextData.primaryContext, null, 2)}\n\n`;
    }
    
    // Add additional context
    if (contextData.additionalContext) {
      for (const [key, value] of Object.entries(contextData.additionalContext)) {
        if (value) {
          const contextPart = JSON.stringify(value, null, 2);
          // Respect max context length
          if (config.maxContextLength && contextString.length + contextPart.length > config.maxContextLength) {
            console.log(`[${config.nodeName}] Skipping ${key} context due to length constraints`);
            continue;
          }
          contextString += `${key} Context:\n${contextPart}\n\n`;
        }
      }
    }

    // Create messages for the LLM
    const messages = [
      new SystemMessage(config.systemPromptTemplate),
      new HumanMessage(`Context:\n${contextString}`),
      new HumanMessage(`User Question: "${userQuestion}"`),
      new HumanMessage("Please provide a clear, helpful answer based on the provided context. If the question cannot be answered from the context, explain what information would be needed.")
    ];

    try {
      // Generate answer
      const response = await config.llm.invoke(messages);
      
      const aiMsg = new AIMessage({
        content: response.content,
        name: config.nodeName
      });

      console.log(`[${config.nodeName}] Question answered, returning to ${config.returnNode}`);

      // Return to the review node for continued interaction
      return new Command({
        goto: config.returnNode,
        update: { 
          messages: [aiMsg],
          lastQuestionAnswered: userQuestion,
          currentStatus: "Question answered - please continue with your review"
        }
      });

    } catch (error) {
      console.error(`[${config.nodeName}] Error answering question:`, error);
      
      const errorMsg = new AIMessage({
        content: "I apologize, but I encountered an error while trying to answer your question. Please try rephrasing or continue with your review decision.",
        name: config.nodeName
      });

      return new Command({
        goto: config.returnNode,
        update: { 
          messages: [errorMsg],
          currentStatus: "Error answering question - please continue with review"
        }
      });
    }
  };
}

/**
 * Creates a complete QA-enabled HITL flow
 * 
 * This is a higher-level utility that creates both the review node
 * and the QA node with proper connections.
 */
export function createQAEnabledHITLFlow<TState extends Record<string, any>>(config: {
  reviewNodeName: string;
  qaNodeName: string;
  routerNodeName: string;
  llm: any;
  reviewQuestion: string;
  reviewOptions: string[];
  qaSystemPrompt: string;
  contextExtractor: (state: TState) => any;
  routingMap: Record<string, string>;
  defaultRoute: string;
}) {
  // Create the QA node
  const qaNode = createQuestionAnsweringNode<TState>({
    nodeName: config.qaNodeName,
    llm: config.llm,
    systemPromptTemplate: config.qaSystemPrompt,
    contextExtractor: config.contextExtractor,
    returnNode: config.reviewNodeName
  });

  // Return all nodes needed for the flow
  return {
    qaNode,
    // Review and router nodes would be created by the enhanced-hitl-nodes utilities
  };
}

/**
 * Helper function to format context for better readability in answers
 */
export function formatContextForQA(context: any, options?: {
  includeFields?: string[];
  excludeFields?: string[];
  maxDepth?: number;
}): string {
  if (!context) return "No context available";

  try {
    // If it's already a string, return it
    if (typeof context === 'string') return context;

    // For objects, format them nicely
    if (typeof context === 'object') {
      let formatted = "";
      
      for (const [key, value] of Object.entries(context)) {
        // Skip excluded fields
        if (options?.excludeFields?.includes(key)) continue;
        
        // If includeFields is specified, only include those
        if (options?.includeFields && !options.includeFields.includes(key)) continue;

        // Format the value
        if (typeof value === 'string') {
          formatted += `**${key}**: ${value}\n`;
        } else if (Array.isArray(value)) {
          formatted += `**${key}**: ${value.length} items\n`;
          value.slice(0, 3).forEach((item, idx) => {
            formatted += `  ${idx + 1}. ${typeof item === 'string' ? item : JSON.stringify(item)}\n`;
          });
          if (value.length > 3) formatted += `  ... and ${value.length - 3} more\n`;
        } else if (typeof value === 'object' && value !== null) {
          formatted += `**${key}**: ${JSON.stringify(value, null, 2).slice(0, 200)}...\n`;
        } else {
          formatted += `**${key}**: ${value}\n`;
        }
      }

      return formatted;
    }

    return JSON.stringify(context, null, 2);
  } catch (error) {
    return "Error formatting context";
  }
}