import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { webSearchTool, deepResearchTool } from "./tools";
import { deepResearchPrompt, solutionSoughtPrompt } from "./prompts/index";

/**
 * Creates the deep research agent that analyzes RFP documents
 * 
 * This agent specializes in extracting structured information from RFP documents
 * using GPT-3.5 Turbo (or similar model) and has access to web search capability
 */
export const createDeepResearchAgent = () => {
  return createReactAgent({
    llm: new ChatOpenAI({ model: "gpt-3.5-turbo" }),
    tools: [webSearchTool],
    systemMessage: deepResearchPrompt,
  });
};

/**
 * Creates the solution sought agent that identifies what funders are looking for
 * 
 * This agent specializes in analyzing research data to determine the ideal solution
 * the funder is seeking, and has access to a specialized research tool
 */
export const createSolutionSoughtAgent = () => {
  return createReactAgent({
    llm: new ChatOpenAI({ model: "gpt-3.5-turbo" }),
    tools: [deepResearchTool],
    systemMessage: solutionSoughtPrompt,
  });
};