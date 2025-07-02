// /**
//  * Strategic Initiatives Agent Node
//  * 
//  * Autonomous agent that researches strategic initiatives and priorities.
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
//  * Strategic Initiatives Agent
//  * 
//  * This agent autonomously researches strategic initiatives using its judgment
//  * to decide when to use discovery, extraction, or deep-dive tools.
//  */
// export async function strategicInitiativesAgent(
//   state: typeof OverallProposalStateAnnotation.State,
//   config?: LangGraphRunnableConfig
// ): Promise<{ 
//   messages: AIMessage; 
//   strategicInitiativesResearch?: any;
//   parallelIntelligenceState?: any;
//   errors?: string[];
// }> {
//   const topic = "strategic initiatives and priorities";
//   const company = state.company;
//   const industry = state.industry;
//   const research = state.strategicInitiativesResearch || {
//     searchQueries: [],
//     searchResults: [],
//     extractedUrls: [],
//     extractedEntities: [],
//     insights: []
//   };
  
//   console.log(`[Strategic Initiatives Agent] Starting autonomous research`);
  
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
    
//   const extractedEntities = research.extractedEntities.length > 0
//     ? research.extractedEntities.map((e: any) => 
//         `- ${e.name} (${e.type}) - ${e.searched ? 'RESEARCHED' : 'NEEDS RESEARCH'}${e.description ? '\n  ' + e.description.slice(0, 100) + '...' : ''}`
//       ).join('\n')
//     : 'None yet';

//   // Build autonomous agent prompt with processed variables
//   const systemPrompt = `You are an autonomous strategic initiatives researcher for ${company} in the ${industry} sector.

// RESEARCH STRATEGY - Follow this approach:
// 1. START WIDE: Begin with broad, short queries about strategic initiatives
// 2. EVALUATE LANDSCAPE: Assess what types of information are available  
// 3. NARROW DOWN: Progressively focus on specific initiatives and priorities
// 4. DEEP DIVE: Research individual initiatives in detail once identified

// AVAILABLE TOOLS:
// - strategic_initiatives_discovery: Find pages about strategy and initiatives (use for broad exploration)
// - strategic_initiatives_extract: Extract initiatives from specific URLs (use when you have promising sources)
// - strategic_initiatives_deepdive: Research specific initiatives in detail (use for final deep analysis)

// TOOL USAGE HEURISTICS:
// - Start with discovery for broad landscape understanding
// - Use extraction when you find promising URLs 
// - Use deep-dive when you have specific initiatives to research
// - Use 3+ tools in parallel when beneficial for speed

// QUERY CONSTRUCTION - ALWAYS include the company name:
// - ✅ CORRECT: "${company} strategic initiatives"
// - ✅ CORRECT: "${company} digital transformation"
// - ✅ CORRECT: "${company} technology roadmap"
// - ❌ WRONG: "strategic initiatives" (too generic)
// - ❌ WRONG: "digital transformation" (will return irrelevant results)

// For discovery searches, always start queries with "${company}" to ensure relevant results.

// SELF-EVALUATION - After each tool use, assess:
// - Have I found the key strategic initiatives for this company?
// - Do I understand their priorities and strategic direction?
// - Have I covered both current initiatives and future strategic plans?
// - Is my information from high-quality, recent sources?

// COMPLETION CRITERIA - Stop when you have:
// - Identified 3-5 major strategic initiatives
// - Understood the company's strategic priorities and direction
// - Found specific details about implementation timelines or goals
// - Gathered information from multiple authoritative sources

// PREVIOUS SEARCHES (Don't repeat these):
// ${previousSearches}

// EXTRACTED URLS (Already processed):
// ${extractedUrls}

// EXTRACTED ENTITIES (Research status):
// ${extractedEntities}

// IMPORTANT: 
// - Don't repeat similar searches - build on previous results
// - Make each search count - quality over quantity
// - If you determine you have sufficient information, simply respond without tool calls
// - Use parallel tool calling when exploring multiple sources simultaneously

// CRITICAL: When making tool calls, return ONLY the tool call. Do not include any conversational text like "Certainly!", "I'll help you", "Let me search", etc. Just make the tool calls directly.`;

