/**
 * RFP Analysis HITL Review Nodes
 *
 * Simplified human-in-the-loop review nodes for RFP analysis using
 * native LangGraph.js patterns and existing state fields.
 */

import { Command } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import {
  createInterruptNode,
  createIntentDetector,
} from "@/lib/langgraph/common/simple-hitl.js";
import { ProcessingStatus } from "@/state/modules/types.js";

// Initialize LLM for HITL interactions
const model = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.3,
  maxTokens: 4000,
});

// Schema for modification planning
const ModificationPlanSchema = z.object({
  fieldsToModify: z.array(z.enum([
    'linguisticAnalysis',
    'requirementsAnalysis', 
    'structureAnalysis',
    'strategicAnalysis',
    'synthesisAnalysis'
  ])).describe("Which analysis fields need to be modified"),
  modifications: z.record(z.string(), z.any()).describe("Field name -> updated content mapping"),
  explanation: z.string().describe("User-friendly explanation of what changes are being made")
});

// Human review - just interrupt and collect feedback
export const rfpAnalysisHumanReview = createInterruptNode({
  question: "Please review the RFP analysis. You can approve, request modifications, reject, or ask questions.",
  qaNodeName: "rfpAnalysisQuestionAnswering",
  contextField: "synthesisAnalysis",
  fallbackQuestion: "Ready to proceed? You can approve, request modifications, reject, or ask another question about the RFP analysis."
});

// Router - detect intent and route
export const rfpAnalysisFeedbackRouter = createIntentDetector(model, {
  routeMap: {
    "approve": "rfpAnalysisApprovalHandler",
    "refine": "rfpAnalysisModificationHandler",
    "reject": "rfpAnalysisRejectionHandler",
    "ask_question": "rfpAnalysisQuestionAnswering"
  },
  qaNodeName: "rfpAnalysisQuestionAnswering",
  contextHint: "the RFP analysis"
});

// Approval handler - simple and clean
export async function rfpAnalysisApprovalHandler(state: any) {
  const message = await model.invoke([
    {
      role: "system",
      content:
        "Generate a brief confirmation that RFP analysis is approved and we're moving to intelligence gathering.",
    },
    {
      role: "human",
      content: state.userFeedback || "Approved",
    },
  ]);

  return new Command({
    goto: "intelligenceGatheringAgent",
    update: {
      messages: [message],
      currentStatus:
        "RFP analysis approved - proceeding to intelligence gathering",
      rfpProcessingStatus: ProcessingStatus.COMPLETE, // Use existing ProcessingStatus enum
      userFeedback: undefined, // Clear userFeedback after processing
      feedbackIntent: undefined, // Clear feedbackIntent as well
      isInHitlReview: false, // Clear HITL flag when exiting
    },
  });
}

// Smart modification handler - analyzes feedback and updates specific fields
export async function rfpAnalysisModificationHandler(state: any) {
  console.log("[RFP Modification] Processing modification request:", state.userFeedback);
  
  const llmWithSchema = model.withStructuredOutput(ModificationPlanSchema);
  
  // Create context with current analysis state
  const currentAnalysis = {
    linguisticAnalysis: state.linguisticAnalysis,
    requirementsAnalysis: state.requirementsAnalysis,
    structureAnalysis: state.structureAnalysis,
    strategicAnalysis: state.strategicAnalysis,
    synthesisAnalysis: state.synthesisAnalysis
  };
  
  try {
    // Get modification plan from LLM
    const plan = await llmWithSchema.invoke([{
      role: "system",
      content: `You are an RFP analysis modification expert. Based on the user's feedback, determine which analysis fields need updating and provide the modifications.

Current RFP Analysis State:
${JSON.stringify(currentAnalysis, null, 2)}

Instructions:
1. Identify which fields need modification based on the user's request
2. Generate updated content for those specific fields
3. Preserve the structure and format of the original analysis
4. Only modify what the user specifically asked to change
5. Provide a clear explanation of the changes being made`
    }, {
      role: "human",
      content: `User modification request: ${state.userFeedback}`
    }]);
    
    console.log("[RFP Modification] Modification plan:", {
      fieldsToModify: plan.fieldsToModify,
      explanation: plan.explanation
    });
    
    // Return command with targeted updates
    return new Command({
      goto: "rfpAnalysisSynthesis",
      update: {
        ...plan.modifications, // Spread the specific field updates
        messages: [new AIMessage({
          content: `✏️ Applying modifications: ${plan.explanation}`,
          name: "rfpAnalysisModificationHandler"
        })],
        currentStatus: "Applying your requested modifications",
        feedbackIntent: undefined, // Clear to avoid re-triggering modification logic
        userFeedback: undefined // Clear user feedback after processing
      }
    });
    
  } catch (error) {
    console.error("[RFP Modification] Error processing modifications:", error);
    
    // Fallback to simple message if structured output fails
    return new Command({
      goto: "rfpAnalysisHumanReview",
      update: {
        messages: [new AIMessage({
          content: "I encountered an error processing your modification request. Could you please rephrase it or try again?",
          name: "rfpAnalysisModificationHandler"
        })],
        currentStatus: "Error processing modifications",
        feedbackIntent: undefined,
        userFeedback: undefined
      }
    });
  }
}

