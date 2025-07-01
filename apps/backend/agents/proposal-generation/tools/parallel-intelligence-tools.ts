/**
 * Parallel Intelligence Tools
 * 
 * Factory function to create topic-specific tools for parallel intelligence gathering.
 * Each topic agent gets 3 tools: discovery, extraction, and deep-dive.
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { TavilySearch } from "@langchain/tavily";
import { createModel } from "@/lib/llm/model-factory.js";

// Initialize Haiku for helper functions - using a faster model for tool operations
const helperModel = createModel("claude-3-haiku-20240307", {
  temperature: 0,
});

/**
 * Factory function to create topic-specific tools
 * 
 * @param topic - The topic name (e.g., "strategic_initiatives", "vendor_relationships")
 * @returns Array of 3 tools: discovery, extraction, and deep-dive
 */
export function createTopicTools(topic: string) {
  // 1. Discovery Tool - Find listing pages
  const discoveryTool = tool(
    async ({ query }: { query: string }, config) => {
      const tavily = new TavilySearch({
        maxResults: 8,
        includeAnswer: true,
        includeRawContent: true,
        searchDepth: "basic",
      });
      
      const searchResult = await tavily.invoke({ query });
      const parsedResult = typeof searchResult === 'string' 
        ? JSON.parse(searchResult) 
        : searchResult;
      
      // Extract the results array from Tavily response
      const results = parsedResult.results || [];
      
      // Find promising URLs for extraction
      const promisingUrls = await identifyPromisingUrls(results, topic);
      
      // Return data in the same format as intelligence-search tool
      return {
        query: query,
        results: results,
        answer: parsedResult.answer || `Found ${results.length} results with ${promisingUrls.length} promising URLs`,
        promisingUrls: promisingUrls,
        timestamp: new Date().toISOString()
      };
    },
    {
      name: `${topic}_discovery`,
      description: `Find main pages and sources about ${topic}`,
      schema: z.object({
        query: z.string().describe("Simple discovery query")
      })
    }
  );

  // 2. Extraction Tool - Extract from URLs
  const extractionTool = tool(
    async ({ url, extractionType }: { url: string; extractionType: string }, config) => {
      // Use targeted search on the specific URL
      const tavily = new TavilySearch({
        maxResults: 1,
        includeRawContent: true,
        includeDomains: [new URL(url).hostname]
      });
      
      const extracted = await tavily.invoke({ query: url });
      const parsedExtracted = typeof extracted === 'string' 
        ? JSON.parse(extracted) 
        : extracted;
      
      // Get the content from the first result
      const content = parsedExtracted.results?.[0] || parsedExtracted;
      
      // Parse entities based on extraction type
      const entities = await parseEntitiesFromContent(content, extractionType);
      
      // Limit entities to prevent excessive deep-dive searches
      const MAX_ENTITIES_PER_EXTRACTION = 5;
      const limitedEntities = entities.slice(0, MAX_ENTITIES_PER_EXTRACTION);
      
      // Add topic to each entity
      const entitiesWithTopic = limitedEntities.map(e => ({
        ...e,
        topic,
        sourceUrl: url
      }));
      
      // Return data in consistent format
      return {
        query: url,
        results: entitiesWithTopic,
        answer: `Extracted ${limitedEntities.length} ${extractionType} from ${url}`,
        entities: entitiesWithTopic,
        url: url,
        extractionType: extractionType,
        timestamp: new Date().toISOString()
      };
    },
    {
      name: `${topic}_extract`,
      description: `Extract structured data from URLs for ${topic}`,
      schema: z.object({
        url: z.string().url(),
        extractionType: z.enum(["people", "organizations", "products", "auto"])
      })
    }
  );

  // 3. Deep-Dive Tool - Research entities
  const deepDiveTool = tool(
    async ({ entity, entityType }: { entity: string; entityType: string }, config) => {
      const domains = getDomainsForEntityType(entityType);
      const tavily = new TavilySearch({
        maxResults: 10,
        includeAnswer: true,
        ...(domains.length > 0 && { includeDomains: domains })
      });
      
      const query = await buildEntityQuery(entity, entityType, {});
      const searchResult = await tavily.invoke({ query });
      const parsedResult = typeof searchResult === 'string' 
        ? JSON.parse(searchResult) 
        : searchResult;
      
      // Extract the results array from Tavily response
      const results = parsedResult.results || [];
      
      // Extract key insights about the entity
      const insights = extractEntityInsights(results, entity, entityType);
      
      // Return data in consistent format
      return {
        query: query,
        results: results,
        answer: parsedResult.answer || `Deep-dive on ${entity}: Found ${insights.length} key insights`,
        insights: insights,
        entity: entity,
        entityType: entityType,
        timestamp: new Date().toISOString()
      };
    },
    {
      name: `${topic}_deepdive`,
      description: `Deep research on specific ${topic} entities`,
      schema: z.object({
        entity: z.string(),
        entityType: z.enum(["person", "organization", "product", "initiative"])
      })
    }
  );

  return [discoveryTool, extractionTool, deepDiveTool];
}

