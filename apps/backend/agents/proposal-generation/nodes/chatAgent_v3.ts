/**
 * Chat Agent V3 - Pure LangGraph multi-agent implementation
 * Follows https://langchain-ai.github.io/langgraphjs/how-tos/multi-agent-multi-turn-convo/ exactly
 * 
 * Key changes:
 * - LLM dynamically chooses next agent via enum
 * - No static routing logic
 * - No separate tool interpreter 
 * - Follows documented multi-agent pattern exactly
 */

import { z } from "zod";
import { ChatAnthropic } from "@langchain/anthropic";
import { BaseMessage, AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import {
  Command,
  END
} from "@langchain/langgraph";
import { OverallProposalStateAnnotation } from "../../../state/modules/annotations.js";

// Initialize LLM
const model = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.3,
  maxTokens: 2000,
});

// Schema matching exact node names from graph.ts
const RoutingSchema = z.object({
  response: z.string().describe("Response to the user"),
  goto: z.enum(["documentLoader", "rfpAnalysisDispatcher", "end"]).describe("Next node to visit based on user request and current state"),
});

/**
 * Chat Agent Node - Pure multi-agent coordinator following documented pattern
 */
export async function chatAgent(
  state: typeof OverallProposalStateAnnotation.State
): Promise<Command> {
  console.log("[Chat Agent V3] Processing user input");

  const messages = state.messages;
  
  // Must have at least one message to process
  if (!messages || messages.length === 0) {
    return new Command({
      goto: END,
      update: {}
    });
  }

  const lastMessage = messages[messages.length - 1];
  
  // Only process human messages in this node
  if (!(lastMessage instanceof HumanMessage)) {
    return new Command({
      goto: END,
      update: {}
    });
  }

  // Check if we're in HITL review - if so, pass through without processing
  if (state.isInHitlReview) {
    console.log("[Chat Agent V3] Currently in HITL review, passing through to next node");
    console.log("[Chat Agent V3] State info - userFeedback:", state.userFeedback);
    console.log("[Chat Agent V3] State info - currentStatus:", state.currentStatus);
    console.log("[Chat Agent V3] State info - feedbackIntent:", state.feedbackIntent);
    
    // Pass through to the next node in the graph without updating state
    // The graph should continue to the appropriate HITL handling nodes
    // Return empty Command to continue graph execution
    return new Command({
      update: {}
    });
  }

  // ===== PROACTIVE STATE CHECKING =====
  // Check if there's an RFP document that needs automated processing
  const hasRfpId = state.metadata?.rfpId;
  const isDocumentLoaded = state.rfpDocument?.status === 'loaded' && state.rfpDocument?.text;
  const isDocumentNotStarted = state.rfpDocument?.status === 'not_started' || !state.rfpDocument?.status;
  
  // Check if RFP analysis is already in progress or completed
  const hasAnalysisResults = state.synthesisAnalysis || 
                            state.linguisticAnalysis || 
                            state.requirementsAnalysis || 
                            state.structureAnalysis || 
                            state.strategicAnalysis;
  const isAnalysisInProgress = state.isAnalyzingRfp === true;
  const needsAnalysis = isDocumentLoaded && !state.planningIntelligence && !hasAnalysisResults && !isAnalysisInProgress;
  
  // Auto-start document loading if RFP ID is present but document not loaded
  if (hasRfpId && isDocumentNotStarted) {
    console.log("[Chat Agent V3] Auto-routing to document loader for RFP:", hasRfpId);
    
    return new Command({
      goto: "documentLoader",
      update: { 
        currentStatus: "Loading RFP document...",
        isAnalyzingRfp: true
      }
    });
  }
  
  // Auto-start RFP analysis if document is loaded but not analyzed
  if (needsAnalysis) {
    console.log("[Chat Agent V3] Auto-routing to RFP multi-agent analysis for loaded document");
    
    return new Command({
      goto: "rfpAnalysisDispatcher",
      update: { 
        currentStatus: "Starting multi-agent RFP analysis...",
        isAnalyzingRfp: true
      }
    });
  }

  // Dynamic system prompt based on current state - following multi-agent pattern
  const systemPrompt = `You are coordinating a proposal generation system with automated RFP processing capabilities.

AUTOMATIC WORKFLOW:
- RFP documents are automatically loaded and analyzed when available
- The system proactively processes documents without user intervention
- You provide updates and coordination between specialized agents

Available agents to route to:
- documentLoader: Loads and processes RFP documents (typically auto-triggered)
- rfpAnalysisDispatcher: Orchestrates multi-agent RFP analysis with 4 specialized agents (typically auto-triggered)
- end: Complete the conversation (use for general questions, greetings, or when conversation is complete)

Current system state:
- Has RFP document: ${state.rfpDocument?.text ? 'Yes' : 'No'}
- Document loaded: ${state.rfpDocument?.status === 'loaded' ? 'Yes' : 'No'}
- RFP analysis completed: ${hasAnalysisResults ? 'Yes' : 'No'}
- Current phase: ${state.currentPhase || 'initial'}
- Auto-processing active: ${state.isAnalyzingRfp ? 'Yes' : 'No'}
- Planning intelligence available: ${state.planningIntelligence ? 'Yes' : 'No'}

Based on the user's message and current state, provide a helpful response and coordinate with specialized agents.
The system handles document processing automatically - focus on user communication and workflow coordination.`;

  const llmMessages = [
    new SystemMessage(systemPrompt),
    ...messages
  ];

  // LLM dynamically decides routing - no static logic
  const response = await model.withStructuredOutput(RoutingSchema, { name: "ChatRoutingResponse" }).invoke(llmMessages);
  
  const aiMsg = new AIMessage({
    content: response.response,
    name: "chatAgent"  // Matches the node name in the graph
  });

  return new Command({
    goto: response.goto === "end" ? END : response.goto,
    update: { 
      messages: [aiMsg]
    }
  });
}