// Rejection handler - clear analysis and restart
export function rfpAnalysisRejectionHandler() {
  return new Command({
    goto: "rfpAnalysisDispatcher",
    update: {
      // Clear analysis results using undefined (existing pattern)
      linguisticAnalysis: undefined,
      requirementsAnalysis: undefined,
      structureAnalysis: undefined,
      strategicAnalysis: undefined,
      synthesisAnalysis: undefined,
      currentStatus: "Starting fresh RFP analysis",
      userFeedback: undefined, // Clear userFeedback after processing
      feedbackIntent: undefined, // Clear feedbackIntent as well
      isInHitlReview: false, // Clear HITL flag when exiting
    },
  });
}

// Q&A handler - custom implementation for RFP analysis with full context
export async function rfpAnalysisQuestionAnswering(state: any) {
  console.log("[RFP Q&A] Starting question answering");
  console.log("[RFP Q&A] User question:", state.userFeedback);
  
  const messages = state.messages || [];

  // Build conversation with existing history - SYSTEM MESSAGE MUST BE FIRST
  const conversationMessages = [
    {
      role: "system",
      content: `You are an RFP analysis expert. Answer the user's question based on the comprehensive RFP analysis below. After answering, remind them they can approve, modify, reject, or ask another question about the analysis.

## Complete RFP Analysis:

### 1. Linguistic Analysis
${JSON.stringify(state.linguisticAnalysis, null, 2)}

### 2. Requirements Analysis  
${JSON.stringify(state.requirementsAnalysis, null, 2)}

### 3. Document Structure Analysis
${JSON.stringify(state.structureAnalysis, null, 2)}

### 4. Strategic Signals Analysis
${JSON.stringify(state.strategicAnalysis, null, 2)}

### 5. Synthesis & Competitive Intelligence
${JSON.stringify(state.synthesisAnalysis, null, 2)}

Use this comprehensive analysis to provide detailed, accurate answers to the user's questions.`,
    },
    ...messages.slice(-5), // Include recent conversation AFTER system message
    {
      role: "human",
      content: state.userFeedback,
    },
  ];

  console.log("[RFP Q&A] Invoking model with", conversationMessages.length, "messages");
  const answer = await model.invoke(conversationMessages);
  console.log("[RFP Q&A] Answer received from model");

  // Add a gentle reminder about next steps
  const enhancedAnswer = new AIMessage({
    content:
      answer.content +
      "\n\nYou can now approve the analysis, request modifications, reject it, or ask another question.",
    name: "rfpAnalysisQuestionAnswering",
  });

  console.log("[RFP Q&A] Returning to human review for next action");
  return new Command({
    goto: "rfpAnalysisHumanReview",
    update: {
      messages: [
        new HumanMessage({ content: state.userFeedback, name: "user" }),
        enhancedAnswer,
      ],
      currentStatus: "Question answered - ready for your decision",
      userFeedback: undefined, // Clear userFeedback after processing
    },
  });
}
