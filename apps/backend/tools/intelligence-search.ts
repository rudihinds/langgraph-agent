/**
 * Intelligence Search Tool
 * 
 * A flexible web search tool for intelligence gathering that allows the LLM
 * to dynamically construct search queries based on research goals.
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { TavilySearch } from "@langchain/tavily";
import { LangGraphRunnableConfig, Command } from "@langchain/langgraph";
import { createModel } from "@/lib/llm/model-factory.js";
import { ToolMessage } from "@langchain/core/messages";
import { assessSearchQuality } from "@/agents/proposal-generation/nodes/planning/intelligence-gathering/adaptive-search-utils.js";

// Initialize Tavily search tool with enhanced configuration
const tavilySearch = new TavilySearch({
  maxResults: 10, // Increased for better coverage
  includeRawContent: true,
  includeAnswer: true,
  includeImages: false, // Reduce response size for text analysis
});

// Initialize Haiku model for status generation (cheap and fast)
const statusModel = createModel("claude-3-haiku-20240307", {
  temperature: 0.3,
  maxTokens: 50,
});

/**
 * Strategy-based search configurations for Tavily
 */
const STRATEGY_CONFIGS: Record<string, any> = {
  standard: {
    searchDepth: "basic", // Use basic for reliability
  },
  discovery: {
    maxResults: 8, // Increased to find more potential pages
    searchDepth: "basic", // Basic search for better reliability
  },
  expanded: {
    maxResults: 15, // Cast wider net
    topic: "general", // Broad search
  },
  refined: {
    maxResults: 8,
    // Use default basic search depth
  },
  alternative: {
    topic: "news", // Look for recent mentions
    maxResults: 10,
  },
  source_specific: {
    // Will be customized based on topic
    maxResults: 12,
  },
  temporal_extended: {
    maxResults: 10,
    // timeRange will be set dynamically
  },
  inferential: {
    topic: "news", // Look for related news and announcements
    maxResults: 12,
  },
};

/**
 * Domain configurations for different research topics
 */
const TOPIC_DOMAINS: Record<string, string[]> = {
  "strategic initiatives": ["reuters.com", "bloomberg.com", "wsj.com", "ft.com"],
  "vendor relationships": ["prnewswire.com", "businesswire.com"],
  "procurement patterns": ["sam.gov", "usaspending.gov", "fpds.gov"],
  "decision makers": ["linkedin.com", "bloomberg.com", "crunchbase.com"],
  "key decision makers": ["linkedin.com", "bloomberg.com", "crunchbase.com"],
  "leadership": ["linkedin.com"], // Simplified for individual searches
  "team": ["linkedin.com"], // For team member searches
};

/**
 * Flexible intelligence search tool
 * 
 * This tool allows the LLM to dynamically construct search queries
 * to gather intelligence about companies, vendors, procurement, etc.
 * The LLM decides what queries to run based on the research goals
 * and previous search results.
 */