//   const humanPrompt = `Continue researching strategic initiatives for ${company}. Use your judgment to determine the best tools and when you have sufficient information. Follow the research strategy outlined above.`;

//   try {
//     // Emit status
//     if (config?.writer) {
//       config.writer({
//         type: 'status',
//         message: `Strategic initiatives research: analyzing previous work...`,
//         agentId: 'strategic-initiatives',
//         agentName: 'Strategic Initiatives'
//       });
//     }
    
//     // Bind tools and generate response
//     const tools = createTopicTools("strategic_initiatives");
//     console.log(`[Strategic Agent] Binding tools:`, tools.map(t => ({ name: t.name })));
//     const modelWithTools = model.bindTools(tools);
    
//     const response = await modelWithTools.invoke([
//       new SystemMessage(systemPrompt),
//       new HumanMessage(humanPrompt)
//     ], config);
    
//     // Check if agent decided to complete (no tool calls)
//     const isComplete = !response.tool_calls || response.tool_calls.length === 0;
    
//     // Log tool calls made by the agent
//     if (response.tool_calls && response.tool_calls.length > 0) {
//       console.log(`[Strategic Agent] Tool calls made:`, 
//         response.tool_calls.map((tc: any) => ({ 
//           name: tc.name, 
//           args: tc.args 
//         }))
//       );
//     } else {
//       console.log(`[Strategic Agent] No tool calls - agent determined research is complete`);
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
//     const quality = updatedResearch.extractedEntities.length > 0 ? 0.8 : 0.3;
    
//     return {
//       messages: response, // Rule 14/15: Return single message, not array
//       strategicInitiativesResearch: { ...updatedResearch, complete: isComplete },
//       parallelIntelligenceState: {
//         ...state.parallelIntelligenceState,
//         strategicInitiatives: {
//           status: isComplete ? "complete" : "running",
//           quality: quality,
//         },
//       },
//     };
    
//   } catch (error) {
//     console.error("[Strategic Initiatives Agent] Error:", error);
    
//     // Return an error message instead of empty array
//     const errorMessage = new AIMessage({
//       content: `Error in strategic initiatives research: ${error instanceof Error ? error.message : "Unknown error"}`
//     });
    
//     return {
//       messages: errorMessage,
//       errors: [`Strategic initiatives agent error: ${error instanceof Error ? error.message : "Unknown error"}`],
//       strategicInitiativesResearch: { ...research, complete: true },
//       parallelIntelligenceState: {
//         ...state.parallelIntelligenceState,
//         strategicInitiatives: {
//           status: "error" as const,
//           errorMessage: error instanceof Error ? error.message : "Unknown error",
//           quality: 0,
//         },
//       },
//     };
//   }
// }

/**
 * Strategic Initiatives Agent Node
 * 
 * Autonomous agent that researches strategic initiatives and priorities.
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
 * Strategic Initiatives Agent
 * 
 * This agent autonomously researches strategic initiatives to inform proposal strategy.
 */
