// /**
//  * Vendor Relationships Agent Node
//  * 
//  * Autonomous agent that researches current vendor relationships and partnerships.
//  * Uses 3 tools (discovery, extraction, deep-dive) based on its own judgment.
//  */

// import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
// import { LangGraphRunnableConfig } from "@langchain/langgraph";
// import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
// import { createTopicTools } from "@/agents/proposal-generation/tools/parallel-intelligence-tools.js";
// import { extractToolResults, mergeToolResults, markEntitiesAsSearched } from "./tool-result-utils.js";
// import { createModel } from "@/lib/llm/model-factory.js";

// // Initialize model using factory
// const model = createModel();

// /**
//  * Vendor Relationships Agent
//  * 
//  * This agent autonomously researches vendor relationships and partnerships.
//  */
// export async function vendorRelationshipsAgent(
//   state: typeof OverallProposalStateAnnotation.State,
//   config?: LangGraphRunnableConfig
// ): Promise<{ 
//   messages: AIMessage; 
//   vendorRelationshipsResearch?: any;
//   parallelIntelligenceState?: any;
//   errors?: string[];
// }> {
//   const topic = "current vendor relationships";
//   const company = state.company;
//   const industry = state.industry;
//   const research = state.vendorRelationshipsResearch || {
//     searchQueries: [],
//     searchResults: [],
//     extractedUrls: [],
//     extractedEntities: [],
//     insights: []
//   };
  
//   console.log(`[Vendor Relationships Agent] Starting autonomous research`);
  
//   // Process context data outside the prompt for better formatting
//   const previousSearches = research.searchQueries.length > 0 
//     ? research.searchQueries.map((query: string, index: number) => {
//         const result = research.searchResults[index];
//         const resultCount = result?.results?.length || 0;
//         return `${index + 1}. "${query}" (found ${resultCount} results)`;
//       }).join('\n')
//     : 'None yet';
    
//   const extractedUrls = research.extractedUrls.length > 0
//     ? research.extractedUrls.map((url: string) => `- ${url}`).join('\n')
//     : 'None yet';
    
//   // Format extracted vendors with detailed information
//   const extractedVendors = research.extractedEntities
//     .filter((e: any) => e.type === 'organization')
//     .map((vendor: any) => {
//       const status = vendor.searched ? 'RESEARCHED' : 'NEEDS RESEARCH';
//       let info = `- ${vendor.name} - ${status}`;
//       if (vendor.relationship) info += `\n  Relationship: ${vendor.relationship}`;
//       if (vendor.products && vendor.products.length > 0) {
//         info += `\n  Products/Services: ${vendor.products.slice(0, 3).join(', ')}`;
//         if (vendor.products.length > 3) info += ` (+${vendor.products.length - 3} more)`;
//       }
//       if (vendor.description && vendor.searched) {
//         info += `\n  Details: ${vendor.description.slice(0, 100)}...`;
//       }
//       return info;
//     });
    
//   const extractedVendorsFormatted = extractedVendors.length > 0 
//     ? extractedVendors.join('\n') 
//     : 'None yet';
    
//   // Get unsearched vendors for agent guidance
//   const unsearchedVendors = research.extractedEntities
//     .filter((e: any) => e.type === 'organization' && !e.searched)
//     .slice(0, 5)
//     .map((vendor: any) => `- ${vendor.name}${vendor.relationship ? ` (${vendor.relationship})` : ''}`)
//     .join('\n');

//   // Build autonomous agent prompt with processed variables
//   const systemPrompt = `You are an autonomous vendor relationships researcher for ${company} in the ${industry} sector.

// RESEARCH STRATEGY - Follow this approach:
// 1. DISCOVERY: Find partner pages, integration lists, and customer success stories
// 2. TECHNOLOGY SCAN: Search for technology stack and vendor mentions
// 3. EXTRACTION: Extract vendor names and relationship types from URLs
// 4. DEEP RESEARCH: Research specific vendors and partnerships in detail

// AVAILABLE TOOLS:
// - vendor_relationships_discovery: Find pages about partners and vendors
// - vendor_relationships_extract: Extract vendor/partner information from URLs  
// - vendor_relationships_deepdive: Research specific vendors or partnerships

