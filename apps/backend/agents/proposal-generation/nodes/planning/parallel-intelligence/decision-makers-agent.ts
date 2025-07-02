// /**
//  * Decision Makers Agent Node
//  * 
//  * Autonomous agent that researches key decision makers and leadership.
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
//  * Decision Makers Agent
//  * 
//  * This agent autonomously researches key decision makers, leadership team,
//  * and organizational structure using progressive search patterns.
//  */
// export async function decisionMakersAgent(
//   state: typeof OverallProposalStateAnnotation.State,
//   config?: LangGraphRunnableConfig
// ): Promise<{ 
//   messages: AIMessage; 
//   decisionMakersResearch?: any;
//   parallelIntelligenceState?: any;
//   errors?: string[];
// }> {
//   const topic = "key decision makers and leadership";
//   const company = state.company;
//   const industry = state.industry;
//   const research = state.decisionMakersResearch || {
//     searchQueries: [],
//     searchResults: [],
//     extractedUrls: [],
//     extractedEntities: [],
//     insights: []
//   };

//   const rfpText = state.rfpDocument.text;
  
//   console.log(`[Decision Makers Agent] Starting autonomous research`);
  
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
    
//   // Format extracted people with detailed status
//   const extractedPeople = research.extractedEntities
//     .filter((e: any) => e.type === 'person')
//     .map((person: any) => {
//       const status = person.searched ? 'RESEARCHED' : 'NEEDS RESEARCH';
//       let info = `- ${person.name}`;
//       if (person.title) info += ` (${person.title})`;
//       info += ` - ${status}`;
//       if (person.department) info += `\n  Department: ${person.department}`;
//       if (person.linkedIn) info += `\n  LinkedIn: ${person.linkedIn}`;
//       if (person.background && person.searched) {
//         info += `\n  Background: ${person.background.slice(0, 100)}...`;
//       }
//       return info;
//     });
    
//   const extractedPeopleFormatted = extractedPeople.length > 0 
//     ? extractedPeople.join('\n') 
//     : 'None yet';
    
//   // Get unsearched people for agent guidance
//   const unsearchedPeople = research.extractedEntities
//     .filter((e: any) => e.type === 'person' && !e.searched)
//     .slice(0, 5)
//     .map((person: any) => `- ${person.name}${person.title ? ` (${person.title})` : ''}`)
//     .join('\n');

//   // Build autonomous agent prompt with processed variables
//   const systemPrompt = `You are an autonomous decision makers researcher for ${company} in the ${industry} sector.

// RESEARCH STRATEGY - Follow this approach:
// 1. DISCOVERY: Find team/leadership pages on company website and official sources
// 2. EXTRACTION: Extract names, titles, and roles from those pages
// 3. DEEP RESEARCH: Research individuals on LinkedIn and professional networks
// 4. VALIDATION: Cross-reference findings across multiple sources

// AVAILABLE TOOLS:
// - decision_makers_discovery: Find pages listing leadership and team members
// - decision_makers_extract: Extract people's names and roles from URLs  
// - decision_makers_deepdive: Research specific individuals (LinkedIn, etc.)

// TOOL USAGE HEURISTICS:
// - Start with discovery to find team/leadership pages
// - Use extraction on promising URLs (about us, team, leadership pages)
// - Use deep-dive for extracted individuals to get LinkedIn profiles and backgrounds
// - Use 3+ tools in parallel when researching multiple people

// QUERY CONSTRUCTION - ALWAYS include the company name:
// - ✅ CORRECT: "${company} leadership team"
// - ✅ CORRECT: "${company} executives"
// - ✅ CORRECT: "${company} CEO CTO management"
// - ❌ WRONG: "leadership team" (too generic)
// - ❌ WRONG: "executives" (will return irrelevant results)

// For discovery searches, always start queries with "${company}" to ensure relevant results.
// For deep-dive searches on individuals, include both the person's name AND "${company}".

// SELF-EVALUATION - After each tool use, assess:
// - Have I found the key decision makers (C-suite, department heads)?
// - Do I have their current titles and roles?
// - Have I researched their backgrounds and experience?
// - Is my information from recent, authoritative sources?

// COMPLETION CRITERIA - Stop when you have:
// - Identified key C-suite executives (CEO, CTO, CFO, etc.)
// - Found department heads relevant to the RFP
// - Researched backgrounds for 5-8 key individuals
// - Gathered LinkedIn profiles or professional backgrounds

