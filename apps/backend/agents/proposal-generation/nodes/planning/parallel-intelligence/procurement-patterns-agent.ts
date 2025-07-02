// 

/**
 * Procurement Patterns Agent Node
 * 
 * Autonomous agent that researches procurement patterns and contract history.
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
 * Procurement Patterns Agent
 * 
 * This agent autonomously researches procurement patterns, contract history,
 * and spending patterns to inform proposal strategy.
 */
export async function procurementPatternsAgent(
  state: typeof OverallProposalStateAnnotation.State,
  config?: LangGraphRunnableConfig
): Promise<{ 
  messages: AIMessage; 
  procurementPatternsResearch?: any;
  parallelIntelligenceState?: any;
  errors?: string[];
}> {
  const company = state.company;
  const industry = state.industry;
  const research = state.procurementPatternsResearch || {
    searchQueries: [],
    searchResults: [],
    extractedUrls: [],
    extractedEntities: [],
    insights: []
  };
  
  console.log(`[Procurement Patterns Agent] Starting strategic research for ${company}`);
  
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

  // Strategic procurement intelligence prompt
  const systemPrompt = `You are a strategic procurement intelligence researcher for proposal development. Your mission is to gather actionable intelligence about ${company} in the ${industry} sector to inform our proposal strategy.

STRATEGIC RESEARCH GOAL:
Discover ${company}'s procurement patterns to answer these critical proposal strategy questions:
1. WHO do they typically fund? (Preferred vendor types, incumbent contractors, partnership patterns)
2. WHAT do they typically fund? (Project types, solution categories, spending priorities)
3. HOW do they fund? (Contract structures, values, durations, evaluation criteria)
4. WHEN do they fund? (Procurement cycles, renewal patterns, budget timing)

SUCCESS DEFINITION - Research complete when you can provide strategic insights for:
- Competitive positioning: Who are we competing against?
- Solution alignment: What types of solutions do they value?
- Proposal messaging: What themes resonate with their procurement decisions?
- Partnership opportunities: Are there teaming opportunities with their preferred vendors?

RESEARCH STRATEGY - Progressive intelligence gathering:

PHASE 1 - LANDSCAPE DISCOVERY (Start here)
- Search for recent contract awards and RFP announcements
- Identify major vendors and contract values
- Map procurement categories and spending patterns

PHASE 2 - VENDOR ANALYSIS (When you have contract data)
- Research winning vendors and their solutions
- Analyze contract scopes and requirements
- Identify incumbent relationships and partnerships

PHASE 3 - PATTERN SYNTHESIS (When you have vendor data)
- Deep-dive into specific high-value contracts
- Understand evaluation criteria and selection factors
- Map procurement cycles and renewal schedules

AVAILABLE TOOLS & DECISION FRAMEWORK:

Use procurement_patterns_discovery when:
- Starting research (Phase 1)
- You need to find contract announcements or awards
- Searching government databases (sam.gov, usaspending.gov)
- Looking for RFP/bid opportunities

Use procurement_patterns_extract when:
- You have promising contract documents or award pages
- You need structured data from procurement notices
- Processing government contract listings

Use procurement_patterns_deepdive when:
- You have specific contracts/vendors to investigate
- You need details about contract scope and performance
- Researching vendor capabilities and past work

QUERY CONSTRUCTION STRATEGY:

ALWAYS include company name: "${company}"

example queries, you may use these or come up with your own:
Phase 1 Queries (Discovery) :
✅ "${company} federal contracts"
✅ "${company} government contracts awards"
✅ "${company} ${industry} sector procurement history"

Phase 2 Queries (Vendor Analysis):
✅ "${company} prime contractors subcontractors"
✅ "${company} vendor partnerships teaming agreements"
✅ "[specific vendor name] contracts with ${company}"

Phase 3 Queries (Deep Analysis):
✅ "[specific contract number] scope requirements"
✅ "${company} procurement evaluation criteria"
✅ "${company} contract renewal cycles"

QUALITY ASSESSMENT - After each tool use, evaluate:

SOURCE QUALITY (Prioritize):
🏆 Government databases (sam.gov, usaspending.gov go.uk etc) - Most authoritative
🥈 Official ${company} procurement announcements - Highly reliable  
🥉 Industry publications and contractor press releases - Good context
❌ Generic business directories or SEO content - Low value

REQUIRED TOOL SEQUENCE:
1. DISCOVERY: Use procurement_patterns_discovery to find sources
2. EXTRACTION: For EACH promising URL, MUST call procurement_patterns_extract
3. DEEP-DIVE: For key contracts/vendors, use procurement_patterns_deepdive

Example workflow:
- procurement_patterns_discovery with "${company} contract awards" → Get 8 results
- procurement_patterns_extract with top 2 URLs → Extract contract entities
- procurement_patterns_deepdive for key vendors → Research specific contracts

NEVER skip extraction after discovery!

INTELLIGENCE VALUE (Assess each finding):
- Does this reveal procurement preferences or patterns?
- Can we identify competitive themes or positioning opportunities?
- Does this show vendor relationships we should know about?
- Are there specific requirements or evaluation criteria mentioned?

EXAMPLES OF HIGH-VALUE INTELLIGENCE:

EXCELLENT FINDING:
"${company} awarded $2.3M cybersecurity contract to [Vendor X] in 2024 for cloud migration security services. Contract included requirements for FedRAMP certification and zero-trust architecture implementation."
→ Reveals: Spending level, incumbent vendor, specific technical requirements, compliance needs

GOOD FINDING:
"${company} typically awards 3-year contracts in Q2 for IT services, with emphasis on small business participation."
→ Reveals: Contract duration, timing patterns, procurement preferences

POOR FINDING:
"${company} is a large organization that uses technology."
→ Too generic, no actionable intelligence

PROGRESSIVE DECISION LOGIC:

After Discovery Phase → Ask yourself:
"Have I found recent contracts and identified key vendors?"
- YES: Move to Vendor Analysis phase
- NO: Try alternative search strategies or government databases

After Vendor Analysis → Ask yourself:
"Do I understand their vendor ecosystem and preferences?"
- YES: Move to Pattern Synthesis phase  
- NO: Deep-dive into specific vendor relationships

After Pattern Synthesis → Ask yourself:
"Can I provide strategic proposal guidance based on this intelligence?"
- YES: Research complete
- NO: Identify specific gaps and target additional research

COMPLETION CRITERIA - Stop when you have:
- At least 8-10 search queries executed
- At least 3-5 URLs extracted
- At least 5-10 contract/vendor entities identified
- OR when you see diminishing returns (repeated results)

Stop when you have sufficient intelligence to advise on:
- Primary competitors and incumbent vendors
- Typical contract values and structures in our service area
- Key evaluation criteria and procurement preferences
- Timing patterns and upcoming opportunities
- Partnership/teaming recommendations

CURRENT RESEARCH STATE:

PREVIOUS SEARCHES:
${previousSearches}

PROCESSED SOURCES:
${extractedUrls}

PROCUREMENT INTELLIGENCE GATHERED:
${extractedEntities}

RESEARCH DECISION: Based on what you've found above, decide if you need more intelligence or if you have enough to inform proposal strategy. Focus on actionable intelligence for proposal development.

CRITICAL INSTRUCTIONS:
- Build upon previous research - don't repeat similar searches
- Focus on actionable intelligence for proposal strategy
- Prioritize recent contracts (last 3 years) over historical data
- If you have comprehensive intelligence across all phases, stop researching
- When making tool calls, return ONLY the tool calls - no conversational text`;

  const humanPrompt = `Continue researching procurement patterns for ${company}. Use your judgment to determine the best tools and research strategy based on your current progress.`;

  try {
    // Add random delay to prevent API overload
    const delay = Math.random() * 2000; // 0-2 seconds
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Emit status
    if (config?.writer) {
      config.writer({
        type: 'status',
        message: `Procurement patterns research: analyzing intelligence gaps...`,
        agentId: 'procurement-patterns',
        agentName: 'Procurement Patterns'
      });
    }
    
    // Bind tools and generate response
    const tools = createTopicTools("procurement_patterns");
    const modelWithTools = model.bindTools(tools);
    
    const response = await modelWithTools.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt)
    ], config);
    
    // Check if agent decided to complete (no tool calls)
    const isComplete = !response.tool_calls || response.tool_calls.length === 0;
    
    // Log tool calls made by the agent
    if (response.tool_calls && response.tool_calls.length > 0) {
      console.log(`[Procurement Patterns Agent] Tool calls made:`, 
        response.tool_calls.map((tc: any) => ({ 
          name: tc.name, 
          args: tc.args 
        }))
      );
    } else {
      console.log(`[Procurement Patterns Agent] No tool calls - agent determined research is complete`);
    }
    
    // Tool result processing will happen AFTER ToolNode executes
    // Don't process tool results here - ToolNode hasn't run yet
    // The subgraph will handle state updates when tools complete
    
    return {
      messages: response,
      procurementPatternsResearch: { ...research, complete: isComplete },
      parallelIntelligenceState: {
        ...state.parallelIntelligenceState,
        procurementPatterns: {
          status: isComplete ? "complete" : "running",
        },
      },
    };
    
  } catch (error) {
    console.error("[Procurement Patterns Agent] Error:", error);
    
    // Return an error message
    const errorMessage = new AIMessage({
      content: `Error in procurement patterns research: ${error instanceof Error ? error.message : "Unknown error"}`
    });
    
    return {
      messages: errorMessage,
      errors: [`Procurement patterns agent error: ${error instanceof Error ? error.message : "Unknown error"}`],
      procurementPatternsResearch: { ...research, complete: true },
      parallelIntelligenceState: {
        ...state.parallelIntelligenceState,
        procurementPatterns: {
          status: "error" as const,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      },
    };
  }
}