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
import { extractToolResults, mergeToolResults, markEntitiesAsSearched } from "./tool-result-utils.js";
import { createModel } from "@/lib/llm/model-factory.js";

// Initialize model using factory
const model = createModel();

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
  errors?: string[];
}> {
  const topic = "strategic initiatives and priorities";
  console.log(`[Strategic Initiatives Agent] Starting autonomous research`);
  
  const company = state.company;
  const industry = state.industry;
  const research = state.strategicInitiativesResearch || {
    searchQueries: [],
    searchResults: [],
    extractedUrls: [],
    extractedEntities: [],
  };
  
  // Build autonomous agent prompt
  const systemPrompt = `You are an autonomous strategic initiatives researcher for ${company} in the ${industry} sector.

RESEARCH STRATEGY - Follow this approach:
1. START WIDE: Begin with broad, short queries about strategic initiatives
2. EVALUATE LANDSCAPE: Assess what types of information are available  
3. NARROW DOWN: Progressively focus on specific initiatives and priorities
4. DEEP DIVE: Research individual initiatives in detail once identified

AVAILABLE TOOLS:
- strategic_initiatives_discovery: Find pages about strategy and initiatives (use for broad exploration)
- strategic_initiatives_extract: Extract initiatives from specific URLs (use when you have promising sources)
- strategic_initiatives_deepdive: Research specific initiatives in detail (use for final deep analysis)

TOOL USAGE HEURISTICS:
- Start with discovery for broad landscape understanding
- Use extraction when you find promising URLs 
- Use deep-dive when you have specific initiatives to research
- Use 3+ tools in parallel when beneficial for speed

SELF-EVALUATION - After each tool use, assess:
- Have I found the key strategic initiatives for this company?
- Do I understand their priorities and strategic direction?
- Have I covered both current initiatives and future strategic plans?
- Is my information from high-quality, recent sources?

COMPLETION CRITERIA - Stop when you have:
- Identified 3-5 major strategic initiatives
- Understood the company's strategic priorities and direction
- Found specific details about implementation timelines or goals
- Gathered information from multiple authoritative sources

PREVIOUS WORK:
Queries made: ${research.searchQueries.length}
URLs found: ${research.extractedUrls.length}  
Entities extracted: ${research.extractedEntities.length}
Recent queries: ${research.searchQueries.slice(-3).join(', ') || 'None'}

IMPORTANT: 
- Don't repeat similar searches - build on previous results
- Make each search count - quality over quantity
- If you determine you have sufficient information, simply respond without tool calls
- Use parallel tool calling when exploring multiple sources simultaneously`;

  const humanPrompt = `Research strategic initiatives for ${company}. Use your judgment to determine the best tools and when you have sufficient information. Follow the research strategy outlined above.`;
  

  try {
    // Emit status
    if (config?.writer) {
      config.writer({
        message: `Strategic initiatives research in progress...`,
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
    
    // Check if agent made tool calls - no calls means agent decided it's complete
    const isComplete = !response.tool_calls || response.tool_calls.length === 0;
    
    if (response.tool_calls && response.tool_calls.length > 0) {
      console.log(`[Strategic Agent] Tool calls made:`, 
        response.tool_calls.map((tc: any) => ({ 
          name: tc.name, 
          args: tc.args 
        }))
      );
    } else {
      console.log(`[Strategic Agent] No tool calls - agent has determined research is complete`);
    }
    
    // Process tool results if any were made
    let updatedResearch = research;
    if (response.tool_calls && response.tool_calls.length > 0) {
      const allMessages = [...(state.messages || []), response];
      const toolResults = extractToolResults(allMessages);
      updatedResearch = mergeToolResults(research, toolResults);
      
      // Mark entities as searched if processed
      const searchedEntityNames = toolResults.insights.map((insight: any) => insight.entity).filter(Boolean);
      if (searchedEntityNames.length > 0) {
        updatedResearch.extractedEntities = markEntitiesAsSearched(
          updatedResearch.extractedEntities, 
          searchedEntityNames
        );
      }
    }
    
    // Simple quality heuristic based on results
    const quality = updatedResearch.extractedEntities.length > 0 ? 0.8 : 0.3;
    
    return {
      messages: [], 
      strategicInitiativesResearch: { ...updatedResearch, complete: isComplete },
      parallelIntelligenceState: {
        ...state.parallelIntelligenceState,
        strategicInitiatives: {
          status: isComplete ? "complete" : "running",
          quality: quality,
        },
      },
    };
    
  } catch (error) {
    console.error("[Strategic Initiatives Agent] Error:", error);
    
    // Update state with error
    const errorState = {
      ...state.parallelIntelligenceState,
      strategicInitiatives: {
        status: "error" as const,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        quality: 0,
      },
    };
    
    return {
      messages: [], // No error messages in UI
      errors: [`Strategic initiatives agent error: ${error instanceof Error ? error.message : "Unknown error"}`],
      strategicInitiativesResearch: { ...research, complete: true }, // Mark as complete on error
      parallelIntelligenceState: errorState,
    };
  }
}