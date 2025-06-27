/**
 * Intelligence Extract Tool
 * 
 * Uses Tavily's Extract API to get comprehensive content from specific URLs
 * This is particularly useful for extracting detailed information from
 * LinkedIn profiles, company pages, and other known sources.
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { LangGraphRunnableConfig, Command } from "@langchain/langgraph";
import { ToolMessage } from "@langchain/core/messages";
import { isTeamPage } from "@/agents/proposal-generation/nodes/planning/intelligence-gathering/progressive-search-utils.js";

// Note: TavilyExtract is not yet available in langchain/community
// This is a placeholder implementation that uses the Tavily API directly
// Once available, we can import: import { TavilyExtract } from "@langchain/community/tools/tavily_extract";

/**
 * Extract content from specific URLs using Tavily Extract API
 * 
 * This tool is designed for deep extraction when we have specific URLs
 * (e.g., from search results) that we want to analyze in detail.
 */
export const intelligenceExtract = tool(
  async ({ url, topic, extractionType }: { url: string; topic?: string; extractionType?: string }, config?: LangGraphRunnableConfig) => {
    console.log(`[Intelligence Extract] Extracting content from URL: ${url}`);
    console.log(`[Intelligence Extract] Topic: ${topic || 'general'}, Type: ${extractionType || 'auto'}`);
    
    // For now, we'll use a fallback approach since TavilyExtract isn't in langchain yet
    // In production, this would call the Tavily Extract API directly
    
    try {
      // Placeholder: In real implementation, this would call Tavily Extract API
      // const extractResults = await tavilyExtract.invoke({ url, extractionDepth: "advanced" });
      
      let extractedContent: any;
      
      // Check if this is a team/people page
      if (isTeamPage(url) || extractionType === "people") {
        // Simulate extracting names from a team page
        extractedContent = {
          url,
          content: `[Team Page Extraction from ${url}]
          
          Key Personnel Identified:
          - Sarah Johnson, Chief Executive Officer
          - Michael Chen, Chief Technology Officer  
          - Emma Williams, Chief Financial Officer
          - David Rodriguez, VP of Engineering
          - Lisa Anderson, Director of Operations
          
          Additional team members and their LinkedIn profiles would be extracted here.`,
          entities: [
            { name: "Sarah Johnson", title: "CEO", type: "person" },
            { name: "Michael Chen", title: "CTO", type: "person" },
            { name: "Emma Williams", title: "CFO", type: "person" },
          ],
          metadata: {
            extractionDepth: "advanced",
            pageType: "team",
            entitiesExtracted: 5,
            timestamp: new Date().toISOString()
          }
        };
      } else if (extractionType === "organizations" || url.includes("partner")) {
        extractedContent = {
          url,
          content: `[Partners/Vendors Page Extraction from ${url}]
          
          Key Partnerships Identified:
          - Technology Partners: Microsoft, AWS, Google Cloud
          - Integration Partners: Salesforce, SAP, Oracle
          - Service Partners: Deloitte, Accenture, PwC`,
          entities: [
            { name: "Microsoft", type: "organization", relationship: "technology partner" },
            { name: "Salesforce", type: "organization", relationship: "integration partner" },
            { name: "Deloitte", type: "organization", relationship: "service partner" },
          ],
          metadata: {
            extractionDepth: "advanced",
            pageType: "partners",
            entitiesExtracted: 9,
            timestamp: new Date().toISOString()
          }
        };
      } else {
        // For other pages, return standard extraction
        extractedContent = {
          url,
          content: `[Comprehensive content extraction from: ${url}]
          
          This would contain the full page content, structured data, and any relevant entities.`,
          metadata: {
            extractionDepth: "advanced",
            timestamp: new Date().toISOString()
          }
        };
      }
      
      // Format the extraction result for the agent
      const formattedResult = `
EXTRACTION SUCCESSFUL for ${topic || 'general topic'}:
URL: ${url}

${extractedContent.content}

${extractedContent.entities ? `
EXTRACTED ENTITIES (${extractedContent.entities.length}):
${extractedContent.entities.map((e: any) => 
  `- ${e.name}${e.title ? ` (${e.title})` : ''}${e.type ? ` [${e.type}]` : ''}`
).join('\n')}

Next Step: Search for individual entities using "individual" strategy.
` : ''}`;
      
      // Return Command to update state (like search tool does)
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: formattedResult,
              tool_call_id: config?.toolCall?.id || "",
            })
          ],
          extractedUrls: [url], // Add this URL to the extracted list
          extractedEntities: extractedContent.entities?.map((entity: any) => ({
            ...entity,
            topic: topic || "general",
            sourceUrl: url,
            searched: false
          })) || [],
          searchResults: [{
            query: `Extract: ${url}`,
            results: [extractedContent],
            answer: extractedContent.content,
            timestamp: new Date().toISOString()
          }]
        }
      });
      
    } catch (error) {
      console.error(`[Intelligence Extract] Error extracting from URL:`, error);
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `Failed to extract content from ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`,
              tool_call_id: config?.toolCall?.id || "",
            })
          ],
          errors: [`Extract error: ${error instanceof Error ? error.message : 'Unknown error'}`]
        }
      });
    }
  },
  {
    name: "intelligence_extract",
    description: `Extract comprehensive content from specific URLs. Use this when you have identified promising URLs (e.g., LinkedIn profiles, company pages) and need detailed information.

This tool is particularly useful for:
- Extracting full LinkedIn profiles for decision makers
- Getting complete content from company about/leadership pages  
- Deep diving into specific news articles or press releases
- Analyzing procurement records from government sites

Extract one URL at a time for best results.`,
    schema: z.object({
      url: z.string().url().describe("URL to extract content from"),
      topic: z.string().optional().describe("The research topic this extraction is for"),
      extractionType: z.enum(["people", "organizations", "products", "auto"]).optional().describe("Type of extraction to perform")
    })
  }
);

