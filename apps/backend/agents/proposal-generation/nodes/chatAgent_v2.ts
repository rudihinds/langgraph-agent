/**
 * Chat Agent V2 - LangGraph-native multi-agent implementation
 * Based on documented multi-agent multi-turn conversation pattern
 * 
 * This eliminates the recursive loop issue and follows clean Command patterns
 */

import { z } from "zod";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { BaseMessage, AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import {
  Command,
  END
} from "@langchain/langgraph";
import { OverallProposalStateAnnotation } from "../../../state/modules/annotations.js";
import { interpretIntentTool, CommandSchemaType } from "../../../tools/interpretIntentTool.js";

// Initialize LLMs
const chatModel = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.3,
  maxTokens: 2000,
});

const toolModel = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0,
}).bindTools([interpretIntentTool]);

// Schema for structured routing decisions following documented pattern
// Must match exact node names from graph.ts
const ChatRouterSchema = z.object({
  response: z.string().describe("Response to the user"),
  goto: z.enum(["intentInterpreter", "documentLoader", "rfpAnalyzer", "end"]).describe("Next node to visit"),
});

/**
 * Call LLM with structured output following documented pattern
 */
function callChatLlm(messages: BaseMessage[]) {
  return chatModel.withStructuredOutput(ChatRouterSchema, { name: "ChatResponse" }).invoke(messages);
}

/**
 * Chat Agent Node - Entry point for conversations
 * Following documented pattern exactly
 */
export async function chatAgent(
  state: typeof OverallProposalStateAnnotation.State
): Promise<Command> {
  console.log("[Chat Agent V2] Processing user input");

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

  const systemPrompt = `You are a helpful assistant coordinating a proposal generation system with specialized agents.

Available specialized agents:
- intentInterpreter: Interprets user intents for proposal actions (generate, modify, approve sections)
- documentLoader: Loads and processes RFP documents  
- rfpAnalyzer: Analyzes RFP documents and provides strategic insights
- end: Complete the conversation

Current state:
- Has RFP document: ${state.rfpDocument ? 'Yes' : 'No'}
- Document loaded: ${state.rfpDocument?.status === 'loaded' ? 'Yes' : 'No'}

Determine which agent should handle the user's request based on their message and current state. 
Always route to the most appropriate specialized agent unless the conversation should end.`;

  const llmMessages = [
    new SystemMessage(systemPrompt),
    ...messages
  ];

  const response = await callChatLlm(llmMessages);
  
  const aiMsg = new AIMessage({
    content: response.response,
    name: "chatAgent"
  });

  return new Command({
    goto: response.goto === "end" ? END : response.goto,
    update: { 
      messages: [aiMsg]
    }
  });
}

/**
 * Intent Interpreter Node - Handles tool-based intent interpretation
 */
export async function intentInterpreter(
  state: typeof OverallProposalStateAnnotation.State
): Promise<Command> {
  console.log("[Intent Interpreter V2] Processing intent interpretation request");

  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];

  // Use the pre-configured tool model

  const systemPrompt = `You are an intent interpretation specialist. 
Use the interpret_intent tool to analyze the user's request and determine their specific intent for the proposal system.

Always use the interpret_intent tool when processing user requests.`;

  const toolMessages = [
    new SystemMessage(systemPrompt),
    lastMessage
  ];

  const response = await toolModel.invoke(toolMessages);
  
  // Check if tool was called
  if (response.tool_calls && response.tool_calls.length > 0) {
    const toolCall = response.tool_calls[0];
    
    try {
      // Execute the intent tool
      const result = await interpretIntentTool.invoke(toolCall.args);
      
      const aiMsg = new AIMessage({
        content: `I understand you want to: ${result.command}. ${result.request_details || ''}`,
        name: "intentInterpreter"
      });

      // Route based on interpreted intent - use exact node names from graph
      let goto = END;
      switch (result.command) {
        case "load_document":
          goto = "documentLoader";
          break;
        case "regenerate_section":
        case "modify_section":
        case "approve_section":
          // These would route to RFP analyzer or section management in future phases
          goto = "rfpAnalyzer";
          break;
        default:
          goto = END; // ask_question, help, other end the flow
      }

      return new Command({
        goto,
        update: { 
          messages: [aiMsg],
          intent: {
            command: result.command,
            targetSection: result.target_section,
            requestDetails: result.request_details,
          }
        }
      });
      
    } catch (error) {
      console.error("Error executing intent tool:", error);
      
      const errorMsg = new AIMessage({
        content: "I had trouble understanding your request. Could you please rephrase it?",
        name: "intentInterpreter"
      });

      return new Command({
        goto: END,
        update: { messages: [errorMsg] }
      });
    }
  }

  // If no tool call was made, provide a direct response
  const aiMsg = new AIMessage({
    content: response.content,
    name: "intentInterpreter"
  });

  return new Command({
    goto: END,
    update: { messages: [aiMsg] }
  });
}