// TOOL USAGE HEURISTICS:
// - Start with discovery to find partner directories and integration pages
// - Use extraction on promising URLs (partners, integrations, case studies)
// - Use deep-dive for specific vendors to understand the relationship depth
// - Use 3+ tools in parallel when exploring multiple vendor categories

// QUERY CONSTRUCTION - ALWAYS include the company name:
// - ✅ CORRECT: "${company} partners integrations"
// - ✅ CORRECT: "${company} technology vendors"
// - ✅ CORRECT: "${company} Salesforce Microsoft AWS"
// - ❌ WRONG: "partners integrations vendors" (too generic)
// - ❌ WRONG: "technology stack" (will return irrelevant results)

// For discovery searches, always start queries with "${company}" to ensure relevant results.
// For deep-dive searches on vendors, include both the vendor name AND "${company}".

// SELF-EVALUATION - After each tool use, assess:
// - Have I found the key technology partners and vendors?
// - Do I understand what products/services each vendor provides?
// - Have I identified strategic vs. tactical partnerships?
// - Is my information from recent, authoritative sources?

// COMPLETION CRITERIA - Stop when you have:
// - Identified 5-10 key vendors/partners
// - Understood the type of relationship (integration, reseller, strategic partner)
// - Found specific products or services being used
// - Gathered recent evidence of active partnerships

// PREVIOUS SEARCHES (Don't repeat these):
// ${previousSearches}

// EXTRACTED URLS (Already processed):
// ${extractedUrls}

// EXTRACTED VENDORS (Research status):
// ${extractedVendorsFormatted}

// ${unsearchedVendors ? `VENDORS NEEDING RESEARCH:
// ${unsearchedVendors}` : ''}

// IMPORTANT: 
// - Don't repeat similar searches - build on previous results
// - Focus on current, active vendor relationships
// - Look for both technology vendors and service providers
// - If you have unsearched vendors, prioritize researching them
// - If you determine you have sufficient information, simply respond without tool calls
// - Use parallel tool calling when exploring multiple vendor categories

// CRITICAL: When making tool calls, return ONLY the tool call. Do not include any conversational text like "Certainly!", "I'll help you", "Let me search", etc. Just make the tool calls directly.`;

//   const humanPrompt = `Continue researching vendor relationships for ${company}. ${
//     unsearchedVendors 
//       ? 'You have extracted vendors that haven\'t been researched yet - consider using deepdive on them.' 
//       : 'Use your judgment to determine the best tools and when you have sufficient information.'
//   } Follow the research strategy outlined above.`;

//   try {
//     // Emit status
//     if (config?.writer) {
//       config.writer({
//         type: 'status',
//         message: `Vendor relationships research: analyzing previous work...`,
//         agentId: 'vendor-relationships',
//         agentName: 'Vendor Relationships'
//       });
//     }
    
//     // Bind tools and generate response
//     const tools = createTopicTools("vendor_relationships");
//     console.log(`[Vendor Agent] Binding tools:`, tools.map(t => ({ name: t.name })));
//     const modelWithTools = model.bindTools(tools);
    
//     const response = await modelWithTools.invoke([
//       new SystemMessage(systemPrompt),
//       new HumanMessage(humanPrompt)
//     ], config);
    
//     // Check if agent decided to complete (no tool calls)
//     const isComplete = !response.tool_calls || response.tool_calls.length === 0;
    
//     // Log tool calls made by the agent
//     if (response.tool_calls && response.tool_calls.length > 0) {
//       console.log(`[Vendor Relationships Agent] Tool calls made:`, 
//         response.tool_calls.map((tc: any) => ({ 
//           name: tc.name, 
//           args: tc.args 
//         }))
//       );
//     } else {
//       console.log(`[Vendor Relationships Agent] No tool calls - agent determined research is complete`);
//     }
    
//     // Process tool results if any were made
//     let updatedResearch = research;
//     if (response.tool_calls && response.tool_calls.length > 0) {
//       // Only process the current response to avoid reprocessing old tool results
//       const toolResults = extractToolResults([response]);
//       updatedResearch = mergeToolResults(research, toolResults);
      
