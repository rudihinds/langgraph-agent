/**
 * Decision Makers Agent Node
 * 
 * Autonomous agent that researches key decision makers and leadership.
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
 * Decision Makers Agent
 * 
 * This agent autonomously researches key decision makers, leadership team,
 * and organizational structure using progressive search patterns.
 */
export async function decisionMakersAgent(
  state: typeof OverallProposalStateAnnotation.State,
  config?: LangGraphRunnableConfig
): Promise<{ 
  messages: AIMessage[]; 
  decisionMakersResearch?: any;
  parallelIntelligenceState?: any;
  errors?: string[];
}> {
  const topic = "key decision makers and leadership";
  const company = state.company;
  const industry = state.industry;
  const research = state.decisionMakersResearch || {
    searchQueries: [],
    searchResults: [],
    extractedUrls: [],
    extractedEntities: [],
    insights: []
  };
  
  console.log(`[Decision Makers Agent] Starting autonomous research`);
  
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
    
  // Format extracted people with detailed status
  const extractedPeople = research.extractedEntities
    .filter((e: any) => e.type === 'person')
    .map((person: any) => {
      const status = person.searched ? 'RESEARCHED' : 'NEEDS RESEARCH';
      let info = `- ${person.name}`;
      if (person.title) info += ` (${person.title})`;
      info += ` - ${status}`;
      if (person.department) info += `\n  Department: ${person.department}`;
      if (person.linkedIn) info += `\n  LinkedIn: ${person.linkedIn}`;
      if (person.background && person.searched) {
        info += `\n  Background: ${person.background.slice(0, 100)}...`;
      }
      return info;
    });
    
  const extractedPeopleFormatted = extractedPeople.length > 0 
    ? extractedPeople.join('\n') 
    : 'None yet';
    
  // Get unsearched people for agent guidance
  const unsearchedPeople = research.extractedEntities
    .filter((e: any) => e.type === 'person' && !e.searched)
    .slice(0, 5)
    .map((person: any) => `- ${person.name}${person.title ? ` (${person.title})` : ''}`)
    .join('\n');

  // Build autonomous agent prompt with processed variables
  const systemPrompt = `You are an autonomous decision makers researcher for ${company} in the ${industry} sector.

RESEARCH STRATEGY - Follow this approach:
1. DISCOVERY: Find team/leadership pages on company website and official sources
2. EXTRACTION: Extract names, titles, and roles from those pages
3. DEEP RESEARCH: Research individuals on LinkedIn and professional networks
4. VALIDATION: Cross-reference findings across multiple sources

AVAILABLE TOOLS:
- decision_makers_discovery: Find pages listing leadership and team members
- decision_makers_extract: Extract people's names and roles from URLs  
- decision_makers_deepdive: Research specific individuals (LinkedIn, etc.)

TOOL USAGE HEURISTICS:
- Start with discovery to find team/leadership pages
- Use extraction on promising URLs (about us, team, leadership pages)
- Use deep-dive for extracted individuals to get LinkedIn profiles and backgrounds
- Use 3+ tools in parallel when researching multiple people

SELF-EVALUATION - After each tool use, assess:
- Have I found the key decision makers (C-suite, department heads)?
- Do I have their current titles and roles?
- Have I researched their backgrounds and experience?
- Is my information from recent, authoritative sources?

COMPLETION CRITERIA - Stop when you have:
- Identified key C-suite executives (CEO, CTO, CFO, etc.)
- Found department heads relevant to the RFP
- Researched backgrounds for 5-8 key individuals
- Gathered LinkedIn profiles or professional backgrounds

PREVIOUS SEARCHES (Don't repeat these):
${previousSearches}

EXTRACTED URLS (Already processed):
${extractedUrls}

EXTRACTED PEOPLE (Research status):
${extractedPeopleFormatted}

${unsearchedPeople ? `PEOPLE NEEDING RESEARCH:
${unsearchedPeople}` : ''}

IMPORTANT: 
- Don't repeat similar searches - build on previous results
- Focus on decision makers relevant to procurement and the RFP
- If you have unsearched people, prioritize researching them
- If you determine you have sufficient information, simply respond without tool calls
- Use parallel tool calling when researching multiple people`;

  const humanPrompt = `Continue researching key decision makers for ${company}. ${
    unsearchedPeople 
      ? 'You have extracted people who haven\'t been researched yet - consider using deepdive on them.' 
      : 'Use your judgment to determine the best tools and when you have sufficient information.'
  } Follow the research strategy outlined above.`;

  try {
    // Emit status
    if (config?.writer) {
      config.writer({
        message: `Decision makers research: analyzing previous work...`,
      });
    }
    
    // Bind tools and generate response
    const tools = createTopicTools("decision_makers");
    const modelWithTools = model.bindTools(tools);
    
    const response = await modelWithTools.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt)
    ], config);
    
    // Check if agent decided to complete (no tool calls)
    const isComplete = !response.tool_calls || response.tool_calls.length === 0;
    
    // Log tool calls made by the agent
    if (response.tool_calls && response.tool_calls.length > 0) {
      console.log(`[Decision Makers Agent] Tool calls made:`, 
        response.tool_calls.map((tc: any) => ({ 
          name: tc.name, 
          args: tc.args 
        }))
      );
    } else {
      console.log(`[Decision Makers Agent] No tool calls - agent determined research is complete`);
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
    const peopleCount = updatedResearch.extractedEntities.filter((e: any) => e.type === 'person').length;
    const researchedCount = updatedResearch.extractedEntities.filter((e: any) => e.type === 'person' && e.searched).length;
    const quality = researchedCount >= 5 ? 0.9 : (peopleCount > 0 ? 0.5 : 0.2);
    
    return {
      messages: [],
      decisionMakersResearch: { ...updatedResearch, complete: isComplete },
      parallelIntelligenceState: {
        ...state.parallelIntelligenceState,
        decisionMakers: {
          status: isComplete ? "complete" : "running",
          quality: quality,
        },
      },
    };
    
  } catch (error) {
    console.error("[Decision Makers Agent] Error:", error);
    
    return {
      messages: [],
      errors: [`Decision makers agent error: ${error instanceof Error ? error.message : "Unknown error"}`],
      decisionMakersResearch: { ...research, complete: true },
      parallelIntelligenceState: {
        ...state.parallelIntelligenceState,
        decisionMakers: {
          status: "error" as const,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
          quality: 0,
        },
      },
    };
  }
}