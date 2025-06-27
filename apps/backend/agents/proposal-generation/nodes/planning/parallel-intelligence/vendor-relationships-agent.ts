/**
 * Vendor Relationships Agent Node
 * 
 * Autonomous agent that researches current vendor relationships and partnerships.
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
}> {
  const topic = "current vendor relationships";
  console.log(`[Vendor Relationships Agent] Starting research iteration`);
  
  const company = state.company;
  const industry = state.industry;
  const research = state.vendorRelationshipsResearch || {
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
  console.log(`[Vendor Relationships Agent] Iteration ${iteration}`);
  
  // Get configuration
  const topicConfig = state.adaptiveResearchConfig?.topics?.find(
    t => t.topic === topic
  );
  const minimumQualityThreshold = topicConfig?.minimumQualityThreshold || 0.4;
  
  // Build dynamic agent prompt
  const systemPrompt = `You are a vendor relationships researcher for ${company} in the ${industry} sector.

CURRENT STATE:
- Iteration: ${iteration}
- URLs discovered: ${research.extractedUrls.length}
- Entities extracted: ${research.extractedEntities.length}
- Current quality score: ${research.quality.toFixed(2)}
- Minimum quality threshold: ${minimumQualityThreshold}

AVAILABLE TOOLS:
- vendor_relationships_discovery: Find pages about partners and vendors
- vendor_relationships_extract: Extract vendor/partner information from URLs  
- vendor_relationships_deepdive: Research specific vendors or partnerships

YOUR GOAL:
Gather comprehensive intelligence about vendor relationships, technology partners, and integrations until you reach a quality score of ${minimumQualityThreshold} or higher.

DECISION MAKING:
- If you need to find sources → use vendor_relationships_discovery
- If you have promising URLs → use vendor_relationships_extract to get structured data
- If you have extracted entities → use vendor_relationships_deepdive to research them individually
- You decide the best approach based on what you've gathered so far

The system will stop you after ${topicConfig?.maxAttempts || 3} attempts or when quality threshold is met.
Make each search count - quality over quantity.

FOCUS AREAS:
- Technology partners and integrations
- Solution providers and vendors
- Strategic partnerships
- Ecosystem relationships

PREVIOUS SEARCHES:
${research.searchQueries.slice(-3).join('\n') || 'None yet'}

EXTRACTED VENDORS:
${research.extractedEntities.slice(-5).map((e: any) => `- ${e.name} (${e.type})`).join('\n') || 'None yet'}`;

  const humanPrompt = `Continue researching vendor relationships for ${company}. Choose the most appropriate tool based on your current progress.`;
  
  // Check completion conditions BEFORE generating tool calls
  const completionConfig = state.adaptiveResearchConfig?.topics?.find(
    t => t.topic === "current vendor relationships"
  );
  
  // If we've met completion conditions, return without tool calls
  if (research.quality >= (completionConfig?.minimumQualityThreshold || 0.4) || 
      research.attempts >= (completionConfig?.maxAttempts || 3)) {
    
    console.log(`[Vendor Relationships Agent] Completion criteria met - Quality: ${research.quality}, Attempts: ${research.attempts}`);
    
    return {
      messages: [new AIMessage({
        content: `Vendor relationships research complete. Quality score: ${research.quality.toFixed(2)}, Attempts: ${research.attempts}. Moving to synchronization.`,
        name: "vendorRelationshipsAgent"
      })],
      vendorRelationshipsResearch: { ...research, complete: true },
      parallelIntelligenceState: {
        ...state.parallelIntelligenceState,
        vendorRelationships: {
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
        message: `Vendor relationships research: iteration ${iteration}...`,
      });
    }
    
    // Bind tools
    const tools = createTopicTools("vendor_relationships");
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
      vendorRelationships: {
        status: "running" as const,
        quality,
      },
    };
    
    return {
      messages: [response],
      vendorRelationshipsResearch: updatedResearch,
      parallelIntelligenceState: updatedParallelState,
    };
    
  } catch (error) {
    console.error("[Vendor Relationships Agent] Error:", error);
    
    // Update state with error
    const errorState = {
      ...state.parallelIntelligenceState,
      vendorRelationships: {
        status: "error" as const,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    };
    
    return {
      messages: [
        new AIMessage({
          content: `Error researching vendor relationships: ${error instanceof Error ? error.message : "Unknown error"}`,
          name: "vendorRelationshipsAgent",
        })
      ],
      parallelIntelligenceState: errorState,
    };
  }
}