//       // Mark entities as searched if they were processed by deep-dive tools
//       const searchedEntityNames = toolResults.insights
//         .map((insight: any) => insight.entity)
//         .filter(Boolean);
        
//       if (searchedEntityNames.length > 0) {
//         updatedResearch.extractedEntities = markEntitiesAsSearched(
//           updatedResearch.extractedEntities, 
//           searchedEntityNames
//         );
//       }
//     }
    
//     // Simple quality heuristic based on results
//     const vendorCount = updatedResearch.extractedEntities.filter((e: any) => e.type === 'organization').length;
//     const researchedCount = updatedResearch.extractedEntities.filter((e: any) => e.type === 'organization' && e.searched).length;
//     const quality = researchedCount >= 5 ? 0.9 : (vendorCount > 0 ? 0.6 : 0.3);
    
//     return {
//       messages: response, // Rule 14/15: Return single message, not array
//       vendorRelationshipsResearch: { ...updatedResearch, complete: isComplete },
//       parallelIntelligenceState: {
//         ...state.parallelIntelligenceState,
//         vendorRelationships: {
//           status: isComplete ? "complete" : "running",
//           quality: quality,
//         },
//       },
//     };
    
//   } catch (error) {
//     console.error("[Vendor Relationships Agent] Error:", error);
    
//     // Return an error message instead of empty array
//     const errorMessage = new AIMessage({
//       content: `Error in vendor relationships research: ${error instanceof Error ? error.message : "Unknown error"}`
//     });
    
//     return {
//       messages: errorMessage,
//       errors: [`Vendor relationships agent error: ${error instanceof Error ? error.message : "Unknown error"}`],
//       vendorRelationshipsResearch: { ...research, complete: true },
//       parallelIntelligenceState: {
//         ...state.parallelIntelligenceState,
//         vendorRelationships: {
//           status: "error" as const,
//           errorMessage: error instanceof Error ? error.message : "Unknown error",
//           quality: 0,
//         },
//       },
//     };
//   }
// }

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
import { extractToolResults, markEntitiesAsSearched } from "./tool-result-utils.js";
import { createModel } from "@/lib/llm/model-factory.js";

// Initialize model using factory
const model = createModel();

/**
 * Merge tool results into existing research state
 */
function mergeToolResults(existingResearch: any, toolResults: any): any {
  // Extract data from tool results
  const newQueries = toolResults.queries || [];
  const newSearchResults = toolResults.searchResults || [];
  const newUrls = toolResults.urls || [];
  const newEntities = toolResults.entities || [];
  const newInsights = toolResults.insights || [];
  
  // Merge URLs (avoid duplicates)
  const mergedUrls = [...existingResearch.extractedUrls];
  newUrls.forEach((url: string) => {
    if (!mergedUrls.includes(url)) {
      mergedUrls.push(url);
    }
  });
  
  // Merge entities (avoid duplicates, merge if same entity name)
  const mergedEntities = [...existingResearch.extractedEntities];
  newEntities.forEach((newEntity: any) => {
    const existingIndex = mergedEntities.findIndex(
      (existing: any) => existing.name.toLowerCase() === newEntity.name.toLowerCase()
    );
    
    if (existingIndex >= 0) {
      // Merge with existing entity
      mergedEntities[existingIndex] = {
        ...mergedEntities[existingIndex],
        ...newEntity,
        description: newEntity.description || mergedEntities[existingIndex].description
      };
    } else {
      // Add new entity
      mergedEntities.push(newEntity);
    }
  });
  
  return {
    ...existingResearch,
    searchQueries: [...existingResearch.searchQueries, ...newQueries],
    searchResults: [...existingResearch.searchResults, ...newSearchResults],
    extractedUrls: mergedUrls,
    extractedEntities: mergedEntities,
    insights: [...existingResearch.insights, ...newInsights]
  };
}

/**
 * Vendor Relationships Agent
 * 
 * This agent autonomously researches vendor relationships for competitive intelligence.
 */
