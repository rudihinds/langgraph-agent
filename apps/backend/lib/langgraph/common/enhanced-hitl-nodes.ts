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
import { createQuestionAnsweringNode } from "./qa-hitl-nodes.js";

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
    
    // Create human message for the user's response
    const userMessage = new HumanMessage({
      content: typeof userInput === 'string' ? userInput : JSON.stringify(userInput),
      name: "user"
    });
    
    return new Command({
      goto: config.nextNode,
      update: {
        userFeedback: userInput,
        lastInterruptType: config.interruptType,
        messages: [userMessage] // Add user response to message history
      }
    });
  };
}

/**
 * Enhanced feedback router that uses natural language parsing
 */
export function createEnhancedFeedbackRouterNode<TState extends Record<string, any>>(
  config: EnhancedFeedbackRouterConfig<TState> & { llm?: any }
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
          acknowledgmentText = await generateContextualAcknowledgment(
            config.llm,
            userFeedback,
            detectedAction,
            "RFP analysis",
            parsedResponse
          );
          break;

        case "approval":
          parsedResponse = await parseApprovalResponse(userFeedback, context) as ApprovalResponse;
          detectedAction = parsedResponse.action;
          acknowledgmentText = await generateContextualAcknowledgment(
            config.llm,
            userFeedback,
            detectedAction,
            "content approval",
            parsedResponse
          );
          break;

        case "generic":
          if (!config.validActions) {
            throw new Error("validActions required for generic parser");
          }
          // For generic, we'll use simple intent extraction as fallback
          detectedAction = extractSimpleIntent(userFeedback, config.validActions);
          parsedResponse = { action: detectedAction, feedback: userFeedback };
          acknowledgmentText = await generateContextualAcknowledgment(
            config.llm,
            userFeedback,
            detectedAction,
            "request",
            parsedResponse
          );
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
      acknowledgmentText = config.llm 
        ? await generateContextualAcknowledgment(
            config.llm,
            userFeedback,
            detectedAction,
            "request",
            parsedResponse
          )
        : `I'll interpret that as "${detectedAction}". Let me proceed with your request.`;
    }

    // Create user message for the feedback
    const userMessage = new HumanMessage({
      content: typeof userFeedback === 'string' ? userFeedback : JSON.stringify(userFeedback),
      name: "user"
    });

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
        messages: [userMessage, aiMsg] // Preserve both user feedback and AI response
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
    reject: "No problem! I'll start fresh with a new approach to the RFP analysis.",
    ask_question: "Great question! Let me provide you with a detailed answer based on the analysis."
  };

  let message = baseMessages[response.action];

  if (response.feedback && response.action !== "approve" && response.action !== "ask_question") {
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
 * Generate contextual acknowledgment using LLM based on user's actual feedback
 */
async function generateContextualAcknowledgment(
  llm: any,
  userFeedback: string,
  detectedAction: string,
  contextType: string,
  parsedResponse: any
): Promise<string> {
  if (!llm) {
    // Fallback to basic acknowledgment if no LLM provided
    return `I understand you want to ${detectedAction}. Let me proceed with that.`;
  }

  try {
    const prompt = `Generate a brief, natural acknowledgment (1 sentence, max 20 words) for this user feedback about ${contextType}.

User said: "${userFeedback}"
Detected intent: ${detectedAction}
Additional context: ${parsedResponse.feedback || 'none'}

Create a conversational acknowledgment that shows you understood their specific request. Be natural and engaging, not robotic.

Examples:
- "Got it! Let me address those concerns about the risk assessment."
- "Perfect! I'll revise the competitive analysis section."
- "Great question about the budget breakdown - let me explain that."

Your acknowledgment:`;

    const response = await llm.invoke([{ type: "human", content: prompt }]);
    const acknowledgment = response.content.trim();
    
    // Ensure it's not too long and ends properly
    const maxLength = 120;
    return acknowledgment.length > maxLength 
      ? acknowledgment.substring(0, maxLength - 3) + "..."
      : acknowledgment;
      
  } catch (error) {
    console.warn(`[generateContextualAcknowledgment] LLM call failed:`, error);
    // Fallback to simple acknowledgment
    return `I understand you want to ${detectedAction}. Let me proceed with that.`;
  }
}

/**
 * Create a complete HITL flow for RFP synthesis review with Q&A support
 */
export function createRFPSynthesisReviewFlow<TState extends Record<string, any>>(
  config: {
    reviewNodeName: string;
    routerNodeName: string;
    approvalNodeName: string;
    rejectionNodeName: string;
    modificationNodeName: string;
    qaNodeName?: string;
    llm: any;
  }
) {
  // Default QA node name if not provided
  const qaNodeName = config.qaNodeName || "rfpQuestionAnswering";

  // Human review node
  const humanReview = createEnhancedHumanReviewNode<TState>({
    nodeName: config.reviewNodeName,
    llm: config.llm,
    interruptType: "rfp_analysis_review",
    question: "Please review the comprehensive RFP analysis results. Do you approve these findings and strategic recommendations? You can also ask questions about the analysis.",
    options: ["approve", "modify", "reject", "ask a question"],
    nextNode: config.routerNodeName,
    contextExtractor: (state: TState) => (state as any).synthesisAnalysis
  });

  // Enhanced feedback router with QA support
  const feedbackRouter = createEnhancedFeedbackRouterNode<TState>({
    nodeName: config.routerNodeName,
    parserType: "rfp_synthesis",
    llm: config.llm, // Pass LLM for contextual acknowledgments
    routingMap: {
      "approve": config.approvalNodeName,
      "modify": config.modificationNodeName,
      "reject": config.rejectionNodeName,
      "ask_question": qaNodeName
    },
    defaultRoute: config.modificationNodeName,
    contextExtractor: (state: TState) => {
      const synthesis = (state as any).synthesisAnalysis;
      return synthesis ? `Analysis summary: ${synthesis.executive_summary?.strategic_recommendation || 'Strategic analysis completed'}` : undefined;
    }
  });

  // Question answering node
  const qaNode = createQuestionAnsweringNode<TState>({
    nodeName: qaNodeName,
    llm: config.llm,
    systemPromptTemplate: `You are an expert RFP analyst helping users understand the comprehensive RFP analysis results.
    
You have access to:
- Complete synthesis analysis with risks, opportunities, and strategic recommendations
- Linguistic pattern analysis
- Requirements extraction analysis  
- Document structure analysis
- Strategic signals analysis

Answer questions clearly and concisely, referencing specific findings from the analysis.
If asked about something not in the analysis, explain what's available instead.`,
    contextExtractor: (state: TState) => ({
      primaryContext: (state as any).synthesisAnalysis,
      additionalContext: {
        linguistic: (state as any).linguisticAnalysis,
        requirements: (state as any).requirementsAnalysis,
        structure: (state as any).structureAnalysis,
        strategic: (state as any).strategicAnalysis,
        rfpDocument: {
          name: (state as any).documentMetadata?.name,
          complexity: (state as any).documentMetadata?.complexity,
          pageCount: (state as any).documentMetadata?.pageCount
        }
      }
    }),
    returnNode: config.reviewNodeName,
    maxContextLength: 50000 // Prevent token overflow
  });

  return {
    humanReview,
    feedbackRouter,
    qaNode
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
    llm: config.llm, // Pass LLM for contextual acknowledgments
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