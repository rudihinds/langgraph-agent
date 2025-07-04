/**
 * Generic Human-in-the-Loop (HITL) Node Utilities
 * 
 * Reusable node creators for common HITL patterns that can be used across different flows.
 * All messages are dynamically generated via LLM for natural conversation flow.
 * 
 * @fileoverview Generic utility functions that create LangGraph-compliant HITL nodes
 * @version 2.0
 */

import { BaseMessage, AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Command, interrupt } from "@langchain/langgraph";

// Types for configuration objects
interface HumanReviewNodeConfig<TState = any> {
  /** Name identifier for this node */
  nodeName: string;
  /** LLM instance for generating review prompts */
  llm: any;
  /** Type identifier for the interrupt payload */
  interruptType: string;
  /** System prompt for generating contextual review question */
  reviewPromptTemplate: string;
  /** Available options for user (optional) */
  options?: string[];
  /** Next node to route to */
  nextNode: string;
}

interface FeedbackRouterConfig<TState = any> {
  /** Name identifier for this node */
  nodeName: string;
  /** LLM instance for intent analysis */
  llm: any;
  /** System prompt for analyzing user feedback */
  intentPrompt: string;
  /** Mapping of detected intents to node names */
  routingMap: Record<string, string>;
  /** Default route if intent unclear */
  defaultRoute: string;
}

interface HandlerNodeConfig<TState = any> {
  /** Name identifier for this node */
  nodeName: string;
  /** LLM instance for generating responses */
  llm: any;
  /** System prompt for generating handler response */
  responsePrompt: string;
  /** Next node to route to */
  nextNode: string;
  /** State updates to apply (optional) */
  stateUpdates?: Record<string, any>;
}

/**
 * Creates a human review node that interrupts with contextually generated prompts
 * 
 * @param config - Configuration object for the human review node
 * @returns LangGraph-compatible node function
 * 
 * @example
 * ```javascript
 * const humanReview = createHumanReviewNode({
 *   nodeName: "strategyReview",
 *   llm: model,
 *   interruptType: "strategy_approval",
 *   reviewPromptTemplate: "Generate a natural question asking user to review the strategy",
 *   options: ["approve", "refine", "reject"],
 *   nextNode: "feedbackRouter"
 * });
 * ```
 */
export function createHumanReviewNode<TState extends Record<string, any>>(
  config: HumanReviewNodeConfig<TState>
) {
  return function(state: TState): Command {
    console.log(`[${config.nodeName}] Preparing human review`);

    // Create JSON-serializable payload for frontend display
    const interruptPayload = {
      type: config.interruptType,
      question: "Please review the comprehensive RFP analysis results. Do you approve these findings and strategic recommendations?",
      options: config.options,
      synthesisData: (state as any).synthesisAnalysis, // The synthesis results for display
      timestamp: new Date().toISOString(),
      nodeName: config.nodeName
    };

    // Pass JSON payload to interrupt() per LangGraph.js best practices
    const userInput = interrupt(interruptPayload);
    
    return new Command({
      goto: config.nextNode,
      update: {
        userFeedback: userInput
      }
    });
  };
}

/**
 * Creates a feedback router node that interprets user responses and routes accordingly
 * 
 * @param config - Configuration object for the feedback router
 * @returns LangGraph-compatible node function
 * 
 * @example
 * ```javascript
 * const feedbackRouter = createFeedbackRouterNode({
 *   nodeName: "feedbackRouter",
 *   llm: model,
 *   intentPrompt: "Analyze user feedback and determine if they want to approve, refine, or reject",
 *   routingMap: {
 *     "approve": "approvalHandler",
 *     "refine": "analysisNode", 
 *     "reject": "rejectionHandler"
 *   },
 *   defaultRoute: "analysisNode"
 * });
 * ```
 */