export async function vendorRelationshipsAgent(
  state: typeof OverallProposalStateAnnotation.State,
  config?: LangGraphRunnableConfig
): Promise<{ 
  messages: AIMessage; 
  vendorRelationshipsResearch?: any;
  parallelIntelligenceState?: any;
  errors?: string[];
}> {
  const company = state.company;
  const industry = state.industry;
  const research = state.vendorRelationshipsResearch || {
    searchQueries: [],
    searchResults: [],
    extractedUrls: [],
    extractedEntities: [],
    insights: []
  };
  
  console.log(`[Vendor Relationships Agent] 🚀 Starting vendor intelligence research`);
  console.log(`[Vendor Relationships Agent] 📊 Agent inputs - Company: "${company}", Industry: "${industry}"`);
  console.log(`[Vendor Relationships Agent] 🔍 Previous research state:`, {
    queries: research.searchQueries?.length || 0,
    results: research.searchResults?.length || 0,
    urls: research.extractedUrls?.length || 0,
    entities: research.extractedEntities?.length || 0,
    insights: research.insights?.length || 0
  });
  
  // ❌ Validation check for missing data
  if (!company || !industry) {
    console.error(`[Vendor Relationships Agent] ❌ CRITICAL: Missing required data!`, {
      company: company,
      industry: industry,
      companyType: typeof company,
      industryType: typeof industry
    });
  }
  
  // Simple data formatting for agent context
  const previousSearches = research.searchQueries.length > 0 
    ? research.searchQueries.map((query: string, index: number) => 
        `${index + 1}. "${query}" ${research.searchResults[index] ? `(found ${research.searchResults[index].length} results)` : ''}`
      ).join('\n')
    : 'None yet';
    
  const extractedUrls = research.extractedUrls.length > 0
    ? research.extractedUrls.map((url: string) => `- ${url}`).join('\n')
    : 'None yet';
    
  const extractedEntities = research.extractedEntities.length > 0
    ? research.extractedEntities.map((e: any) => 
        `- ${e.name} (${e.type}) - ${e.searched ? 'RESEARCHED' : 'NEEDS RESEARCH'}${e.description ? '\n  ' + e.description.slice(0, 100) + '...' : ''}`
      ).join('\n')
    : 'None yet';

  // Strategic vendor relationships intelligence prompt
  const systemPrompt = `You are a strategic vendor relationships researcher for proposal development. Your mission is to understand ${company}'s vendor ecosystem and partner preferences in the ${industry} sector to inform our competitive positioning and partnership strategy.

STRATEGIC RESEARCH GOAL:
Discover ${company}'s vendor relationships to answer these critical proposal strategy questions:
1. WHO do they like to work with? (Vendor characteristics, company types, preferred partner profiles)
2. WHAT types of relationships do they form? (Strategic partnerships, service contracts, consulting relationships)
3. HOW do they select vendors? (Selection criteria, procurement patterns, decision factors)
4. WHY do they choose certain vendors? (Values alignment, capabilities, past performance drivers)

SUCCESS DEFINITION - Research complete when you can provide strategic insights for:
- Competitive positioning: How do we compare to their preferred vendor types?
- Partnership strategy: Are there teaming opportunities with their current partners?
- Proposal messaging: What vendor characteristics do they value?
- Market intelligence: Who are our competitors in their vendor ecosystem?

RESEARCH STRATEGY - Progressive intelligence gathering:

PHASE 1 - PARTNERSHIP DISCOVERY (Start here)
- Find partnership announcements and press releases
- Search for supplier directories and vendor listings
- Look for contract awards and vendor selections
- Identify strategic alliances and joint ventures

PHASE 2 - RELATIONSHIP EXTRACTION (When you have sources)
- Extract vendor names, relationship types, and contract details
- Identify partnership categories (consulting, technology, services)
- Capture relationship duration and strategic importance
- Map vendor ecosystem and partnership network

PHASE 3 - SELECTION ANALYSIS (When you have relationships)
- Deep-dive into specific vendor selections and why they were chosen
- Research partnership success stories and case studies
- Understand vendor evaluation criteria and selection patterns
- Analyze competitive landscape and market positioning

AVAILABLE TOOLS & DECISION FRAMEWORK:

Use vendor_relationships_discovery when:
- Starting research (Phase 1)
- You need to find partnership announcements or vendor listings
- Looking for contract awards or supplier information
- Searching for strategic alliance announcements

Use vendor_relationships_extract when:
- You have promising sources with vendor information
- You need structured data from partnership announcements
- Processing supplier directories or contract listings
- Extracting relationship details from press releases

Use vendor_relationships_deepdive when:
- You have specific vendors or partnerships to investigate
- You need to understand why certain vendors were selected
- Researching partnership success stories or case studies
- Analyzing competitive positioning and market dynamics

QUERY CONSTRUCTION STRATEGY:

ALWAYS include company name: "${company}"

example queries, you may use these or come up with your own:

Phase 1 Queries (Partnership Discovery):
✅ "${company} partners"
✅ "${company} strategic alliances"
✅ "${company} joint ventures"
✅ "${company} collaborations"
✅ "${company} partnerships"
✅ "${company} suppliers"
✅ "${company} announces partnership press release"
✅ "${company} ${industry} service providers"

Phase 2 Queries (Relationship Extraction):
✅ Extract from: "${company} partnership announcements"
✅ Extract from: "${company} supplier directory"
✅ Extract from: "${company} contract awards"

Phase 3 Queries (Selection Analysis):
✅ "[Vendor Name] ${company} partnership case study"
✅ "${company} vendor selection criteria"
✅ "[Vendor Name] ${company} contract success"

REQUIRED TOOL SEQUENCE:
1. DISCOVERY: Use vendor_relationships_discovery to find sources
2. EXTRACTION: For EACH promising URL, MUST call vendor_relationships_extract
3. DEEP-DIVE: For key vendors found, use vendor_relationships_deepdive

Example workflow:
- vendor_relationships_discovery with "${company} partners" → Get 8 results
- vendor_relationships_extract with top 2 URLs → Extract vendor entities
- vendor_relationships_deepdive for key vendors → Research specific relationships

NEVER skip extraction after discovery!

QUALITY ASSESSMENT - After each tool use, evaluate:

SOURCE QUALITY (Prioritize):
🏆 Official partnership announcements and press releases - Most authoritative
🥈 Contract award notices and supplier directories - Highly reliable
🥉 Industry publications and case studies - Good context
❌ Generic business directories or speculation - Low value

RELATIONSHIP TYPES (Focus on):
- Strategic Partnerships and Alliances
- Service Providers and Consultants  
- Technology Vendors and Solutions Partners
- Suppliers and Contractors
- Joint Ventures and Collaborations

EXAMPLES OF HIGH-VALUE INTELLIGENCE:

EXCELLENT FINDING:
"${company} selected ABC Consulting for $2M digital transformation project in 2024, citing their deep ${industry} expertise and proven methodology. Partnership includes 3-year support agreement."
→ Reveals: Vendor selection, contract value, selection criteria, relationship duration

GOOD FINDING:
"${company} announced strategic partnership with XYZ Corp for supply chain optimization, emphasizing shared commitment to sustainability and innovation."
→ Reveals: Partnership type, strategic focus, values alignment

POOR FINDING:
"${company} works with various vendors."
→ Too generic, no actionable intelligence

PROGRESSIVE DECISION LOGIC:

After Partnership Discovery → Ask yourself:
"Have I found partnership announcements and vendor selections?"
- YES: Move to Relationship Extraction phase
- NO: Try alternative discovery strategies (press releases, contract databases)

After Relationship Extraction → Ask yourself:
"Have I identified key vendors and relationship types?"
- YES: Move to Selection Analysis phase for most important relationships
- NO: Extract from additional sources or search specific vendor categories

After Selection Analysis → Ask yourself:
"Do I understand their vendor preferences and selection patterns?"
- YES: Research complete
- NO: Focus on most strategic or recent vendor relationships

COMPLETION CRITERIA - Stop when you have:
- At least 8-10 search queries executed
- At least 3-5 URLs extracted
- At least 5-10 vendor entities identified
- OR when you see diminishing returns (repeated results)

Stop when you have sufficient intelligence to advise on:
- Key vendor categories and preferred partner types
- Recent vendor selections with selection rationale
- Strategic partnerships and their business value
- Competitive landscape in their vendor ecosystem
- Vendor selection criteria and decision patterns

CURRENT RESEARCH STATE:

PREVIOUS SEARCHES:
${previousSearches}

PROCESSED SOURCES:
${extractedUrls}

VENDOR RELATIONSHIP INTELLIGENCE:
${extractedEntities}

RESEARCH DECISION: Based on what you've found above, decide if you need more intelligence or if you have enough vendor relationship insights for competitive positioning.

CRITICAL INSTRUCTIONS:
- Build upon previous research - don't repeat similar searches
- Focus on recent vendor relationships and selections (last 3 years)
- Look for vendor selection rationale and success factors
- If you have comprehensive vendor ecosystem intelligence, stop researching
- When making tool calls, return ONLY the tool calls - no conversational text`;

  const humanPrompt = `Continue researching vendor relationships for ${company}. Use your judgment to determine the best tools and research strategy based on your current progress.`;

  try {
    // Add random delay to prevent API overload
    const delay = Math.random() * 2000; // 0-2 seconds
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Emit status
    if (config?.writer) {
      config.writer({
        type: 'status',
        message: `Vendor relationships research: mapping partner ecosystem...`,
        agentId: 'vendor-relationships',
        agentName: 'Vendor Relationships'
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
    
    // Log tool calls made by the agent with detailed analysis
    if (response.tool_calls && response.tool_calls.length > 0) {
      console.log(`[Vendor Relationships Agent] 🔧 Agent made ${response.tool_calls.length} tool calls:`);
      response.tool_calls.forEach((tc: any, index: number) => {
        console.log(`  ${index + 1}. Tool: ${tc.name}`);
        console.log(`     Query: "${tc.args?.query || 'NO QUERY'}"`);
        console.log(`     Args: ${JSON.stringify(tc.args)}`);
        console.log(`     ID: ${tc.id}`);
        
        // ❌ Check for poor queries
        const query = tc.args?.query || '';
        if (!query.toLowerCase().includes(company?.toLowerCase() || '')) {
          console.error(`     ❌ WARNING: Query missing company name! Expected "${company}" in "${query}"`);
        }
      });
    } else {
      console.log(`[Vendor Relationships Agent] ✅ No tool calls - agent determined research is complete`);
      console.log(`[Vendor Relationships Agent] 📊 Final state before completion:`, {
        totalQueries: research.searchQueries?.length || 0,
        totalResults: research.searchResults?.length || 0,
        totalUrls: research.extractedUrls?.length || 0,
        totalEntities: research.extractedEntities?.length || 0,
        hasCompany: !!company,
        hasIndustry: !!industry
      });
    }
    
    // Tool result processing will happen AFTER ToolNode executes
    // Don't process tool results here - ToolNode hasn't run yet
    // The subgraph will handle state updates when tools complete
    
    const agentResult = {
      messages: response,
      vendorRelationshipsResearch: { ...research, complete: isComplete },
      parallelIntelligenceState: {
        ...state.parallelIntelligenceState,
        vendorRelationships: {
          status: isComplete ? "complete" : "running",
        },
      },
    };
    
    console.log(`[Vendor Relationships Agent] 📤 Returning result:`, {
      hasMessages: !!agentResult.messages,
      messageType: agentResult.messages?.constructor?.name,
      toolCallsCount: agentResult.messages?.tool_calls?.length || 0,
      researchComplete: agentResult.vendorRelationshipsResearch?.complete,
      status: agentResult.parallelIntelligenceState?.vendorRelationships?.status
    });
    
    return agentResult;
    
  } catch (error) {
    console.error("[Vendor Relationships Agent] Error:", error);
    
    // Return an error message
    const errorMessage = new AIMessage({
      content: `Error in vendor relationships research: ${error instanceof Error ? error.message : "Unknown error"}`
    });
    
    return {
      messages: errorMessage,
      errors: [`Vendor relationships agent error: ${error instanceof Error ? error.message : "Unknown error"}`],
      vendorRelationshipsResearch: { ...research, complete: true },
      parallelIntelligenceState: {
        ...state.parallelIntelligenceState,
        vendorRelationships: {
          status: "error" as const,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      },
    };
  }
}