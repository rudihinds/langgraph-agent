/**
 * Research Agent Node
 * 
 * Intelligence gathering agent that uses the ReAct pattern to dynamically
 * research company information. The agent receives research goals and
 * autonomously decides what searches to perform using the intelligence_search tool.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { SystemMessage, HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { ProcessingStatus } from "@/state/modules/types.js";
import { getIntelligenceSearchTool } from "@/tools/intelligence-search.js";
import { 
  trimMessagesToTokenLimit, 
  handleTokenLimitError,
  TOKEN_LIMITS,
  compressToolMessages 
} from "@/lib/llm/token-management.js";

// Initialize LLM for research agent
const model = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.3, // Lower temperature for focused research
  maxTokens: 4000,
});

/**
 * Research Agent Node
 * 
 * This agent follows the ReAct pattern:
 * 1. Receives research goals via system prompt
 * 2. Analyzes what information is needed
 * 3. Generates tool calls to search for information
 * 4. Processes results and decides if more searches are needed
 * 5. Continues until comprehensive intelligence is gathered
 */
export async function researchAgent(
  state: typeof OverallProposalStateAnnotation.State
): Promise<{
  messages?: any[];
  currentStatus?: string;
  intelligenceGatheringStatus?: ProcessingStatus;
  errors?: string[];
} | Command> {
  console.log("[Research Agent] Starting intelligence research");
  
  const company = state.company || "";
  const industry = state.industry || "";
  const rfpText = state.rfpDocument?.text || "";
  
  // Validation
  if (!rfpText) {
    return {
      errors: ["No RFP document available for intelligence gathering"],
      intelligenceGatheringStatus: ProcessingStatus.ERROR,
      currentStatus: "Missing RFP document"
    };
  }
  
  // Note: Company/industry validation is handled by the intelligenceGatheringRouter
  // This node assumes we have valid company and industry information
  
  try {
    // Bind the intelligence search tool to the model
    const modelWithTools = model.bindTools([getIntelligenceSearchTool()]);
    
    // Create comprehensive research instructions
    const systemPrompt = `You are an expert intelligence analyst researching ${company} in the ${industry} sector for proposal development.

## Your Mission
Gather comprehensive intelligence about ${company} to support a winning proposal strategy. You have access to web search to find public information.

## Research Goals

### 1. Customer Strategic Context
- Find the company's recent strategic initiatives and priorities (last 18 months)
- Look for annual reports, press releases, executive announcements
- Identify budget allocations, major programs, transformation initiatives
- Understand their pain points and future direction

### 2. Current Vendor Landscape  
- Identify vendors currently providing similar services to what the RFP requests
- Search government contract databases (especially sam.gov for government agencies)
- Find vendor announcements, case studies, incumbent information
- Understand existing relationships and potential competitive advantages

### 3. Procurement Patterns
- Research recent RFPs and contract awards (past 2 years)
- Look for procurement trends, typical contract values, award criteria
- Identify buying patterns and decision-making timelines
- Find information about evaluation processes

### 4. Key Decision Makers
- Research individuals mentioned in the RFP or likely to be involved
- Search for procurement officials, department leadership, program managers
- Find LinkedIn profiles, professional backgrounds, public statements
- Understand their priorities and decision-making style

## Search Strategy
- Use site-specific searches when appropriate (e.g., "site:sam.gov" for contracts)
- Include date ranges for recent information (e.g., "2023..2024")
- Combine search operators for precision
- Search from broad to specific, refining based on findings
- Prefer official sources: government sites, company websites, established news outlets

## Research Process
1. Analyze what you already know from previous searches
2. Identify information gaps that need to be filled
3. Construct strategic search queries to fill those gaps
4. After each search, assess if you have sufficient information for that area
5. Continue researching until you have comprehensive intelligence across all 4 areas

## Completion Criteria
You have completed your research when you have:
- 3-5 strategic initiatives with dates and sources
- 2-3 current vendors with solution areas identified
- 2-3 recent procurement examples with details
- 3-5 key decision makers with roles and backgrounds
- OR when you've made 15-20 targeted searches without finding additional valuable information

Remember: Quality over quantity. Focus on finding accurate, relevant, recent information from credible sources.`;

    const humanPrompt = `Please research ${company} in the ${industry} sector to gather intelligence for our proposal.

RFP Context (first 500 characters):
${rfpText.substring(0, 500)}...

Previous searches completed: ${(state.messages || []).filter(m => m._getType() === "tool").length}

IMPORTANT: You have a maximum of 10 searches. After 7-8 searches, consider if you have enough information to create a comprehensive briefing.

Begin your research by analyzing what information you need and then use the intelligence_search tool to find it. Be thorough but efficient.`;

    // Get existing messages for context
    const existingMessages = state.messages || [];
    
    // Check if we need to compress tool messages
    const toolMessages = existingMessages.filter(msg => msg instanceof ToolMessage);
    const needsCompression = toolMessages.length > 5;
    
    let processedMessages = existingMessages;
    
    if (needsCompression) {
      console.log(`[Research Agent] Compressing ${toolMessages.length} tool messages to save tokens`);
      
      // Get non-tool messages
      const nonToolMessages = existingMessages.filter(msg => !(msg instanceof ToolMessage));
      
      // Compress older tool messages (keep last 2 uncompressed)
      const toolsToCompress = toolMessages.slice(0, -2);
      const recentTools = toolMessages.slice(-2);
      
      if (toolsToCompress.length > 0) {
        const compressedSummary = await compressToolMessages(toolsToCompress, model);
        processedMessages = [...nonToolMessages, compressedSummary, ...recentTools];
      }
    }
    
    // Prepare messages with token limit consideration
    const systemMsg = new SystemMessage(systemPrompt);
    const humanMsg = new HumanMessage(humanPrompt);
    
    // Trim messages to fit within token limit
    const trimmedMessages = trimMessagesToTokenLimit(
      [systemMsg, ...processedMessages, humanMsg],
      {
        maxTokens: TOKEN_LIMITS["claude-3-5-sonnet-20241022"],
        modelName: "claude-3-5-sonnet-20241022",
        preserveSystemMessages: true,
        preserveRecentToolMessages: 3,
        bufferTokens: 10000 // Reserve tokens for response and new tool calls
      }
    );
    
    console.log(`[Research Agent] Using ${trimmedMessages.length} messages (from ${existingMessages.length} total)`);
    
    // Invoke model with error handling
    let response;
    try {
      response = await modelWithTools.invoke(trimmedMessages);
    } catch (error) {
      // If we hit token limit, try with even more aggressive trimming
      if (error instanceof Error && error.message.includes('prompt is too long')) {
        console.log("[Research Agent] Hit token limit, applying aggressive trimming");
        
        const minimalMessages = trimMessagesToTokenLimit(
          [systemMsg, humanMsg],
          {
            maxTokens: 50000, // Much smaller context
            modelName: "claude-3-5-sonnet-20241022",
            preserveSystemMessages: true,
            preserveRecentToolMessages: 1,
            bufferTokens: 5000
          }
        );
        
        // Add a summary of what was found so far
        const summaryMsg = new AIMessage({
          content: `Previous research found ${toolMessages.length} results. Continuing search...`,
          additional_kwargs: { compressed: true }
        });
        
        response = await modelWithTools.invoke([...minimalMessages, summaryMsg]);
      } else {
        throw error;
      }
    }
    
    // Log the response for debugging
    if (response.tool_calls && response.tool_calls.length > 0) {
      console.log(`[Research Agent] Generated ${response.tool_calls.length} search queries`);
      response.tool_calls.forEach((call, index) => {
        console.log(`  ${index + 1}. ${call.name}: ${JSON.stringify(call.args)}`);
      });
    } else {
      console.log("[Research Agent] No tool calls generated - agent may have completed research");
    }
    
    // Always return the response message to update state
    return {
      messages: [response],
      currentStatus: response.tool_calls?.length 
        ? `Researching ${company}: executing ${response.tool_calls.length} searches`
        : `Research phase complete for ${company}`,
      intelligenceGatheringStatus: ProcessingStatus.RUNNING
    };
    
  } catch (error) {
    console.error("[Research Agent] Error during research:", error);
    
    return {
      errors: [error instanceof Error ? error.message : "Unknown error during research"],
      intelligenceGatheringStatus: ProcessingStatus.ERROR,
      currentStatus: "Research failed",
      messages: [new AIMessage({
        content: `Research error: ${error instanceof Error ? error.message : "Unknown error"}`,
        name: "researchAgent"
      })]
    };
  }
}