// rfp text (use this to understand the company and the industry):
// ${rfpText}

// PREVIOUS SEARCHES (Don't repeat these):
// ${previousSearches}

// EXTRACTED URLS (Already processed):
// ${extractedUrls}

// EXTRACTED PEOPLE (Research status):
// ${extractedPeopleFormatted}

// ${unsearchedPeople ? `PEOPLE NEEDING RESEARCH:
// ${unsearchedPeople}` : ''}

// IMPORTANT: 
// - Don't repeat similar searches - build on previous results
// - Focus on decision makers relevant to procurement and the RFP
// - If you have unsearched people, prioritize researching them
// - If you determine you have sufficient information, simply respond without tool calls
// - Use parallel tool calling when researching multiple people

// CRITICAL: When making tool calls, return ONLY the tool call. Do not include any conversational text like "Certainly!", "I'll help you", "Let me search", etc. Just make the tool calls directly.`;

//   const humanPrompt = `Continue researching key decision makers for ${company}. ${
//     unsearchedPeople 
//       ? 'You have extracted people who haven\'t been researched yet - consider using deepdive on them.' 
//       : 'Use your judgment to determine the best tools and when you have sufficient information.'
//   } Follow the research strategy outlined above.`;

//   try {
//     // Emit status
//     if (config?.writer) {
//       config.writer({
//         type: 'status',
//         message: `Decision makers research: analyzing previous work...`,
//         agentId: 'decision-makers',
//         agentName: 'Decision Makers'
//       });
//     }
    
//     // Bind tools and generate response
//     const tools = createTopicTools("decision_makers");
//     console.log(`[Decision Agent] Binding tools:`, tools.map(t => ({ name: t.name })));
//     const modelWithTools = model.bindTools(tools);
    
//     const response = await modelWithTools.invoke([
//       new SystemMessage(systemPrompt),
//       new HumanMessage(humanPrompt)
//     ], config);
    
//     // Check if agent decided to complete (no tool calls)
//     const isComplete = !response.tool_calls || response.tool_calls.length === 0;
    
//     // Log tool calls made by the agent
//     if (response.tool_calls && response.tool_calls.length > 0) {
//       console.log(`[Decision Makers Agent] Tool calls made:`, 
//         response.tool_calls.map((tc: any) => ({ 
//           name: tc.name, 
//           args: tc.args 
//         }))
//       );
//     } else {
//       console.log(`[Decision Makers Agent] No tool calls - agent determined research is complete`);
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
//     const peopleCount = updatedResearch.extractedEntities.filter((e: any) => e.type === 'person').length;
//     const researchedCount = updatedResearch.extractedEntities.filter((e: any) => e.type === 'person' && e.searched).length;
//     const quality = researchedCount >= 5 ? 0.9 : (peopleCount > 0 ? 0.5 : 0.2);
    
//     return {
//       messages: response, // Rule 14/15: Return single message, not array
//       decisionMakersResearch: { ...updatedResearch, complete: isComplete },
//       parallelIntelligenceState: {
//         ...state.parallelIntelligenceState,
//         decisionMakers: {
//           status: isComplete ? "complete" : "running",
//           quality: quality,
//         },
//       },
//     };
    
//   } catch (error) {
//     console.error("[Decision Makers Agent] Error:", error);
    
//     // Return an error message instead of empty array
//     const errorMessage = new AIMessage({
//       content: `Error in decision makers research: ${error instanceof Error ? error.message : "Unknown error"}`
//     });
    
//     return {
//       messages: errorMessage,
//       errors: [`Decision makers agent error: ${error instanceof Error ? error.message : "Unknown error"}`],
//       decisionMakersResearch: { ...research, complete: true },
//       parallelIntelligenceState: {
//         ...state.parallelIntelligenceState,
//         decisionMakers: {
//           status: "error" as const,
//           errorMessage: error instanceof Error ? error.message : "Unknown error",
//           quality: 0,
//         },
//       },
//     };
//   }
// }

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
 * Decision Makers Agent
 * 
 * This agent autonomously researches key decision makers for proposal strategy.
 */
