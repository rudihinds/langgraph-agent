/**
 * Vendor Relationships Agent Node
 * 
 * Autonomous agent that researches current vendor relationships and partnerships.
 * Uses 3 tools (discovery, extraction, deep-dive) based on its own judgment.
 */

import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { createTopicTools } from "@/agents/proposal-generation/tools/parallel-intelligence-tools.js";
import { extractToolResults, mergeToolResults, markEntitiesAsSearched } from "./tool-result-utils.js";
import { createModel } from "@/lib/llm/model-factory.js";

// Initialize model using factory
const model = createModel();

/**
 * Vendor Relationships Agent
 * 
 * This agent autonomously researches vendor relationships and partnerships.
 */
export async function vendorRelationshipsAgent(
  state: typeof OverallProposalStateAnnotation.State,
  config?: LangGraphRunnableConfig
): Promise<{ 
  messages: AIMessage[]; 
  vendorRelationshipsResearch?: any;
  parallelIntelligenceState?: any;
  errors?: string[];
}> {
  const topic = "current vendor relationships";
  const company = state.company;
  const industry = state.industry;
  const research = state.vendorRelationshipsResearch || {
    searchQueries: [],
    searchResults: [],
    extractedUrls: [],
    extractedEntities: [],
    insights: []
  };
  
  console.log(`[Vendor Relationships Agent] Starting autonomous research`);
  
  // Process context data outside the prompt for better formatting
  const previousSearches = research.searchQueries.length > 0 
    ? research.searchQueries.map((query: string, index: number) => {
        const result = research.searchResults[index];
        const resultCount = result?.results?.length || 0;
        return `${index + 1}. "${query}" (found ${resultCount} results)`;
      }).join('\n')
    : 'None yet';
    
  const extractedUrls = research.extractedUrls.length > 0
    ? research.extractedUrls.map((url: string) => `- ${url}`).join('\n')
    : 'None yet';
    
  // Format extracted vendors with detailed information
  const extractedVendors = research.extractedEntities
    .filter((e: any) => e.type === 'organization')
    .map((vendor: any) => {
      const status = vendor.searched ? 'RESEARCHED' : 'NEEDS RESEARCH';
      let info = `- ${vendor.name} - ${status}`;
      if (vendor.relationship) info += `\n  Relationship: ${vendor.relationship}`;
      if (vendor.products && vendor.products.length > 0) {
        info += `\n  Products/Services: ${vendor.products.slice(0, 3).join(', ')}`;
        if (vendor.products.length > 3) info += ` (+${vendor.products.length - 3} more)`;
      }
      if (vendor.description && vendor.searched) {
        info += `\n  Details: ${vendor.description.slice(0, 100)}...`;
      }
      return info;
    });
    
  const extractedVendorsFormatted = extractedVendors.length > 0 
    ? extractedVendors.join('\n') 
    : 'None yet';
    
  // Get unsearched vendors for agent guidance
  const unsearchedVendors = research.extractedEntities
    .filter((e: any) => e.type === 'organization' && !e.searched)
    .slice(0, 5)
    .map((vendor: any) => `- ${vendor.name}${vendor.relationship ? ` (${vendor.relationship})` : ''}`)
    .join('\n');

  // Build autonomous agent prompt with processed variables
  const systemPrompt = `You are an autonomous vendor relationships researcher for ${company} in the ${industry} sector.

RESEARCH STRATEGY - Follow this approach:
1. DISCOVERY: Find partner pages, integration lists, and customer success stories
2. TECHNOLOGY SCAN: Search for technology stack and vendor mentions
3. EXTRACTION: Extract vendor names and relationship types from URLs
4. DEEP RESEARCH: Research specific vendors and partnerships in detail

AVAILABLE TOOLS:
- vendor_relationships_discovery: Find pages about partners and vendors
- vendor_relationships_extract: Extract vendor/partner information from URLs  
- vendor_relationships_deepdive: Research specific vendors or partnerships

TOOL USAGE HEURISTICS:
- Start with discovery to find partner directories and integration pages
- Use extraction on promising URLs (partners, integrations, case studies)
- Use deep-dive for specific vendors to understand the relationship depth
- Use 3+ tools in parallel when exploring multiple vendor categories

SELF-EVALUATION - After each tool use, assess:
- Have I found the key technology partners and vendors?
- Do I understand what products/services each vendor provides?
- Have I identified strategic vs. tactical partnerships?
- Is my information from recent, authoritative sources?

COMPLETION CRITERIA - Stop when you have:
- Identified 5-10 key vendors/partners
- Understood the type of relationship (integration, reseller, strategic partner)
- Found specific products or services being used
- Gathered recent evidence of active partnerships

PREVIOUS SEARCHES (Don't repeat these):
${previousSearches}

EXTRACTED URLS (Already processed):
${extractedUrls}

EXTRACTED VENDORS (Research status):
${extractedVendorsFormatted}

${unsearchedVendors ? `VENDORS NEEDING RESEARCH:
${unsearchedVendors}` : ''}

IMPORTANT: 
- Don't repeat similar searches - build on previous results
- Focus on current, active vendor relationships
- Look for both technology vendors and service providers
- If you have unsearched vendors, prioritize researching them
- If you determine you have sufficient information, simply respond without tool calls
- Use parallel tool calling when exploring multiple vendor categories`;

  const humanPrompt = `Continue researching vendor relationships for ${company}. ${
    unsearchedVendors 
      ? 'You have extracted vendors that haven\'t been researched yet - consider using deepdive on them.' 
      : 'Use your judgment to determine the best tools and when you have sufficient information.'
  } Follow the research strategy outlined above.`;

  try {
    // Emit status
    if (config?.writer) {
      config.writer({
        message: `Vendor relationships research: analyzing previous work...`,
      });
    }
    
    // Bind tools and generate response
    const tools = createTopicTools("vendor_relationships");
    const modelWithTools = model.bindTools(tools);
    
    const response = await modelWithTools.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt)
    ], config);
    
    // Check if agent decided to complete (no tool calls)
    const isComplete = !response.tool_calls || response.tool_calls.length === 0;
    
    // Log tool calls made by the agent
    if (response.tool_calls && response.tool_calls.length > 0) {
      console.log(`[Vendor Relationships Agent] Tool calls made:`, 
        response.tool_calls.map((tc: any) => ({ 
          name: tc.name, 
          args: tc.args 
        }))
      );
    } else {
      console.log(`[Vendor Relationships Agent] No tool calls - agent determined research is complete`);
    }
    
    // Process tool results if any were made
    let updatedResearch = research;
    if (response.tool_calls && response.tool_calls.length > 0) {
      const allMessages = [...(state.messages || []), response];
      const toolResults = extractToolResults(allMessages);
      updatedResearch = mergeToolResults(research, toolResults);
      
      // Mark entities as searched if they were processed by deep-dive tools
      const searchedEntityNames = toolResults.insights
        .map((insight: any) => insight.entity)
        .filter(Boolean);
        
      if (searchedEntityNames.length > 0) {
        updatedResearch.extractedEntities = markEntitiesAsSearched(
          updatedResearch.extractedEntities, 
          searchedEntityNames
        );
      }
    }
    
    // Simple quality heuristic based on results
    const vendorCount = updatedResearch.extractedEntities.filter((e: any) => e.type === 'organization').length;
    const researchedCount = updatedResearch.extractedEntities.filter((e: any) => e.type === 'organization' && e.searched).length;
    const quality = researchedCount >= 5 ? 0.9 : (vendorCount > 0 ? 0.6 : 0.3);
    
    return {
      messages: [],
      vendorRelationshipsResearch: { ...updatedResearch, complete: isComplete },
      parallelIntelligenceState: {
        ...state.parallelIntelligenceState,
        vendorRelationships: {
          status: isComplete ? "complete" : "running",
          quality: quality,
        },
      },
    };
    
  } catch (error) {
    console.error("[Vendor Relationships Agent] Error:", error);
    
    return {
      messages: [],
      errors: [`Vendor relationships agent error: ${error instanceof Error ? error.message : "Unknown error"}`],
      vendorRelationshipsResearch: { ...research, complete: true },
      parallelIntelligenceState: {
        ...state.parallelIntelligenceState,
        vendorRelationships: {
          status: "error" as const,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
          quality: 0,
        },
      },
    };
  }
}