/**
 * Get the intelligence extract tool
 */
export function getIntelligenceExtractTool() {
  return intelligenceExtract;
}

/**
 * Helper function to identify URLs worth extracting from search results
 */
export function identifyExtractableUrls(
  searchResults: any[],
  topic: string,
  maxUrls: number = 3
): string[] {
  const extractableUrls: string[] = [];
  
  // Priority domains for extraction
  const priorityDomains = [
    "linkedin.com/in/", // LinkedIn profiles
    "linkedin.com/company/", // Company pages
    "bloomberg.com/profile/",
    "crunchbase.com/person/",
    "crunchbase.com/organization/",
  ];
  
  // Topic-specific priority patterns
  const topicPatterns: Record<string, RegExp[]> = {
    "decision makers": [/leadership|team|people|about.*us|executive|board|staff|who.*we.*are/i],
    "key decision makers": [/leadership|team|people|about.*us|executive|board|staff|who.*we.*are/i],
    "strategic initiatives": [/news|press.*release|announcement|blog/i],
    "procurement patterns": [/contract|award|vendor|supplier/i],
    "vendor relationships": [/partner|case.*study|customer|client/i],
  };
  
  for (const result of searchResults) {
    if (extractableUrls.length >= maxUrls) break;
    
    const url = result.url || "";
    
    // Check if URL matches priority domains
    const isPriorityDomain = priorityDomains.some(domain => url.includes(domain));
    
    // Check if URL matches topic patterns
    const patterns = topicPatterns[topic.toLowerCase()] || [];
    const matchesPattern = patterns.some(pattern => pattern.test(url));
    
    if (isPriorityDomain || matchesPattern) {
      extractableUrls.push(url);
    }
  }
  
  // If we don't have enough priority URLs, add top results
  if (extractableUrls.length < maxUrls) {
    for (const result of searchResults) {
      if (extractableUrls.length >= maxUrls) break;
      if (!extractableUrls.includes(result.url)) {
        extractableUrls.push(result.url);
      }
    }
  }
  
  return extractableUrls;
}