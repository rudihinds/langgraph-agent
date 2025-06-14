/**
 * RFP Analysis Flow - Specific Node Utilities
 * 
 * Node creators specific to the RFP analysis workflow.
 * These utilities handle RFP document analysis and processing tasks.
 * 
 * @fileoverview RFP-specific node utility functions
 * @version 1.0
 */

import { BaseMessage, AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Command, END } from "@langchain/langgraph";

// Types for RFP-specific configuration
interface RFPAnalysisNodeConfig<TState = any> {
  /** Name identifier for this node (used in message.name) */
  nodeName: string;
  /** LLM instance to use for analysis */
  llm: any;
  /** Function that extracts RFP data from state */
  dataExtractor: (state: TState) => string | null;
  /** System prompt template for RFP analysis task */
  analysisPrompt: string;
  /** System prompt template for generating user-facing response */
  responsePrompt: string;
  /** Next node to route to after analysis */
  nextNode: string;
  /** State updates to apply (optional) */
  stateUpdates?: Record<string, any>;
}

/**
 * Creates an RFP analysis node that processes documents and generates strategic insights
 * 
 * @param config - Configuration object for the RFP analysis node
 * @returns LangGraph-compatible node function
 * 
 * @example
 * ```javascript
 * const rfpAnalyzer = createRFPAnalysisNode({
 *   nodeName: "rfpAnalyzer",
 *   llm: model,
 *   dataExtractor: (state) => state.rfpDocument?.text,
 *   analysisPrompt: "Analyze this RFP for strategic insights...",
 *   responsePrompt: "Generate a professional analysis response...",
 *   nextNode: "humanReview",
 *   stateUpdates: { isAnalyzingRfp: false }
 * });
 * ```
 */
export function createRFPAnalysisNode<TState extends { messages: BaseMessage[] }>(
  config: RFPAnalysisNodeConfig<TState>
) {
  return async function(state: TState): Promise<Command> {
    console.log(`[${config.nodeName}] Starting RFP analysis`);

    // Extract RFP data
    const rfpData = config.dataExtractor(state);
    if (!rfpData) {
      const errorMsg = new AIMessage({
        content: "No RFP document found. Please upload an RFP document to analyze.",
        name: config.nodeName
      });
      
      return new Command({
        goto: END,
        update: { 
          messages: [errorMsg],
          ...config.stateUpdates
        }
      });
    }

    // Check if this is a refinement based on previous feedback
    const isRefinement = state.messages.some(msg => 
      msg.name === config.nodeName && msg instanceof AIMessage
    );

    // Perform analysis with context-aware prompting
    const analysisMessages = [
      new SystemMessage(config.analysisPrompt),
      ...(isRefinement ? [
        new HumanMessage("This is a refinement based on user feedback. Consider the conversation history."),
        new HumanMessage(`Conversation context: ${getConversationSummary(state.messages)}`)
      ] : []),
      new HumanMessage(`RFP Document: ${rfpData}`)
    ];

    const analysisResult = await config.llm.invoke(analysisMessages);

    // Generate contextual user response
    const responseMessages = [
      new SystemMessage(config.responsePrompt),
      new HumanMessage(`Analysis result: ${analysisResult.content}`),
      new HumanMessage(`Conversation context: ${getConversationSummary(state.messages)}`)
    ];

    const userResponse = await config.llm.invoke(responseMessages);
    
    const aiMsg = new AIMessage({
      content: userResponse.content,
      name: config.nodeName
    });

    return new Command({
      goto: config.nextNode,
      update: { 
        messages: [aiMsg],
        ...config.stateUpdates
      }
    });
  };
}

// Helper Functions specific to RFP analysis

/**
 * Gets a summary of recent conversation for context
 */
function getConversationSummary(messages: BaseMessage[]): string {
  const recentMessages = messages.slice(-3);
  return recentMessages.map(msg => 
    `${msg.constructor.name}: ${msg.content.slice(0, 100)}...`
  ).join(" | ");
}