/**
 * Strategic Initiatives Agent Node
 * 
 * Autonomous agent that researches strategic initiatives and priorities.
 * Uses 3 tools (discovery, extraction, deep-dive) based on its own judgment.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { ProcessingStatus } from "@/state/modules/types.js";
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
 * Strategic Initiatives Agent
 * 
 * This agent autonomously researches strategic initiatives using its judgment
 * to decide when to use discovery, extraction, or deep-dive tools.
 */
export async function strategicInitiativesAgent(
  state: typeof OverallProposalStateAnnotation.State,
  config?: LangGraphRunnableConfig
): Promise<{ 
  messages: AIMessage[]; 
  strategicInitiativesResearch?: any;
  parallelIntelligenceState?: any;
}> {
  const topic = "strategic initiatives and priorities";
  console.log(`[Strategic Initiatives Agent] Starting research iteration`);
  
  const company = state.company;
  const industry = state.industry;
  const research = state.strategicInitiativesResearch || {
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
  console.log(`[Strategic Initiatives Agent] Iteration ${iteration}`);
  
  // Get configuration
  const topicConfig = state.adaptiveResearchConfig?.topics?.find(
    t => t.topic === topic
  );
  const minimumQualityThreshold = topicConfig?.minimumQualityThreshold || 0.5;
  
  // Build dynamic agent prompt
  const systemPrompt = `You are a strategic initiatives researcher for ${company} in the ${industry} sector.

CURRENT STATE:
- Iteration: ${iteration}
- URLs discovered: ${research.extractedUrls.length}
- Entities extracted: ${research.extractedEntities.length}
- Current quality score: ${research.quality.toFixed(2)}
- Minimum quality threshold: ${minimumQualityThreshold}

AVAILABLE TOOLS:
- strategic_initiatives_discovery: Find pages about strategy and initiatives
- strategic_initiatives_extract: Extract initiatives from specific URLs  
- strategic_initiatives_deepdive: Research specific initiatives in detail

YOUR GOAL:
Gather comprehensive intelligence about strategic initiatives until you reach a quality score of ${minimumQualityThreshold} or higher.

DECISION MAKING:
- If you need to find sources → use strategic_initiatives_discovery
- If you have promising URLs → use strategic_initiatives_extract to get structured data
- If you have extracted entities → use strategic_initiatives_deepdive to research them individually
- You decide the best approach based on what you've gathered so far

The system will stop you after ${topicConfig?.maxAttempts || 3} attempts or when quality threshold is met.
Make each search count - quality over quantity.

PREVIOUS SEARCHES:
${research.searchQueries.slice(-3).join('\n') || 'None yet'}

EXTRACTED URLS:
${research.extractedUrls.slice(-3).join('\n') || 'None yet'}

EXTRACTED ENTITIES:
${research.extractedEntities.slice(-5).map((e: any) => `- ${e.name} (${e.type})`).join('\n') || 'None yet'}`;

  const humanPrompt = `Continue researching ${topic} for ${company}. Choose the most appropriate tool based on your current progress.`;
  
  // Check completion conditions BEFORE generating tool calls
  const completionConfig = state.adaptiveResearchConfig?.topics?.find(
    t => t.topic === "strategic initiatives and priorities"
  );
  
  // If we've met completion conditions, return without tool calls
  if (research.quality >= (completionConfig?.minimumQualityThreshold || 0.5) || 
      research.attempts >= (completionConfig?.maxAttempts || 3)) {
    
    console.log(`[Strategic Initiatives Agent] Completion criteria met - Quality: ${research.quality}, Attempts: ${research.attempts}`);
    
    return {
      messages: [new AIMessage({
        content: `Strategic initiatives research complete. Quality score: ${research.quality.toFixed(2)}, Attempts: ${research.attempts}. Moving to synchronization.`,
        name: "strategicInitiativesAgent"
      })],
      strategicInitiativesResearch: { ...research, complete: true },
      parallelIntelligenceState: {
        ...state.parallelIntelligenceState,
        strategicInitiatives: {
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
        message: `Strategic initiatives research: iteration ${iteration}...`,
      });
    }
    
    // Bind tools
    const tools = createTopicTools("strategic_initiatives");
    const modelWithTools = model.bindTools(tools);
    
    // Generate response with tool calls
    const response = await modelWithTools.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt)
    ], config);
    
    // Log tool calls made by the agent
    if (response.tool_calls && response.tool_calls.length > 0) {
      console.log(`[Strategic Agent] Tool calls made:`, 
        response.tool_calls.map((tc: any) => ({ 
          name: tc.name, 
          args: tc.args 
        }))
      );
    } else {
      console.log(`[Strategic Agent] No tool calls made in this iteration`);
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
      strategicInitiatives: {
        status: "running" as const,
        quality,
      },
    };
    
    return {
      messages: [response],
      strategicInitiativesResearch: updatedResearch,
      parallelIntelligenceState: updatedParallelState,
    };
    
  } catch (error) {
    console.error("[Strategic Initiatives Agent] Error:", error);
    
    // Update state with error
    const errorState = {
      ...state.parallelIntelligenceState,
      strategicInitiatives: {
        status: "error" as const,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    };
    
    return {
      messages: [
        new AIMessage({
          content: `Error researching strategic initiatives: ${error instanceof Error ? error.message : "Unknown error"}`,
          name: "strategicInitiativesAgent",
        })
      ],
      parallelIntelligenceState: errorState,
    };
  }
}