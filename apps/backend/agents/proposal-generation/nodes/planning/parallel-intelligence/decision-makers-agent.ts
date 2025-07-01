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
import { calculateTopicQuality } from "./utils.js";
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
}> {
  const topic = "key decision makers and leadership";
  console.log(`[Decision Makers Agent] Starting research iteration`);
  
  const company = state.company;
  const industry = state.industry;
  const research = state.decisionMakersResearch || {
    iteration: 0,
    searchQueries: [],
    searchResults: [],
    extractedUrls: [],
    extractedEntities: [],
    quality: 0,
    attempts: 0,
  };
  
  // Increment iteration
  const iteration = research.iteration + 1;
  console.log(`[Decision Makers Agent] Iteration ${iteration}`);
  
  // Get configuration
  const topicConfig = state.adaptiveResearchConfig?.topics?.find(
    t => t.topic === topic
  );
  const minimumQualityThreshold = topicConfig?.minimumQualityThreshold || 0.3;
  
  // Build dynamic agent prompt
  const systemPrompt = `You are a decision makers researcher for ${company} in the ${industry} sector.

CURRENT STATE:
- Iteration: ${iteration}
- URLs discovered: ${research.extractedUrls.length}
- People extracted: ${research.extractedEntities.filter((e: any) => e.type === 'person').length}
- Current quality score: ${research.quality.toFixed(2)}
- Minimum quality threshold: ${minimumQualityThreshold}

AVAILABLE TOOLS:
- decision_makers_discovery: Find pages listing leadership and team members
- decision_makers_extract: Extract people's names and roles from URLs  
- decision_makers_deepdive: Research specific individuals (LinkedIn, etc.)

YOUR GOAL:
Gather comprehensive intelligence about key decision makers and leadership until you reach a quality score of ${minimumQualityThreshold} or higher.

DECISION MAKING:
- If you need to find team/leadership pages → use decision_makers_discovery
- If you have promising URLs (team pages, about us, etc.) → use decision_makers_extract
- If you have extracted names → use decision_makers_deepdive for LinkedIn profiles and backgrounds
- You decide the best approach based on what you've gathered so far

The system will stop you after ${topicConfig?.maxAttempts || 4} attempts or when quality threshold is met.
Make each search count - quality over quantity.

PROGRESSIVE SEARCH STRATEGY:
1. Discovery: Find team/leadership pages on company website
2. Extraction: Extract names and titles from those pages
3. Deep-dive: Search for individuals on LinkedIn and other sources

FOCUS ON:
- C-suite executives (CEO, CTO, CFO, etc.)
- Department heads relevant to the RFP
- Board members and advisors
- Key technical or procurement decision makers

PREVIOUS SEARCHES:
${research.searchQueries.slice(-3).join('\n') || 'None yet'}

EXTRACTED PEOPLE:
${research.extractedEntities
  .filter((e: any) => e.type === 'person')
  .slice(-5)
  .map((e: any) => `- ${e.name}${e.title ? ` (${e.title})` : ''}`)
  .join('\n') || 'None yet'}

UNSEARCHED PEOPLE:
${research.extractedEntities
  .filter((e: any) => e.type === 'person' && !e.searched)
  .slice(0, 3)
  .map((e: any) => `- ${e.name}${e.title ? ` (${e.title})` : ''}`)
  .join('\n') || 'None'}`;

  const humanPrompt = `Continue researching decision makers for ${company}. ${
    research.extractedEntities.filter((e: any) => e.type === 'person' && !e.searched).length > 0
      ? 'You have extracted people who haven\'t been researched yet - consider using deepdive on them.'
      : 'Choose the most appropriate tool based on your current progress.'
  }`;
  
  // Check completion conditions BEFORE generating tool calls
  const completionConfig = state.adaptiveResearchConfig?.topics?.find(
    t => t.topic === "key decision makers and leadership"
  );
  
  // If we've met completion conditions, return without tool calls
  if (research.quality >= (completionConfig?.minimumQualityThreshold || 0.3) || 
      research.attempts >= (completionConfig?.maxAttempts || 4)) {
    
    console.log(`[Decision Makers Agent] Completion criteria met - Quality: ${research.quality}, Attempts: ${research.attempts}`);
    
    return {
      messages: [new AIMessage({
        content: `Decision makers research complete. Quality score: ${research.quality.toFixed(2)}, Attempts: ${research.attempts}. Moving to synchronization.`,
        name: "decisionMakersAgent"
      })],
      decisionMakersResearch: { ...research, complete: true },
      parallelIntelligenceState: {
        ...state.parallelIntelligenceState,
        decisionMakers: {
          status: "complete" as const,
          quality: research.quality,
        },
      },
    };
  }

  try {
    // Emit status
    if (config?.writer) {
      config.writer({
        message: `Decision makers research: iteration ${iteration}...`,
      });
    }
    
    // Bind tools
    const tools = createTopicTools("decision_makers");
    const modelWithTools = model.bindTools(tools);
    
    // Generate response with tool calls
    const response = await modelWithTools.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt)
    ], config);
    
    // Log tool calls made by the agent
    if (response.tool_calls && response.tool_calls.length > 0) {
      console.log(`[Decision Makers Agent] Tool calls made:`, 
        response.tool_calls.map((tc: any) => ({ 
          name: tc.name, 
          args: tc.args 
        }))
      );
    } else {
      console.log(`[Decision Makers Agent] No tool calls made in this iteration`);
    }
    
    // Extract tool results from any ToolMessages in recent messages
    const allMessages = [...(state.messages || []), response];
    const toolResults = extractToolResults(allMessages);
    
    // Merge tool results into research state
    const researchWithToolResults = mergeToolResults(research, toolResults);
    
    // Mark entities as searched if they were processed by deep-dive tools
    const searchedEntityNames = toolResults.insights.map((insight: any) => insight.entity).filter(Boolean);
    if (searchedEntityNames.length > 0) {
      researchWithToolResults.extractedEntities = markEntitiesAsSearched(
        researchWithToolResults.extractedEntities, 
        searchedEntityNames
      );
    }
    
    // Calculate quality based on updated research data
    const quality = calculateTopicQuality(researchWithToolResults);
    
    // Update research state
    const updatedResearch = {
      ...researchWithToolResults,
      iteration,
      attempts: research.attempts + 1,
      quality,
    };
    
    // Update parallel intelligence state
    const updatedParallelState = {
      ...state.parallelIntelligenceState,
      decisionMakers: {
        status: "running" as const,
        quality,
      },
    };
    
    return {
      messages: [response],
      decisionMakersResearch: updatedResearch,
      parallelIntelligenceState: updatedParallelState,
    };
    
  } catch (error) {
    console.error("[Decision Makers Agent] Error:", error);
    
    // Update state with error
    const errorState = {
      ...state.parallelIntelligenceState,
      decisionMakers: {
        status: "error" as const,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    };
    
    return {
      messages: [
        new AIMessage({
          content: `Error researching decision makers: ${error instanceof Error ? error.message : "Unknown error"}`,
          name: "decisionMakersAgent",
        })
      ],
      parallelIntelligenceState: errorState,
    };
  }
}