export const intelligenceSearch = tool(
  async ({ query, focus, strategy = "standard", topic = "" }: { 
    query: string; 
    focus?: string;
    strategy?: string;
    topic?: string;
  }, config?: LangGraphRunnableConfig) => {
    console.log(`\n[Intelligence Search] ========== NEW SEARCH ==========`);
  console.log(`[Intelligence Search] Query: "${query}" (${query.length} chars)`);
  console.log(`[Intelligence Search] Strategy: ${strategy}`);
  console.log(`[Intelligence Search] Topic: ${topic || focus || "general"}`);
  console.log(`[Intelligence Search] ===============================`);
  
  // Validate query length
  if (query.length > 400) {
    console.warn(`[Intelligence Search] ⚠️ Query exceeds 400 chars (${query.length}). This may cause issues.`);
  }
    
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
        config.writer({
          message: statusMessage
        });
      } catch (error) {
        console.warn('[Intelligence Search] Failed to generate status:', error);
        // Fallback status
        config.writer({
          message: "Searching for information..."
        });
      }
    }
    
    try {
      // Build search options based on strategy
      const searchOptions: any = {
        ...STRATEGY_CONFIGS[strategy] || {},
      };
      
      // Add domain filtering based on strategy
      if (strategy === "discovery") {
        // For discovery, DON'T restrict domains - search broadly
        console.log(`[Intelligence Search] Discovery mode - searching all domains`);
        // Intentionally not setting includeDomains to allow broad search
      } else if (strategy === "source_specific" && topic) {
        const normalizedTopic = topic.toLowerCase();
        let domains = TOPIC_DOMAINS[normalizedTopic] || 
                     TOPIC_DOMAINS[normalizedTopic.replace(" and ", " ")] ||
                     [];
        
        // Remove any protocol or path from domains to ensure clean domain names
        domains = domains.map(d => d.replace(/^https?:\/\//, '').replace(/\/.*$/, ''));
        
        if (domains.length > 0) {
          searchOptions.includeDomains = domains;
          console.log(`[Intelligence Search] Domain filter: ${domains.join(", ")}`);
        }
      }
      
      // Add time range for temporal extended searches
      if (strategy === "temporal_extended") {
        searchOptions.timeRange = "year"; // Look back one year
        console.log(`[Intelligence Search] Time range: last year`);
      }
      
      // Log final search configuration
      console.log(`[Intelligence Search] Search configuration:`, {
        maxResults: searchOptions.maxResults || 10,
        searchDepth: searchOptions.searchDepth || "basic",
        topic: searchOptions.topic || "general",
        includeDomains: searchOptions.includeDomains || "none",
        timeRange: searchOptions.timeRange || "none"
      });
      
      // SIMPLIFIED: Just use the query as provided
      let searchQuery = query;
      
      // Basic length check
      if (searchQuery.length > 400) {
        searchQuery = searchQuery.substring(0, 397) + "...";
        console.log(`[Intelligence Search] Truncated query to 400 chars`);
      }
      
      console.log(`[Intelligence Search] Final query: "${searchQuery}"`);
      
      // Execute the search with dynamic parameters
      let results = await tavilySearch.invoke({
        query: searchQuery,
        ...searchOptions
      });
      
      // Parse initial results
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
      
      // FALLBACK: If we got 0 results, try a simpler, broader search
      if ((!parsedResults.results || parsedResults.results.length === 0) && strategy === "discovery") {
        console.log(`[Intelligence Search] No results found - trying broader fallback search`);
        
        // Extract just company name
        const companyMatch = query.match(/^([^\s]+(?:\s+[^\s]+)?)/); // Just first 1-2 words
        const simplifiedQuery = companyMatch ? companyMatch[1] : query.split(' ').slice(0, 2).join(' ');
        
        console.log(`[Intelligence Search] Fallback query: "${simplifiedQuery}"`);
        
        // Try with minimal options
        const fallbackResults = await tavilySearch.invoke({
          query: simplifiedQuery,
          maxResults: 10,
          searchDepth: "basic"
          // No domain restrictions, no other filters
        });
        
        if (typeof fallbackResults === 'string') {
          try {
            parsedResults = JSON.parse(fallbackResults);
          } catch {
            parsedResults = { results: [] };
          }
        } else {
          parsedResults = fallbackResults;
        }
      }
      
      // Return to original flow
      results = parsedResults;
      
      // Assess search quality
      const searchQuality = assessSearchQuality(
        parsedResults.results || [],
        query,
        topic || focus || ""
      );
      
      console.log(`[Intelligence Search] Results Summary:`);
      console.log(`  - Result count: ${searchQuality.resultCount}`);
      console.log(`  - Quality scores:`);
      console.log(`    • Overall: ${searchQuality.overall.toFixed(2)}`);
      console.log(`    • Relevance: ${searchQuality.relevance.toFixed(2)}`);
      console.log(`    • Source credibility: ${searchQuality.sourceCredibility.toFixed(2)}`);
      console.log(`    • Completeness: ${searchQuality.completeness.toFixed(2)}`);
      
      // Log quality breakdown
      if (searchQuality.breakdown) {
        console.log(`  - Quality indicators:`);
        console.log(`    • Has official sources: ${searchQuality.breakdown.hasOfficialSources ? "Yes" : "No"}`);
        console.log(`    • Has recent info: ${searchQuality.breakdown.hasRecentInfo ? "Yes" : "No"}`);
        console.log(`    • Covers key aspects: ${searchQuality.breakdown.coversKeyAspects ? "Yes" : "No"}`);
        console.log(`    • Meets minimum threshold: ${searchQuality.breakdown.meetsMinimumThreshold ? "Yes" : "No"}`);
      }
      
      // Log top results
      if (parsedResults.results && parsedResults.results.length > 0) {
        console.log(`  - Top results:`);
        parsedResults.results.slice(0, 3).forEach((result: any, idx: number) => {
          console.log(`    ${idx + 1}. ${result.title || "Untitled"}`);
          console.log(`       URL: ${result.url || "No URL"}`);
        });
      }
      
      // Get current search attempts from state
      const currentState = config?.state as any;
      const existingAttempts = currentState?.searchAttempts || [];
      const topicAttempts = existingAttempts.filter((a: any) => a.topic === topic);
      const attemptNumber = topicAttempts.length + 1;
      
      // Return Command to update multiple state fields
      return new Command({
        update: {
          searchQueries: [query],
          searchResults: [{
            query,
            results: parsedResults.results || [],
            answer: parsedResults.answer || null,
            timestamp: new Date().toISOString()
          }],
          searchAttempts: [{
            query,
            strategy: strategy as any,
            topic: topic || focus || "",
            attemptNumber,
            resultQuality: searchQuality,
            timestamp: new Date().toISOString()
          }],
          messages: [
            new ToolMessage({
              content: `Found ${parsedResults.results?.length || 0} results for: "${query}" (quality: ${searchQuality.overall.toFixed(2)})`,
              tool_call_id: config?.toolCall?.id || "",
            })
          ]
        }
      });
      
    } catch (error) {
      console.error(`[Intelligence Search] Error searching for "${query}":`, error);
      // Error handling with Command
      return new Command({
        update: {
          searchQueries: [query],
          messages: [
            new ToolMessage({
              content: `Search failed for "${query}": ${error instanceof Error ? error.message : 'Unknown error'}`,
              tool_call_id: config?.toolCall?.id || "",
            })
          ],
          errors: [`Search error: ${error instanceof Error ? error.message : 'Unknown error'}`]
        }
      });
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
      focus: z.string().optional().describe("Optional focus area to help categorize results (e.g., 'initiatives', 'vendors', 'procurement', 'leadership')"),
      strategy: z.string().optional().describe("Search strategy to use: standard, expanded, refined, alternative, source_specific, temporal_extended, or inferential"),
      topic: z.string().optional().describe("The research topic this search is for (e.g., 'strategic initiatives and priorities')")
    })
  }
);