export async function strategicInitiativesAgent(
  state: typeof OverallProposalStateAnnotation.State,
  config?: LangGraphRunnableConfig
): Promise<{ 
  messages: AIMessage; 
  strategicInitiativesResearch?: any;
  parallelIntelligenceState?: any;
  errors?: string[];
}> {
  const company = state.company;
  const industry = state.industry;
  const research = state.strategicInitiativesResearch || {
    searchQueries: [],
    searchResults: [],
    extractedUrls: [],
    extractedEntities: [],
    insights: []
  };
  
  console.log(`[Strategic Initiatives Agent] Starting strategic research for ${company}`);
  
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

  // Strategic initiatives intelligence prompt
  const systemPrompt = `You are a strategic initiatives intelligence researcher for proposal development. Your mission is to understand ${company}'s strategic direction and priorities in the ${industry} sector to inform our proposal positioning.

STRATEGIC RESEARCH GOAL:
Discover ${company}'s strategic initiatives to answer these critical proposal strategy questions:
1. WHAT are their strategic priorities? (Digital transformation, growth areas, operational improvements)
2. WHERE are they investing? (Technology, markets, capabilities, infrastructure)
3. WHEN are they executing? (Timeline, phases, milestones for major initiatives)
4. WHY are they pursuing these initiatives? (Business drivers, challenges, opportunities)

SUCCESS DEFINITION - Research complete when you can provide strategic insights for:
- Solution positioning: How do our services align with their strategic direction?
- Value proposition: What outcomes are they trying to achieve?
- Proposal messaging: What strategic themes should we emphasize?
- Timing strategy: When are they likely to need external support?

RESEARCH STRATEGY - Progressive intelligence gathering:

PHASE 1 - STRATEGIC LANDSCAPE (Start here)
- Search for annual reports, strategic plans, CEO communications
- Identify major initiatives and transformation programs
- Map strategic priorities and investment areas

PHASE 2 - INITIATIVE ANALYSIS (When you have high-level strategy)
- Research specific initiatives and programs
- Analyze implementation timelines and phases
- Identify technology and capability requirements

PHASE 3 - EXECUTION INTELLIGENCE (When you have initiative details)
- Deep-dive into specific programs and their status
- Understand implementation challenges and needs
- Map potential service opportunities

AVAILABLE TOOLS & DECISION FRAMEWORK:

Use strategic_initiatives_discovery when:
- Starting research (Phase 1)
- You need to find strategic plans, annual reports, or CEO communications
- Looking for high-level strategic direction and priorities
- Searching for transformation programs or major initiatives

Use strategic_initiatives_extract when:
- You have promising strategic documents or reports
- You need structured data from strategic communications
- Processing annual reports or strategic plan documents

Use strategic_initiatives_deepdive when:
- You have specific initiatives to investigate in detail
- You need implementation timelines and requirements
- Researching specific programs or transformation efforts

QUERY CONSTRUCTION STRATEGY:

ALWAYS include company name: "${company}"

Phase 1 Queries (Strategic Landscape):
✅ "${company} strategic plan 2024 2025"
✅ "${company} annual report strategic priorities"
✅ "${company} CEO letter strategic direction"
✅ "${company} digital transformation initiatives"

Phase 2 Queries (Initiative Analysis):
✅ "${company} [specific initiative name] implementation"
✅ "${company} technology modernization program"
✅ "${company} strategic investments ${industry}"

Phase 3 Queries (Execution Intelligence):
✅ "[specific program name] ${company} timeline requirements"
✅ "${company} [initiative] implementation challenges"
✅ "${company} strategic partnerships vendors"

QUALITY ASSESSMENT - After each tool use, evaluate:

SOURCE QUALITY (Prioritize):
🏆 Annual reports and SEC filings - Most authoritative
🥈 Official strategic communications and press releases - Highly reliable
🥉 Industry publications and analyst reports - Good context
❌ Generic business directories or outdated content - Low value

REQUIRED TOOL SEQUENCE:
1. DISCOVERY: Use strategic_initiatives_discovery to find sources
2. EXTRACTION: For EACH promising URL, MUST call strategic_initiatives_extract
3. DEEP-DIVE: For key initiatives, use strategic_initiatives_deepdive

Example workflow:
- strategic_initiatives_discovery with "${company} strategic plan" → Get 8 results
- strategic_initiatives_extract with top 2 URLs → Extract initiative entities
- strategic_initiatives_deepdive for key initiatives → Research specific programs

NEVER skip extraction after discovery!

INTELLIGENCE VALUE (Assess each finding):
- Does this reveal strategic priorities or investment areas?
- Can we identify specific initiatives with timelines?
- Does this show technology or capability requirements?
- Are there business drivers or challenges mentioned?

EXAMPLES OF HIGH-VALUE INTELLIGENCE:

EXCELLENT FINDING:
"${company} announced $50M digital transformation initiative for 2024-2026, focusing on cloud migration, data analytics platform, and customer experience modernization. Phase 1 (cloud migration) begins Q2 2024."
→ Reveals: Investment level, specific focus areas, timeline, phased approach

GOOD FINDING:
"${company} CEO stated operational efficiency and customer experience are top strategic priorities, with emphasis on automation and data-driven decision making."
→ Reveals: Strategic priorities, focus areas, strategic themes

POOR FINDING:
"${company} is committed to innovation and growth."
→ Too generic, no actionable intelligence

PROGRESSIVE DECISION LOGIC:

After Strategic Landscape → Ask yourself:
"Have I identified their major strategic priorities and initiatives?"
- YES: Move to Initiative Analysis phase
- NO: Try different sources (annual reports, CEO communications)

After Initiative Analysis → Ask yourself:
"Do I understand specific initiatives and their requirements?"
- YES: Move to Execution Intelligence phase  
- NO: Deep-dive into specific programs or initiatives

After Execution Intelligence → Ask yourself:
"Can I provide strategic positioning guidance for our proposals?"
- YES: Research complete
- NO: Identify specific gaps and target additional research

COMPLETION CRITERIA - Stop when you have:
- At least 8-10 search queries executed
- At least 3-5 URLs extracted
- At least 5-10 initiative entities identified
- OR when you see diminishing returns (repeated results)

Stop when you have sufficient intelligence to advise on:
- Key strategic priorities and investment areas
- Specific initiatives with timelines and requirements
- Business drivers and strategic challenges
- Technology and capability needs
- Strategic positioning opportunities for our services

CURRENT RESEARCH STATE:

PREVIOUS SEARCHES:
${previousSearches}

PROCESSED SOURCES:
${extractedUrls}

STRATEGIC INTELLIGENCE GATHERED:
${extractedEntities}

RESEARCH DECISION: Based on what you've found above, decide if you need more intelligence or if you have enough to inform proposal strategy. Focus on actionable strategic insights.

CRITICAL INSTRUCTIONS:
- Build upon previous research - don't repeat similar searches
- Focus on strategic priorities and initiatives, not general company info
- Prioritize recent strategic communications (last 2-3 years)
- If you have comprehensive strategic intelligence across all phases, stop researching
- When making tool calls, return ONLY the tool calls - no conversational text`;

  const humanPrompt = `Continue researching strategic initiatives for ${company}. Use your judgment to determine the best tools and research strategy based on your current progress.`;

  try {
    // Add random delay to prevent API overload
    const delay = Math.random() * 2000; // 0-2 seconds
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Emit status
    if (config?.writer) {
      config.writer({
        type: 'status',
        message: `Strategic initiatives research: analyzing strategic direction...`,
        agentId: 'strategic-initiatives',
        agentName: 'Strategic Initiatives'
      });
    }
    
    // Bind tools and generate response
    const tools = createTopicTools("strategic_initiatives");
    const modelWithTools = model.bindTools(tools);
    
    const response = await modelWithTools.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt)
    ], config);
    
    // Check if agent decided to complete (no tool calls)
    const isComplete = !response.tool_calls || response.tool_calls.length === 0;
    
    // Log tool calls made by the agent
    if (response.tool_calls && response.tool_calls.length > 0) {
      console.log(`[Strategic Initiatives Agent] Tool calls made:`, 
        response.tool_calls.map((tc: any) => ({ 
          name: tc.name, 
          args: tc.args 
        }))
      );
    } else {
      console.log(`[Strategic Initiatives Agent] No tool calls - agent determined research is complete`);
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
      strategicInitiativesResearch: { ...updatedResearch, complete: isComplete },
      parallelIntelligenceState: {
        ...state.parallelIntelligenceState,
        strategicInitiatives: {
          status: isComplete ? "complete" : "running",
        },
      },
    };
    
  } catch (error) {
    console.error("[Strategic Initiatives Agent] Error:", error);
    
    // Return an error message
    const errorMessage = new AIMessage({
      content: `Error in strategic initiatives research: ${error instanceof Error ? error.message : "Unknown error"}`
    });
    
    return {
      messages: errorMessage,
      errors: [`Strategic initiatives agent error: ${error instanceof Error ? error.message : "Unknown error"}`],
      strategicInitiativesResearch: { ...research, complete: true },
      parallelIntelligenceState: {
        ...state.parallelIntelligenceState,
        strategicInitiatives: {
          status: "error" as const,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      },
    };
  }
}