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
import { extractToolResults, mergeToolResults, markEntitiesAsSearched } from "./tool-result-utils.js";
import { createModel } from "@/lib/llm/model-factory.js";

// Initialize model using factory
const model = createModel();

/**
 * Procurement Patterns Agent
 * 
 * This agent autonomously researches procurement patterns, contract history,
 * and spending patterns, with special focus on government databases.
 */
export async function procurementPatternsAgent(
  state: typeof OverallProposalStateAnnotation.State,
  config?: LangGraphRunnableConfig
): Promise<{ 
  messages: AIMessage[]; 
  procurementPatternsResearch?: any;
  parallelIntelligenceState?: any;
  errors?: string[];
}> {
  const topic = "procurement patterns and history";
  const company = state.company;
  const industry = state.industry;
  const research = state.procurementPatternsResearch || {
    searchQueries: [],
    searchResults: [],
    extractedUrls: [],
    extractedEntities: [],
    insights: []
  };
  
  console.log(`[Procurement Patterns Agent] Starting autonomous research`);
  
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
    
  // Format extracted contracts/procurements with detailed information
  const extractedContracts = research.extractedEntities
    .filter((e: any) => e.type === 'product' || e.type === 'initiative') // Products often represent contracts
    .map((contract: any) => {
      const status = contract.searched ? 'RESEARCHED' : 'NEEDS RESEARCH';
      let info = `- ${contract.name} - ${status}`;
      if (contract.vendor) info += `\n  Vendor: ${contract.vendor}`;
      if (contract.amount) info += `\n  Amount: ${contract.amount}`;
      if (contract.date) info += `\n  Date: ${contract.date}`;
      if (contract.category) info += `\n  Category: ${contract.category}`;
      if (contract.description && contract.searched) {
        info += `\n  Details: ${contract.description.slice(0, 100)}...`;
      }
      return info;
    });
    
  const extractedContractsFormatted = extractedContracts.length > 0 
    ? extractedContracts.join('\n') 
    : 'None yet';
    
  // Get unsearched contracts for agent guidance
  const unsearchedContracts = research.extractedEntities
    .filter((e: any) => (e.type === 'product' || e.type === 'initiative') && !e.searched)
    .slice(0, 5)
    .map((contract: any) => `- ${contract.name}${contract.vendor ? ` (${contract.vendor})` : ''}`)
    .join('\n');

  // Build autonomous agent prompt with processed variables
  const systemPrompt = `You are an autonomous procurement patterns researcher for ${company} in the ${industry} sector.

RESEARCH STRATEGY - Follow this approach:
1. GOVERNMENT SEARCH: Start with sam.gov and usaspending.gov for federal contracts
2. PUBLIC RECORDS: Search for RFP awards, contract announcements
3. VENDOR INSIGHTS: Research winning vendors and contract values
4. PATTERN ANALYSIS: Identify procurement cycles and preferences

AVAILABLE TOOLS:
- procurement_patterns_discovery: Find procurement and contract information
- procurement_patterns_extract: Extract contract details from URLs  
- procurement_patterns_deepdive: Research specific contracts or patterns

TOOL USAGE HEURISTICS:
- Start with government databases (sam.gov, usaspending.gov) in discovery
- Use extraction on contract award pages and procurement notices
- Use deep-dive for specific contracts to understand scope and terms
- Use 3+ tools in parallel when exploring different time periods

SELF-EVALUATION - After each tool use, assess:
- Have I found recent contract awards (last 2-3 years)?
- Do I understand typical contract values and durations?
- Have I identified winning vendors and their solutions?
- Is my information from official government sources?

COMPLETION CRITERIA - Stop when you have:
- Found 3-5 recent contracts or RFP awards
- Identified contract values and winning vendors
- Understood procurement cycles (annual, multi-year, etc.)
- Gathered evidence of spending patterns

PREVIOUS SEARCHES (Don't repeat these):
${previousSearches}

EXTRACTED URLS (Already processed):
${extractedUrls}

EXTRACTED CONTRACTS/PROCUREMENTS (Research status):
${extractedContractsFormatted}

${unsearchedContracts ? `CONTRACTS NEEDING RESEARCH:
${unsearchedContracts}` : ''}

IMPORTANT SOURCES TO CHECK:
- sam.gov (Federal contracts)
- usaspending.gov (Federal spending)
- State/local procurement portals
- Company press releases about contract wins

IMPORTANT: 
- Don't repeat similar searches - build on previous results
- Focus on contracts from the last 3 years
- Look for both prime contracts and subcontracts
- If initial searches yield limited results, try government databases directly
- If you have unsearched contracts, prioritize researching them
- If you determine you have sufficient information, simply respond without tool calls`;

  const humanPrompt = `Continue researching procurement patterns for ${company}. ${
    unsearchedContracts 
      ? 'You have extracted contracts that haven\'t been researched yet - consider using deepdive on them.' 
      : 'Remember to check government databases if initial searches don\'t yield results.'
  } Follow the research strategy outlined above.`;

  try {
    // Emit status
    if (config?.writer) {
      config.writer({
        message: `Procurement patterns research: analyzing previous work...`,
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
    const contractCount = updatedResearch.extractedEntities.filter((e: any) => 
      e.type === 'product' || e.type === 'initiative'
    ).length;
    const hasGovSources = updatedResearch.extractedUrls.some((url: string) => 
      url.includes('sam.gov') || url.includes('usaspending.gov')
    );
    const quality = hasGovSources && contractCount >= 3 ? 0.9 : (contractCount > 0 ? 0.6 : 0.3);
    
    return {
      messages: [],
      procurementPatternsResearch: { ...updatedResearch, complete: isComplete },
      parallelIntelligenceState: {
        ...state.parallelIntelligenceState,
        procurementPatterns: {
          status: isComplete ? "complete" : "running",
          quality: quality,
        },
      },
    };
    
  } catch (error) {
    console.error("[Procurement Patterns Agent] Error:", error);
    
    return {
      messages: [],
      errors: [`Procurement patterns agent error: ${error instanceof Error ? error.message : "Unknown error"}`],
      procurementPatternsResearch: { ...research, complete: true },
      parallelIntelligenceState: {
        ...state.parallelIntelligenceState,
        procurementPatterns: {
          status: "error" as const,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
          quality: 0,
        },
      },
    };
  }
}