/**
 * Intelligence Search Tool
 * 
 * A flexible web search tool for intelligence gathering that allows the LLM
 * to dynamically construct search queries based on research goals.
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";

// Initialize Tavily search tool
const tavilySearch = new TavilySearchResults({
  maxResults: 5, // Optimal balance between comprehensiveness and token usage
  includeRawContent: true,
  includeAnswer: true,
});

// Initialize Haiku model for status generation (cheap and fast)
const statusModel = new ChatAnthropic({
  modelName: "claude-3-haiku-20240307",
  temperature: 0.3,
  maxTokens: 50,
});

/**
 * Flexible intelligence search tool
 * 
 * This tool allows the LLM to dynamically construct search queries
 * to gather intelligence about companies, vendors, procurement, etc.
 * The LLM decides what queries to run based on the research goals
 * and previous search results.
 */
export const intelligenceSearch = tool(
  async ({ query, focus }: { query: string; focus?: string }, config?: LangGraphRunnableConfig) => {
    console.log(`[Intelligence Search] Searching for: "${query}"${focus ? ` (focus: ${focus})` : ''}`);
    
    // Emit status via config.writer if available
    if (config?.writer) {
      try {
        // Generate human-friendly status message
        const statusPrompt = `Convert this search query into a friendly status message (max 10 words):
Query: ${query}
Focus: ${focus || 'general information'}
Format: "Looking into [specific topic]..."
Examples:
- "Looking into company's recent initiatives..."
- "Researching vendor relationships..."
- "Analyzing procurement patterns..."`;
        
        const statusResponse = await statusModel.invoke(statusPrompt);
        const statusMessage = typeof statusResponse.content === 'string' 
          ? statusResponse.content 
          : 'Searching for information...';
        
        // Write to custom stream
        config.writer(JSON.stringify({
          type: "search_status",
          message: statusMessage,
          query: query,
          focus: focus,
          timestamp: new Date().toISOString()
        }));
      } catch (error) {
        console.warn('[Intelligence Search] Failed to generate status:', error);
        // Fallback status
        config.writer(JSON.stringify({
          type: "search_status",
          message: "Searching for information...",
          timestamp: new Date().toISOString()
        }));
      }
    }
    
    try {
      // Execute the search
      const results = await tavilySearch.invoke(query);
      
      // Parse the results
      let parsedResults;
      if (typeof results === 'string') {
        try {
          parsedResults = JSON.parse(results);
        } catch {
          parsedResults = { results: [{ content: results }] };
        }
      } else {
        parsedResults = results;
      }
      
      // Format results with metadata
      return {
        query,
        focus,
        timestamp: new Date().toISOString(),
        resultCount: parsedResults.results?.length || 0,
        results: parsedResults.results || parsedResults,
        answer: parsedResults.answer || null
      };
      
    } catch (error) {
      console.error(`[Intelligence Search] Error searching for "${query}":`, error);
      return {
        query,
        focus,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Search failed',
        results: []
      };
    }
  },
  {
    name: "intelligence_search",
    description: `Search the web for intelligence gathering purposes. Use this tool to research companies, vendors, procurement activities, decision makers, and other business intelligence.

This is a flexible search tool - construct your queries strategically:
- For official information, include site restrictions (e.g., "site:sam.gov")
- For recent information, include date ranges or year
- For specific document types, include file type (e.g., "filetype:pdf")
- Combine multiple search operators for precise results

Examples:
- "Acme Corp strategic initiatives 2024"
- "Acme Corp contracts cybersecurity site:sam.gov"
- "John Smith Acme Corp procurement director LinkedIn"
- "Acme Corp RFP awards technology services 2023..2024"`,
    schema: z.object({
      query: z.string().describe("The search query. Be specific and use search operators when appropriate."),
      focus: z.string().optional().describe("Optional focus area to help categorize results (e.g., 'initiatives', 'vendors', 'procurement', 'leadership')")
    })
  }
);

/**
 * Get the intelligence search tool
 */
export function getIntelligenceSearchTool() {
  return intelligenceSearch;
}