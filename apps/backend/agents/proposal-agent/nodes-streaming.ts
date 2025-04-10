/**
 * Streaming implementations of proposal agent nodes
 * 
 * This file provides streaming versions of the node functions used in the proposal agent
 * using the standard LangGraph/LangChain streaming mechanisms.
 */

import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ProposalState } from "./state.js";
import { 
  createStreamingNode, 
  createStreamingToolNode
} from "../../lib/llm/streaming/streaming-node.js";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";

// Create a Tavily search tool for research
const searchTool = new TavilySearchResults({
  apiKey: process.env.TAVILY_API_KEY,
  maxResults: 5
});

/**
 * Create a streaming orchestrator node for the proposal agent
 */
export const streamingOrchestratorNode = createStreamingNode<ProposalState>(
  `You are the orchestrator of a proposal writing workflow.
  Based on the conversation so far and the current state of the proposal,
  determine the next step that should be taken.
  
  Possible actions you can recommend:
  - "research" - Analyze the RFP and extract funder information
  - "solution sought" - Identify what the funder is looking for
  - "connection pairs" - Find alignment between the applicant and funder
  - "generate section" - Write a specific section of the proposal
  - "evaluate" - Review proposal content for quality
  - "human feedback" - Ask for user input or feedback
  
  Your response should indicate which action to take next and why.`,
  "gpt-4o",
  { temperature: 0.5 }
);

/**
 * Create a streaming research node for the proposal agent with web search capability
 */
export const streamingResearchNode = createStreamingToolNode<ProposalState>(
  [searchTool],
  `You are a research specialist focusing on RFP analysis.
  Analyze the RFP and provide key information about the funder:
  
  1. The funder's mission and values
  2. Funding priorities and focus areas
  3. Key evaluation criteria
  4. Budget constraints or requirements
  5. Timeline and deadlines
  
  Use the search tool if needed to find more information.
  Format your response with the heading "Funder:" followed by the summary.`,
  "gpt-4o",
  { temperature: 0.3 }
);

/**
 * Create a streaming solution sought node for the proposal agent
 */
export const streamingSolutionSoughtNode = createStreamingNode<ProposalState>(
  `You are an analyst identifying what solutions funders are seeking.
  Based on the available information, identify what the funder is looking for:
  
  1. The specific problem the funder wants to address
  2. The type of solution the funder prefers
  3. Any constraints or requirements for the solution
  4. Innovation expectations
  5. Impact metrics they value
  
  Format your response with the heading "Solution Sought:" followed by your detailed analysis.`,
  "gpt-4o",
  { temperature: 0.4 }
);

/**
 * Create a streaming connection pairs node for the proposal agent
 */
export const streamingConnectionPairsNode = createStreamingNode<ProposalState>(
  `You are a strategic advisor who identifies alignment between applicants and funders.
  Based on the available information, identify strong connections:
  
  Please identify 5-7 specific connection pairs that align:
  1. What the funder values
  2. What the applicant can offer
  
  Format your response with the heading "Connection Pairs:" followed by a numbered list,
  where each item shows a specific alignment between funder priorities and applicant strengths.`,
  "gpt-4o",
  { temperature: 0.5 }
);

/**
 * Create a streaming section generator node for the proposal agent
 */
export const streamingSectionGeneratorNode = createStreamingNode<ProposalState>(
  `You are a professional proposal writer. 
  Based on the analysis so far, generate content for the requested proposal section.
  
  Make sure your writing:
  1. Addresses the funder's priorities
  2. Highlights strong connections between applicant and funder
  3. Is clear, concise, and compelling
  4. Uses appropriate tone and terminology
  5. Follows best practices for proposal writing
  
  Start by identifying which section you are writing, then generate the content.`,
  "claude-3-7-sonnet",
  { temperature: 0.6, maxTokens: 3000 }
);

/**
 * Create a streaming evaluator node for the proposal agent
 */
export const streamingEvaluatorNode = createStreamingNode<ProposalState>(
  `You are a proposal evaluator with extensive experience reviewing grant applications.
  Review the current proposal content and provide constructive feedback.
  
  Evaluate based on:
  1. Alignment with funder priorities
  2. Clarity and persuasiveness
  3. Organization and flow
  4. Completeness and thoroughness
  5. Overall quality and competitiveness
  
  Provide specific suggestions for improvement.`,
  "gpt-4o",
  { temperature: 0.4 }
);

/**
 * Create a streaming human feedback node for the proposal agent
 */
export const streamingHumanFeedbackNode = createStreamingNode<ProposalState>(
  `You are an interface between the proposal writing system and the human user.
  Your role is to ask for specific feedback on the current state of the proposal.
  
  Based on the current context, formulate clear, specific questions that would help 
  improve the proposal. Focus on areas where human input would be most valuable.
  
  Make your questions direct and actionable.`,
  "gpt-4o",
  { temperature: 0.3 }
);

/**
 * Process the human feedback
 * @param state Current proposal state
 * @returns Updated messages
 */
export async function processHumanFeedback(
  state: ProposalState
): Promise<{ messages: BaseMessage[]; userFeedback: string | undefined }> {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];
  
  // Extract feedback from the last message
  const userFeedback = 
    typeof lastMessage.content === "string" ? lastMessage.content : "";
  
  return {
    messages,
    userFeedback: userFeedback || undefined,
  };
}