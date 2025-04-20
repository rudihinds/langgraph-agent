import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

/**
 * Web search tool for deep research
 *
 * This tool allows agents to search the web for real-time information
 * that may not be present in the context or training data
 */
export const webSearchTool = tool(
  async ({ query }) => {
    // Implementation of web search
    // This could use a service like Tavily or another web search API
    try {
      // Placeholder for actual web search implementation
      return `Web search results for: ${query}`;
    } catch (error) {
      return `Error performing web search: ${error.message}`;
    }
  },
  {
    name: "web_search",
    description:
      "Search the web for real-time information about organizations and contexts",
    schema: z.object({
      query: z
        .string()
        .describe("The search query to find specific information"),
    }),
  }
);

/**
 * Deep research tool for solution sought analysis
 *
 * This tool provides specialized research capabilities using a dedicated LLM
 * for deeper analysis of specific topics related to the RFP
 */
export const deepResearchTool = tool(
  async ({ query }) => {
    try {
      // Implementation using o3-mini for deeper research
      const research = await new ChatOpenAI({ model: "gpt-3.5-turbo" })
        .withRetry({ stopAfterAttempt: 3 })
        .invoke([
          new SystemMessage(
            "You are a research assistant that performs deep analysis on specific topics."
          ),
          new HumanMessage(query),
        ]);
      return research.content;
    } catch (error) {
      return `Error performing deep research: ${error.message}`;
    }
  },
  {
    name: "Deep_Research_Tool",
    description:
      "For exploring how the funder approaches similar projects, their methodological preferences, and their strategic priorities.",
    schema: z.object({
      query: z
        .string()
        .describe("The specific research question to investigate"),
    }),
  }
);
