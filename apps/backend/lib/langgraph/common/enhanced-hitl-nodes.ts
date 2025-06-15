/**
 * Enhanced Human-in-the-Loop (HITL) Node Utilities
 * 
 * Enhanced HITL nodes that use natural language parsing for user responses.
 * These replace the basic HITL nodes with more sophisticated response handling.
 */

import { BaseMessage, AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Command, interrupt } from "@langchain/langgraph";
import { 
  parseRFPSynthesisResponse, 
  parseApprovalResponse, 
  parseGenericInterruptResponse,
  extractSimpleIntent,
  RFPSynthesisResponse,
  ApprovalResponse 
} from "./interrupt-response-parser.js";

// Enhanced configuration types
interface EnhancedHumanReviewNodeConfig<TState = any> {
  /** Name identifier for this node */
  nodeName: string;
  /** LLM instance for generating review prompts */
  llm: any;
  /** Type identifier for the interrupt payload */
  interruptType: string;
  /** Question to display to user */
  question: string;
  /** Available options for user */
  options: string[];
  /** Next node to route to */
  nextNode: string;
  /** Optional context data to include in interrupt */
  contextExtractor?: (state: TState) => any;
}

interface EnhancedFeedbackRouterConfig<TState = any> {
  /** Name identifier for this node */
  nodeName: string;
  /** Type of parsing to use */
  parserType: "rfp_synthesis" | "approval" | "generic";
  /** For generic parser: valid actions */
  validActions?: string[];
  /** Mapping of parsed actions to node names */
  routingMap: Record<string, string>;
  /** Default route if parsing fails */
  defaultRoute: string;
  /** Optional context extractor for parsing */
  contextExtractor?: (state: TState) => string;
}

/**
 * Enhanced human review node that creates structured interrupt payloads
 */
export function createEnhancedHumanReviewNode<TState extends Record<string, any>>(
  config: EnhancedHumanReviewNodeConfig<TState>
) {
  return function(state: TState): Command {
    console.log(`[${config.nodeName}] Creating enhanced human review interrupt`);

    // Extract context data if provided
    const contextData = config.contextExtractor ? config.contextExtractor(state) : undefined;

    // Create structured interrupt payload
    const interruptPayload = {
      type: config.interruptType,
      question: config.question,
      options: config.options,
      timestamp: new Date().toISOString(),
      nodeName: config.nodeName,
      ...(contextData && { contextData })
    };

    console.log(`[${config.nodeName}] Interrupting with payload:`, { 
      type: interruptPayload.type, 
      question: interruptPayload.question,
      options: interruptPayload.options 
    });

    // Pass JSON payload to interrupt() per LangGraph.js best practices
    const userInput = interrupt(interruptPayload);
    
    return new Command({
      goto: config.nextNode,
      update: {
        userFeedback: userInput,
        lastInterruptType: config.interruptType
      }
    });
  };
}

/**
 * Enhanced feedback router that uses natural language parsing
 */
export function createEnhancedFeedbackRouterNode<TState extends Record<string, any>>(
  config: EnhancedFeedbackRouterConfig<TState>
) {
  return async function(state: TState): Promise<Command> {
    console.log(`[${config.nodeName}] Parsing natural language feedback with ${config.parserType} parser`);

    const userFeedback = (state as any).userFeedback || "No feedback provided";
    const context = config.contextExtractor ? config.contextExtractor(state) : undefined;
    
    let parsedResponse: any;
    let detectedAction: string;
    let acknowledgmentText: string;

    try {
      // Use appropriate parser based on configuration
      switch (config.parserType) {
        case "rfp_synthesis":
          parsedResponse = await parseRFPSynthesisResponse(userFeedback, context) as RFPSynthesisResponse;
          detectedAction = parsedResponse.action;
          acknowledgmentText = generateRFPSynthesisAcknowledgment(parsedResponse);
          break;

        case "approval":
          parsedResponse = await parseApprovalResponse(userFeedback, context) as ApprovalResponse;
          detectedAction = parsedResponse.action;
          acknowledgmentText = generateApprovalAcknowledgment(parsedResponse);
          break;

        case "generic":
          if (!config.validActions) {
            throw new Error("validActions required for generic parser");
          }
          // For generic, we'll use simple intent extraction as fallback
          detectedAction = extractSimpleIntent(userFeedback, config.validActions);
          parsedResponse = { action: detectedAction, feedback: userFeedback };
          acknowledgmentText = `Got it! I understand you want to ${detectedAction}.`;
          break;

        default:
          throw new Error(`Unknown parser type: ${config.parserType}`);
      }

      console.log(`[${config.nodeName}] Parsed action: ${detectedAction} (confidence: ${parsedResponse.confidence || 'N/A'})`);

    } catch (error) {
      console.error(`[${config.nodeName}] Parsing failed:`, error);
      
      // Fallback to simple intent extraction
      const fallbackActions = Object.keys(config.routingMap);
      detectedAction = extractSimpleIntent(userFeedback, fallbackActions);
      parsedResponse = { action: detectedAction, feedback: userFeedback, confidence: 0.3 };
      acknowledgmentText = `I'll interpret that as "${detectedAction}". Let me proceed with your request.`;
    }

    // Create acknowledgment message
    const aiMsg = new AIMessage({
      content: acknowledgmentText,
      name: config.nodeName
    });

    // Route to appropriate node
    const targetNode = config.routingMap[detectedAction] || config.defaultRoute;

    return new Command({
      goto: targetNode,
      update: { 
        parsedFeedback: parsedResponse,
        acknowledgment: acknowledgmentText,
        messages: [aiMsg]
      }
    });
  };
}

