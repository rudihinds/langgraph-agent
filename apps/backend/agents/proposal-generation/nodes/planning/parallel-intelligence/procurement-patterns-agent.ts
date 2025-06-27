/**
 * Procurement Patterns Agent Node
 * 
 * Autonomous agent that researches procurement patterns and contract history.
 * Uses 3 tools (discovery, extraction, deep-dive) based on its own judgment.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { createTopicTools } from "@/agents/proposal-generation/tools/parallel-intelligence-tools.js";
import { calculateTopicQuality } from "./utils.js";
import { extractToolResults, mergeToolResults, markEntitiesAsSearched } from "./tool-result-utils.js";

// Initialize model
const model = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.3,
  maxTokens: 4000,
});

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
}> {
  const topic = "procurement patterns and history";
  console.log(`[Procurement Patterns Agent] Starting research iteration`);
  
  const company = state.company;
  const industry = state.industry;
  const research = state.procurementPatternsResearch || {
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
  console.log(`[Procurement Patterns Agent] Iteration ${iteration}`);
  
  // Get configuration
  const topicConfig = state.adaptiveResearchConfig?.topics?.find(
    t => t.topic === topic
  );
  const minimumQualityThreshold = topicConfig?.minimumQualityThreshold || 0.6;
  
  // Build dynamic agent prompt
  const systemPrompt = `You are a procurement patterns researcher for ${company} in the ${industry} sector.

CURRENT STATE:
- Iteration: ${iteration}
- URLs discovered: ${research.extractedUrls.length}
- Entities extracted: ${research.extractedEntities.length}
- Current quality score: ${research.quality.toFixed(2)}
- Minimum quality threshold: ${minimumQualityThreshold}

AVAILABLE TOOLS:
- procurement_patterns_discovery: Find procurement and contract information
- procurement_patterns_extract: Extract contract details from URLs  
- procurement_patterns_deepdive: Research specific contracts or patterns

YOUR GOAL:
Gather comprehensive intelligence about procurement patterns, contract history, and spending patterns until you reach a quality score of ${minimumQualityThreshold} or higher.

DECISION MAKING:
- If you need to find sources → use procurement_patterns_discovery
- If you have promising URLs → use procurement_patterns_extract to get structured data
- If you have extracted entities → use procurement_patterns_deepdive to research them individually
- You decide the best approach based on what you've gathered so far

The system will stop you after ${topicConfig?.maxAttempts || 4} attempts or when quality threshold is met.
Make each search count - quality over quantity.

IMPORTANT SOURCES:
- Government contract databases (sam.gov, usaspending.gov)
- Public procurement records
- RFP history and awards
- Contract values and terms

FALLBACK APPROACH:
${topicConfig?.fallbackApproach || "Check sam.gov and usaspending.gov directly"}

PREVIOUS SEARCHES:
${research.searchQueries.slice(-3).join('\n') || 'None yet'}

EXTRACTED CONTRACTS:
${research.extractedEntities.slice(-5).map((e: any) => `- ${e.name} (${e.type})`).join('\n') || 'None yet'}`;

  const humanPrompt = `Continue researching procurement patterns for ${company}. Choose the most appropriate tool based on your current progress. Remember to check government databases if initial searches don't yield results.`;
  
  // Check completion conditions BEFORE generating tool calls
  const completionConfig = state.adaptiveResearchConfig?.topics?.find(
    t => t.topic === "procurement patterns and history"
  );
  
  // If we've met completion conditions, return without tool calls
  if (research.quality >= (completionConfig?.minimumQualityThreshold || 0.6) || 
      research.attempts >= (completionConfig?.maxAttempts || 4)) {
    
    console.log(`[Procurement Patterns Agent] Completion criteria met - Quality: ${research.quality}, Attempts: ${research.attempts}`);
    
    return {
      messages: [new AIMessage({
        content: `Procurement patterns research complete. Quality score: ${research.quality.toFixed(2)}, Attempts: ${research.attempts}. Moving to synchronization.`,
        name: "procurementPatternsAgent"
      })],
      procurementPatternsResearch: { ...research, complete: true },
      parallelIntelligenceState: {
        ...state.parallelIntelligenceState,
        procurementPatterns: {
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
        message: `Procurement patterns research: iteration ${iteration}...`,
      });
    }
    
    // Bind tools
    const tools = createTopicTools("procurement_patterns");
    const modelWithTools = model.bindTools(tools);
    
    // Generate response with tool calls
    const response = await modelWithTools.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt)
    ], config);
    
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
      procurementPatterns: {
        status: "running" as const,
        quality,
      },
    };
    
    return {
      messages: [response],
      procurementPatternsResearch: updatedResearch,
      parallelIntelligenceState: updatedParallelState,
    };
    
  } catch (error) {
    console.error("[Procurement Patterns Agent] Error:", error);
    
    // Update state with error
    const errorState = {
      ...state.parallelIntelligenceState,
      procurementPatterns: {
        status: "error" as const,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    };
    
    return {
      messages: [
        new AIMessage({
          content: `Error researching procurement patterns: ${error instanceof Error ? error.message : "Unknown error"}`,
          name: "procurementPatternsAgent",
        })
      ],
      parallelIntelligenceState: errorState,
    };
  }
}