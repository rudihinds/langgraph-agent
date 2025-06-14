/**
 * LangGraph Node Utility Functions
 * 
 * Reusable node creators for common HITL patterns.
 * All messages are dynamically generated via LLM for natural conversation flow.
 * 
 * @fileoverview Utility functions that create LangGraph-compliant nodes
 * @author Generated for bid writer application
 * @version 2.0
 */

import { BaseMessage, AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Command, interrupt, END } from "@langchain/langgraph";

// Types for configuration objects
interface AnalysisNodeConfig<TState = any> {
  /** Name identifier for this node (used in message.name) */
  nodeName: string;
  /** LLM instance to use for analysis */
  llm: any;
  /** Function that extracts input data from state */
  dataExtractor: (state: TState) => string | null;
  /** System prompt template for analysis task */
  analysisPrompt: string;
  /** System prompt template for generating user-facing response */
  responsePrompt: string;
  /** Next node to route to after analysis */
  nextNode: string;
  /** State updates to apply (optional) */
  stateUpdates?: Record<string, any>;
}

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
 * Creates an analysis/processing node that performs work and generates user-facing output
 * 
 * @param config - Configuration object for the analysis node
 * @returns LangGraph-compatible node function
 * 
 * @example
 * ```javascript
 * const rfpAnalyzer = createAnalysisNode({
 *   nodeName: "rfpAnalyzer",
 *   llm: model,
 *   dataExtractor: (state) => state.rfpDocument?.text,
 *   analysisPrompt: "Analyze this RFP for strategic insights...",
 *   responsePrompt: "Generate a professional analysis response...",
 *   nextNode: "humanReview",
 *   stateUpdates: { isAnalyzing: false }
 * });
 * ```
 */
export function createAnalysisNode<TState extends { messages: BaseMessage[] }>(
  config: AnalysisNodeConfig<TState>
) {
  return async function(state: TState): Promise<Command> {
    console.log(`[${config.nodeName}] Starting analysis`);

    // Extract input data
    const inputData = config.dataExtractor(state);
    if (!inputData) {
      return new Command({
        goto: END,
        update: config.stateUpdates || {}
      });
    }

    // Perform analysis
    const analysisMessages = [
      new SystemMessage(config.analysisPrompt),
      new HumanMessage(`Input data: ${inputData}`)
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
export function createHumanReviewNode<TState extends { messages: BaseMessage[] }>(
  config: HumanReviewNodeConfig<TState>
) {
  return function(state: TState): Command {
    console.log(`[${config.nodeName}] Preparing human review`);

    // For MVP, use simpler interrupt without complex payload generation
    const userInput = interrupt("Ready for your feedback on the analysis.");
    
    return new Command({
      goto: config.nextNode,
      update: {
        messages: [new HumanMessage(userInput)]
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
export function createFeedbackRouterNode<TState extends { messages: BaseMessage[] }>(
  config: FeedbackRouterConfig<TState>
) {
  return async function(state: TState): Promise<Command> {
    console.log(`[${config.nodeName}] Routing user feedback`);

    const lastMessage = state.messages[state.messages.length - 1];
    
    // Analyze user intent
    const intentMessages = [
      new SystemMessage(config.intentPrompt),
      new HumanMessage(`User feedback: "${lastMessage.content}"`),
      new HumanMessage(`Available routes: ${Object.keys(config.routingMap).join(", ")}`),
      new HumanMessage(`Conversation context: ${getConversationSummary(state.messages.slice(-5))}`)
    ];

    const intentResponse = await config.llm.invoke(intentMessages);
    const detectedIntent = extractIntent(intentResponse.content, Object.keys(config.routingMap));
    
    // Generate acknowledgment response
    const ackMessages = [
      new SystemMessage("Generate a brief, natural acknowledgment of the user's feedback"),
      new HumanMessage(`User said: "${lastMessage.content}"`),
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
      update: { messages: [aiMsg] }
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
export function createApprovalNode<TState extends { messages: BaseMessage[] }>(
  config: HandlerNodeConfig<TState>
) {
  return async function(state: TState): Promise<Command> {
    console.log(`[${config.nodeName}] Handling approval`);

    const responseMessages = [
      new SystemMessage(config.responsePrompt),
      new HumanMessage(`Conversation context: ${getConversationSummary(state.messages)}`),
      new HumanMessage("User has approved the previous output")
    ];

    const response = await config.llm.invoke(responseMessages);
    
    const aiMsg = new AIMessage({
      content: response.content,
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
export function createRejectionNode<TState extends { messages: BaseMessage[] }>(
  config: HandlerNodeConfig<TState>
) {
  return async function(state: TState): Promise<Command> {
    console.log(`[${config.nodeName}] Handling rejection`);

    const responseMessages = [
      new SystemMessage(config.responsePrompt),
      new HumanMessage(`Conversation context: ${getConversationSummary(state.messages)}`),
      new HumanMessage("User has rejected the previous output")
    ];

    const response = await config.llm.invoke(responseMessages);
    
    const aiMsg = new AIMessage({
      content: response.content,
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
function getLastAIMessage(messages: BaseMessage[]): AIMessage | null {
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
function getIterationCount(messages: BaseMessage[], nodeName: string): number {
  return messages.filter(msg => 
    'name' in msg && msg.name === nodeName
  ).length;
}