export async function decisionMakersAgent(
  state: typeof OverallProposalStateAnnotation.State,
  config?: LangGraphRunnableConfig
): Promise<{ 
  messages: AIMessage; 
  decisionMakersResearch?: any;
  parallelIntelligenceState?: any;
  errors?: string[];
}> {
  const company = state.company;
  const industry = state.industry;
  const research = state.decisionMakersResearch || {
    searchQueries: [],
    searchResults: [],
    extractedUrls: [],
    extractedEntities: [],
    insights: []
  };

  const rfpText = state.rfpDocument.text;
  
  console.log(`[Decision Makers Agent] Starting decision maker research for ${company}`);
  
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

  // Strategic decision makers intelligence prompt
  const systemPrompt = `You are a strategic decision makers researcher for proposal development. Your mission is to identify key decision makers and influencers at ${company} in the ${industry} sector who are relevant to vendor selection and procurement decisions.

STRATEGIC RESEARCH GOAL:
Discover ${company}'s decision makers to answer these critical proposal strategy questions:
1. WHO makes procurement and vendor selection decisions? (C-suite, department heads, procurement officers)
2. WHO influences these decisions? (Technical leaders, subject matter experts, key stakeholders)
3. WHAT are their backgrounds? (Experience, expertise, decision-making patterns)
4. HOW do they communicate? (LinkedIn presence, thought leadership, public statements)

SUCCESS DEFINITION - Research complete when you can provide strategic insights for:
- Proposal targeting: Who should we address our proposal to?
- Stakeholder mapping: Who influences the decision-making process?
- Messaging strategy: What resonates with key decision makers?
- Relationship building: Who should we connect with for business development?

RESEARCH STRATEGY - Progressive intelligence gathering:

PHASE 1 - DISCOVERY (Start here)
- Find leadership/team pages on company website
- Search LinkedIn company pages for employees
- Look for organizational charts and department listings
- Find industry directories and executive listings

PHASE 2 - EXTRACTION (When you have sources)
- Extract names, titles, and roles from team pages
- Identify decision makers relevant to the RFP scope
- Capture organizational structure and reporting relationships
- Focus on procurement, technology, and executive leadership

PHASE 3 - RESEARCH (When you have names)
- Deep-dive into key individuals' LinkedIn profiles
- Research backgrounds, experience, and expertise
- Find thought leadership content and public statements
- Understand decision-making patterns and preferences

AVAILABLE TOOLS & DECISION FRAMEWORK:

Use decision_makers_discovery when:
- Starting research (Phase 1)
- You need to find team/leadership pages
- Looking for organizational information
- Searching LinkedIn company pages or industry directories

Use decision_makers_extract when:
- You have promising pages with team listings
- You need structured data from about/team pages
- Processing organizational charts or directory listings
- Extracting names and roles from company sources

Use decision_makers_deepdive when:
- You have specific names to research
- You need LinkedIn profiles and professional backgrounds
- Researching individual decision makers' experience
- Finding thought leadership or public statements

REQUIRED TOOL SEQUENCE:
1. DISCOVERY: Use decision_makers_discovery to find sources
2. EXTRACTION: For EACH promising URL, MUST call decision_makers_extract
3. DEEP-DIVE: For key people, use decision_makers_deepdive

Example workflow:
- decision_makers_discovery with "${company} leadership team" → Get 8 results
- decision_makers_extract with top 2 URLs → Extract people entities
- decision_makers_deepdive for key executives → Research backgrounds

NEVER skip extraction after discovery!

QUERY CONSTRUCTION STRATEGY:

ALWAYS include company name: "${company}"

Phase 1 Queries (Discovery):
✅ "${company} leadership team about us"
✅ "${company} executives management team"
✅ "${company} site:linkedin.com/company employees"
✅ "${company} organizational chart"
✅ "${company} procurement officers"

Phase 2 Queries (Extraction):
✅ Extract from: "${company} team page"
✅ Extract from: "${company} leadership directory"
✅ Extract from: "${company} about us executives"

Phase 3 Queries (Research):
✅ "[Person Name] ${company} linkedin"
✅ "[Person Name] ${company} background experience"
✅ "[Person Name] ${company} thought leadership"

QUALITY ASSESSMENT - After each tool use, evaluate:

SOURCE QUALITY (Prioritize):
🏆 Official company website team/leadership pages - Most authoritative
🥈 LinkedIn company pages and employee listings - Highly reliable
🥉 Industry directories and executive databases - Good supplementary
❌ Generic business directories or outdated listings - Low value

TARGET DECISION MAKERS (Focus on):
- C-Suite Executives (CEO, CTO, CFO, COO)
- Department Heads relevant to RFP scope
- Procurement and Purchasing Officers
- Technical Directors and Subject Matter Experts
- Business Unit Leaders and VPs

EXAMPLES OF HIGH-VALUE INTELLIGENCE:

EXCELLENT FINDING:
"John Smith, Chief Technology Officer at ${company}, 15+ years in digital transformation, LinkedIn shows focus on cloud migration and cybersecurity initiatives. Previously led similar technology modernization at Fortune 500 company."
→ Reveals: Key decision maker, relevant expertise, decision-making context

GOOD FINDING:
"Sarah Johnson, VP of Procurement at ${company}, responsible for vendor selection and contract negotiations. Active on LinkedIn discussing supply chain optimization."
→ Reveals: Procurement authority, vendor selection role, communication style

POOR FINDING:
"Mike Brown works at ${company}."
→ Too generic, no role or decision-making relevance

PROGRESSIVE DECISION LOGIC:

After Discovery Phase → Ask yourself:
"Have I found company team pages and leadership sources?"
- YES: Move to Extraction phase
- NO: Try alternative discovery strategies (LinkedIn company page, industry directories)

After Extraction Phase → Ask yourself:
"Have I identified key decision makers and their roles?"
- YES: Move to Research phase for most relevant individuals
- NO: Extract from additional sources or search for specific departments

After Research Phase → Ask yourself:
"Do I understand the key decision makers' backgrounds and influence?"
- YES: Research complete
- NO: Focus on most critical decision makers for the RFP

COMPLETION CRITERIA - Stop when you have:
- At least 8-10 search queries executed
- At least 3-5 URLs extracted
- At least 5-10 people entities identified
- OR when you see diminishing returns (repeated results)

Stop when you have sufficient intelligence to advise on:
- Key decision makers (5-8 individuals) with names, titles, and roles
- Professional backgrounds and expertise areas
- LinkedIn profiles or professional presence
- Organizational relationships and influence patterns
- Decision-making authority relevant to vendor selection

RFP CONTEXT FOR RELEVANCE:
${rfpText.slice(0, 500)}...

Use this RFP context to understand what types of decision makers are most relevant (technical leaders for IT projects, procurement officers for services, etc.).

CURRENT RESEARCH STATE:

PREVIOUS SEARCHES:
${previousSearches}

PROCESSED SOURCES:
${extractedUrls}

DECISION MAKERS INTELLIGENCE:
${extractedEntities}

RESEARCH DECISION: Based on what you've found above, decide if you need more intelligence or if you have enough decision makers mapped for proposal strategy.

CRITICAL INSTRUCTIONS:
- Build upon previous research - don't repeat similar searches
- Focus on decision makers relevant to the RFP scope and vendor selection
- Prioritize quality over quantity - better to deeply research 5-8 key people
- If you have comprehensive decision maker intelligence, stop researching
- When making tool calls, return ONLY the tool calls - no conversational text`;

  const humanPrompt = `Continue researching decision makers for ${company}. Use your judgment to determine the best tools and research strategy based on your current progress.`;

  try {
    // Add random delay to prevent API overload
    const delay = Math.random() * 2000; // 0-2 seconds
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Emit status
    if (config?.writer) {
      config.writer({
        type: 'status',
        message: `Decision makers research: mapping key stakeholders...`,
        agentId: 'decision-makers',
        agentName: 'Decision Makers'
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
    if (!isComplete) {
      const toolResults = extractToolResults([response]);
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
    
    return {
      messages: response,
      decisionMakersResearch: { ...updatedResearch, complete: isComplete },
      parallelIntelligenceState: {
        ...state.parallelIntelligenceState,
        decisionMakers: {
          status: isComplete ? "complete" : "running",
        },
      },
    };
    
  } catch (error) {
    console.error("[Decision Makers Agent] Error:", error);
    
    // Return an error message
    const errorMessage = new AIMessage({
      content: `Error in decision makers research: ${error instanceof Error ? error.message : "Unknown error"}`
    });
    
    return {
      messages: errorMessage,
      errors: [`Decision makers agent error: ${error instanceof Error ? error.message : "Unknown error"}`],
      decisionMakersResearch: { ...research, complete: true },
      parallelIntelligenceState: {
        ...state.parallelIntelligenceState,
        decisionMakers: {
          status: "error" as const,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      },
    };
  }
}