/**
 * Generate natural acknowledgment for RFP synthesis responses
 */
function generateRFPSynthesisAcknowledgment(response: RFPSynthesisResponse): string {
  const baseMessages = {
    approve: "Perfect! I'm glad the RFP analysis meets your expectations.",
    modify: "I understand you'd like some adjustments to the analysis.",
    reject: "No problem! I'll start fresh with a new approach to the RFP analysis."
  };

  let message = baseMessages[response.action];

  if (response.feedback && response.action !== "approve") {
    message += ` I'll focus on: ${response.feedback}`;
  }

  if (response.specific_requests && response.specific_requests.length > 0) {
    message += ` Specifically addressing: ${response.specific_requests.slice(0, 2).join(" and ")}.`;
  }

  return message;
}

/**
 * Generate natural acknowledgment for approval responses
 */
function generateApprovalAcknowledgment(response: ApprovalResponse): string {
  const baseMessages = {
    approve: "Excellent! I'll proceed with the approved content.",
    reject: "Understood. I'll stop this approach and reconsider.",
    request_changes: "Got it! I'll make the changes you've requested."
  };

  let message = baseMessages[response.action];

  if (response.feedback && response.action !== "approve") {
    message += ` Your feedback: ${response.feedback}`;
  }

  return message;
}

/**
 * Create a complete HITL flow for RFP synthesis review
 */
export function createRFPSynthesisReviewFlow<TState extends Record<string, any>>(
  config: {
    reviewNodeName: string;
    routerNodeName: string;
    approvalNodeName: string;
    rejectionNodeName: string;
    modificationNodeName: string;
    llm: any;
  }
) {
  // Human review node
  const humanReview = createEnhancedHumanReviewNode<TState>({
    nodeName: config.reviewNodeName,
    llm: config.llm,
    interruptType: "rfp_analysis_review",
    question: "Please review the comprehensive RFP analysis results. Do you approve these findings and strategic recommendations?",
    options: ["approve", "modify", "reject"],
    nextNode: config.routerNodeName,
    contextExtractor: (state: TState) => (state as any).synthesisAnalysis
  });

  // Enhanced feedback router
  const feedbackRouter = createEnhancedFeedbackRouterNode<TState>({
    nodeName: config.routerNodeName,
    parserType: "rfp_synthesis",
    routingMap: {
      "approve": config.approvalNodeName,
      "modify": config.modificationNodeName,
      "reject": config.rejectionNodeName
    },
    defaultRoute: config.modificationNodeName,
    contextExtractor: (state: TState) => {
      const synthesis = (state as any).synthesisAnalysis;
      return synthesis ? `Analysis summary: ${synthesis.executive_summary?.strategic_recommendation || 'Strategic analysis completed'}` : undefined;
    }
  });

  return {
    humanReview,
    feedbackRouter
  };
}

/**
 * Create a simple approval flow
 */
export function createApprovalFlow<TState extends Record<string, any>>(
  config: {
    reviewNodeName: string;
    routerNodeName: string;
    approvalNodeName: string;
    rejectionNodeName: string;
    changesNodeName: string;
    llm: any;
    question: string;
    contextExtractor?: (state: TState) => any;
  }
) {
  // Human review node
  const humanReview = createEnhancedHumanReviewNode<TState>({
    nodeName: config.reviewNodeName,
    llm: config.llm,
    interruptType: "approval_required",
    question: config.question,
    options: ["approve", "reject", "request_changes"],
    nextNode: config.routerNodeName,
    contextExtractor: config.contextExtractor
  });

  // Enhanced feedback router
  const feedbackRouter = createEnhancedFeedbackRouterNode<TState>({
    nodeName: config.routerNodeName,
    parserType: "approval",
    routingMap: {
      "approve": config.approvalNodeName,
      "reject": config.rejectionNodeName,
      "request_changes": config.changesNodeName
    },
    defaultRoute: config.changesNodeName
  });

  return {
    humanReview,
    feedbackRouter
  };
}