// Helper functions using LLM for intelligent decisions
async function identifyPromisingUrls(results: any[], topic: string): Promise<string[]> {
  // Define schema for structured output
  const UrlAnalysisSchema = z.object({
    urls: z.array(z.object({
      url: z.string(),
      relevanceScore: z.number().min(0).max(1),
      reasoning: z.string()
    })).describe("Top 2 URLs worth extracting, ordered by relevance")
  });
  
  const structuredModel = helperModel.withStructuredOutput(UrlAnalysisSchema);
  
  const prompt = `Analyze these search results to find URLs worth extracting detailed information from.
Topic: ${topic}

Search Results:
${results.map((r, i) => `${i+1}. Title: ${r.title || 'No title'}
   URL: ${r.url}
   Snippet: ${r.snippet || r.content?.substring(0, 200) || 'No snippet'}`).join('\n\n')}

For the topic "${topic}", identify URLs most likely to contain:
- Structured lists of relevant entities (people, organizations, products)
- Primary sources with detailed information
- Official pages rather than aggregators or news summaries

Consider these examples (but adapt based on the actual topic):
- For leadership/decision makers: team pages, about us sections, board member lists
- For vendors/partnerships: partner directories, integration pages, customer showcases  
- For strategic initiatives: official strategy documents, investor relations, company announcements
- For procurement: government contract databases, award notices, vendor registrations

Score each URL from 0-1 based on likelihood of containing extractable structured data.`;

  try {
    const response = await structuredModel.invoke(prompt);
    // Return top 2 URLs per topic to prevent excessive extractions
    return response.urls
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 2)
      .map(item => item.url);
  } catch (error) {
    console.error("Error identifying promising URLs:", error);
    // Simple fallback
    return results.slice(0, 2).map(r => r.url);
  }
}

async function parseEntitiesFromContent(content: any, extractionType: string): Promise<any[]> {
  // Dynamic schema based on extraction type
  const entitySchemas = {
    people: z.object({
      entities: z.array(z.object({
        name: z.string(),
        title: z.string().optional(),
        department: z.string().optional(),
        linkedIn: z.string().optional(),
        type: z.literal("person")
      }))
    }),
    organizations: z.object({
      entities: z.array(z.object({
        name: z.string(),
        relationship: z.string().optional(),
        description: z.string().optional(),
        website: z.string().optional(),
        type: z.literal("organization")
      }))
    }),
    products: z.object({
      entities: z.array(z.object({
        name: z.string(),
        category: z.string().optional(),
        description: z.string().optional(),
        type: z.literal("product")
      }))
    }),
    auto: z.object({
      entities: z.array(z.object({
        name: z.string(),
        type: z.enum(["person", "organization", "product", "initiative"]),
        metadata: z.record(z.string()).optional()
      }))
    })
  };
  
  const schema = entitySchemas[extractionType] || entitySchemas.auto;
  const structuredModel = helperModel.withStructuredOutput(schema);
  
  const prompt = `Extract structured entities from this content.
Extraction type: ${extractionType}

Content:
${JSON.stringify(content, null, 2)}

Extract all relevant ${extractionType} with as much detail as available.`;

  try {
    const response = await structuredModel.invoke(prompt);
    return response.entities;
  } catch (error) {
    console.error("Error parsing entities:", error);
    return [];
  }
}

async function buildEntityQuery(entity: string, _entityType: string, context: any): Promise<string> {
  const QuerySchema = z.object({
    query: z.string().max(100).describe("Optimized search query"),
    searchDomains: z.array(z.string()).optional().describe("Recommended domains to search")
  });
  
  const structuredModel = helperModel.withStructuredOutput(QuerySchema);
  
  const prompt = `Generate an optimal search query for researching this entity.

Entity: ${entity}
Entity Type: ${_entityType}
Company Context: ${context.company || 'Unknown'}
Industry: ${context.industry || 'Unknown'}

Create a focused query that will find:
- For people: Professional profiles, recent roles, background
- For organizations: Partnerships, collaborations, business relationships
- For products: Features, reviews, implementations
- For initiatives: Goals, timelines, outcomes

Keep the query under 100 characters and natural-sounding.
Suggest specific domains if relevant (e.g., linkedin.com for people).`;

  try {
    const response = await structuredModel.invoke(prompt);
    return response.query;
  } catch (error) {
    console.error("Error building entity query:", error);
    // Simple fallback
    return `${entity} ${context.company || ''}`.trim();
  }
}

function getDomainsForEntityType(entityType: string): string[] {
  const domainMap: Record<string, string[]> = {
    person: ["linkedin.com", "bloomberg.com"],
    organization: ["prnewswire.com", "businesswire.com"],
    product: [],
    initiative: ["reuters.com", "wsj.com"],
  };
  
  return domainMap[entityType] || [];
}

function extractEntityInsights(results: any[], entity: string, _entityType: string): any[] {
  // Process search results to extract key insights
  return results.map(r => ({
    source: r.url,
    title: r.title,
    insight: r.snippet || r.content?.substring(0, 300),
    relevance: r.title?.toLowerCase().includes(entity.toLowerCase()) ? 'high' : 'medium'
  }));
}