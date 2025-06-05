/**
 * Web Search Tool
 * Provides web search capabilities using Brave Search for funder research
 */

import { TavilySearchResults } from "@langchain/community/tools/tavily_search";

/**
 * Simple web search tool using Tavily
 * MVP implementation for enhanced research agent
 */
export function createWebSearchTool() {
  return new TavilySearchResults({
    maxResults: 5,
    searchDepth: "basic",
  });
}

/**
 * Create web search tool with custom parameters
 */
export function createWebSearchToolWithOptions(
  maxResults: number = 5,
  searchDepth: "basic" | "deep" = "basic"
) {
  return new TavilySearchResults({
    maxResults,
    searchDepth,
  });
}