/**
 * Helper function to guess company domain from query
 */
function guessCompanyDomain(query: string): string | null {
  // Extract company name from quotes if present
  const quotedMatch = query.match(/"([^"]+)"/);
  const companyName = quotedMatch ? quotedMatch[1] : query;
  
  // Common patterns for UK organizations
  if (companyName.toLowerCase().includes("social finance")) {
    return "socialfinance.org.uk";
  }
  
  // Clean company name and create domain guess
  const cleanName = companyName
    .toLowerCase()
    .replace(/\s+(limited|ltd|inc|llc|corp|corporation|company|co\.)$/i, '')
    .replace(/\s+(uk|usa|us|eu|international|global)$/i, '') // Remove country suffixes
    .replace(/[^a-z0-9]/g, '');
  
  // If name is too short or generic, don't guess
  if (cleanName.length < 3) {
    return null;
  }
  
  // For UK queries, prefer UK domains
  if (query.toLowerCase().includes(' uk')) {
    // Try UK domains first for UK companies
    return `${cleanName}.co.uk`; // Most UK companies use .co.uk
  }
  
  // Default to .com for other queries
  return `${cleanName}.com`;
}

/**
 * Get the intelligence search tool
 */
export function getIntelligenceSearchTool() {
  return intelligenceSearch;
}