export function createFeedbackRouterNode<TState extends Record<string, any>>(
  config: FeedbackRouterConfig<TState>
) {
  return async function(state: TState): Promise<Command> {
    console.log(`[${config.nodeName}] Routing user feedback`);

    const userFeedback = (state as any).userFeedback || "No feedback provided";
    
    // Analyze user intent
    const intentMessages = [
      new SystemMessage(config.intentPrompt),
      new HumanMessage(`User feedback: "${userFeedback}"`),
      new HumanMessage(`Available routes: ${Object.keys(config.routingMap).join(", ")}`)
    ];

    const intentResponse = await config.llm.invoke(intentMessages);
    const detectedIntent = extractIntent(intentResponse.content, Object.keys(config.routingMap));
    
    // Generate acknowledgment response
    const ackMessages = [
      new SystemMessage("Generate a brief, natural acknowledgment of the user's feedback"),
      new HumanMessage(`User said: "${userFeedback}"`),
      new HumanMessage(`Detected intent: ${detectedIntent}`)
    ];

    const acknowledgment = await config.llm.invoke(ackMessages);
    
    const aiMsg = new AIMessage({
      content: acknowledgment.content,
      name: config.nodeName
    });

    const targetNode = config.routingMap[detectedIntent] || config.defaultRoute;

    return new Command({
      goto: targetNode,
      update: { acknowledgment: acknowledgment.content }
    });
  };
}

/**
 * Creates an approval handler node that confirms user approval and routes to next step
 * 
 * @param config - Configuration object for the approval handler
 * @returns LangGraph-compatible node function
 * 
 * @example
 * ```javascript
 * const approvalHandler = createApprovalNode({
 *   nodeName: "approvalHandler",
 *   llm: model,
 *   responsePrompt: "Generate a confirmation message that the analysis is approved",
 *   nextNode: "researchPlanning",
 *   stateUpdates: { status: "approved" }
 * });
 * ```
 */
export function createApprovalNode<TState extends Record<string, any>>(
  config: HandlerNodeConfig<TState>
) {
  return async function(state: TState): Promise<Command> {
    console.log(`[${config.nodeName}] Handling approval`);

    const responseMessages = [
      new SystemMessage(config.responsePrompt),
      new HumanMessage("User has approved the previous output")
    ];

    const response = await config.llm.invoke(responseMessages);

    return new Command({
      goto: config.nextNode,
      update: { 
        approvalResponse: response.content,
        ...config.stateUpdates
      }
    });
  };
}

/**
 * Creates a rejection handler node that acknowledges rejection and routes appropriately
 * 
 * @param config - Configuration object for the rejection handler
 * @returns LangGraph-compatible node function
 * 
 * @example
 * ```javascript
 * const rejectionHandler = createRejectionNode({
 *   nodeName: "rejectionHandler", 
 *   llm: model,
 *   responsePrompt: "Generate a message acknowledging rejection and offering to start fresh",
 *   nextNode: "analysisNode",
 *   stateUpdates: { iteration: 0 }
 * });
 * ```
 */
export function createRejectionNode<TState extends Record<string, any>>(
  config: HandlerNodeConfig<TState>
) {
  return async function(state: TState): Promise<Command> {
    console.log(`[${config.nodeName}] Handling rejection`);

    const responseMessages = [
      new SystemMessage(config.responsePrompt),
      new HumanMessage("User has rejected the previous output")
    ];

    const response = await config.llm.invoke(responseMessages);

    return new Command({
      goto: config.nextNode,
      update: { 
        rejectionResponse: response.content,
        ...config.stateUpdates
      }
    });
  };
}

// Helper Functions

/**
 * Extracts intent from LLM response by matching against valid options
 */
function extractIntent(response: string, validIntents: string[]): string {
  const lowerResponse = response.toLowerCase();
  return validIntents.find(intent => 
    lowerResponse.includes(intent.toLowerCase())
  ) || validIntents[0]; // Default to first valid intent
}

/**
 * Gets a summary of recent conversation for context
 */
function getConversationSummary(messages: BaseMessage[]): string {
  const recentMessages = messages.slice(-3);
  return recentMessages.map(msg => 
    `${msg.constructor.name}: ${msg.content.slice(0, 100)}...`
  ).join(" | ");
}

/**
 * Gets the last AI message from conversation
 */
export function getLastAIMessage(messages: BaseMessage[]): AIMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i] instanceof AIMessage) {
      return messages[i] as AIMessage;
    }
  }
  return null;
}

/**
 * Counts iterations by counting messages from a specific node
 */
export function getIterationCount(messages: BaseMessage[], nodeName: string): number {
  return messages.filter(msg => 
    'name' in msg && msg.name === nodeName
  ).length;
}