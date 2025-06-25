/**
 * Intelligence Formatter Node
 * 
 * Takes the raw search results from the messages history and formats them
 * into a human-readable executive briefing.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { SystemMessage, HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { ProcessingStatus } from "@/state/modules/types.js";
import { 
  estimateTokens,
  TOKEN_LIMITS,
  handleTokenLimitError 
} from "@/lib/llm/token-management.js";

// Initialize LLM for formatting
const model = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.3,
  maxTokens: 4000,
});

/**
 * Intelligence Formatter Node
 * 
 * Processes all the search results from the research phase and formats
 * them into a clear, actionable executive briefing.
 */
export async function intelligenceFormatter(
  state: typeof OverallProposalStateAnnotation.State,
  config?: any
): Promise<{
  intelligenceGatheringStatus?: ProcessingStatus;
  currentStatus?: string;
  messages?: any[];
  errors?: string[];
}> {
  console.log("[Intelligence Formatter] Starting to format research results");
  
  const company = state.company || "";
  const industry = state.industry || "";
  
  // Emit formatting status
  if (config?.writer) {
    config.writer(JSON.stringify({
      type: "agent_status",
      message: "Compiling intelligence briefing...",
      timestamp: new Date().toISOString()
    }));
  }
  
  try {
    // Extract research results from message history
    const messages = state.messages || [];
    
    // Following LangGraph pattern - filter messages within the node
    // Keep only recent messages to manage context
    const MAX_MESSAGES_TO_PROCESS = 50;
    const recentMessages = messages.slice(-MAX_MESSAGES_TO_PROCESS);
    
    // Find all tool messages (search results)
    const toolMessages = recentMessages.filter(msg => msg instanceof ToolMessage);
    console.log(`[Intelligence Formatter] Found ${toolMessages.length} search results to process`);
    
    if (toolMessages.length === 0) {
      // Don't throw - return state update
      return {
        intelligenceGatheringStatus: ProcessingStatus.ERROR,
        currentStatus: "No research results found to format",
        messages: [new AIMessage({
          content: "No research results were found. Please try searching again.",
          name: "intelligenceFormatter"
        })],
        errors: ["No research results found"]
      };
    }
    
    // Process search results in batches if needed
    const searchResults = [];
    let totalContentSize = 0;
    const maxContentSize = 100000; // Characters, not tokens
    
    for (const msg of toolMessages) {
      try {
        const content = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
        const contentStr = JSON.stringify(content);
        
        // If adding this would exceed our limit, summarize what we have first
        if (totalContentSize + contentStr.length > maxContentSize && searchResults.length > 0) {
          console.log(`[Intelligence Formatter] Batch processing ${searchResults.length} results due to size`);
          break;
        }
        
        searchResults.push(content);
        totalContentSize += contentStr.length;
      } catch {
        searchResults.push({ content: msg.content });
      }
    }
    
    console.log(`[Intelligence Formatter] Processing ${searchResults.length} of ${toolMessages.length} search results`);
    
    // If we have too many results, create a summary of what we're not including
    let additionalContext = "";
    if (searchResults.length < toolMessages.length) {
      additionalContext = `\n\nNote: Processing ${searchResults.length} of ${toolMessages.length} total search results due to size constraints. Focus on the most important findings.`;
    }
    
    // Estimate tokens for our content
    const searchResultsStr = JSON.stringify(searchResults, null, 2);
    const estimatedTokens = estimateTokens(searchResultsStr);
    console.log(`[Intelligence Formatter] Estimated tokens for search results: ${estimatedTokens}`);
    
    // If content is still too large, truncate individual results
    let processedResults = searchResultsStr;
    if (estimatedTokens > 50000) {
      console.log("[Intelligence Formatter] Truncating individual search results");
      const truncatedResults = searchResults.map(result => {
        const str = JSON.stringify(result);
        if (str.length > 5000) {
          // Keep first 5000 chars of each result
          return JSON.parse(str.substring(0, 5000) + '..."}');
        }
        return result;
      });
      processedResults = JSON.stringify(truncatedResults, null, 2);
    }
    
    // Create the formatting prompt
    const systemPrompt = `You are an intelligence analyst presenting findings to proposal strategists. 
Be clear, concise, and focus on actionable insights that will help win the proposal.
Company: ${company}
Industry: ${industry}`;
    
    const userPrompt = `Transform this raw intelligence into a clear, actionable briefing:
${processedResults}${additionalContext}

Format as:
- Executive Summary (2-3 key strategic insights about ${company})
- Critical Findings (bullets with implications for our proposal)
- Information Gaps (what we couldn't find but need to know)
- Recommended Actions (specific next steps for the proposal team)

Focus on what matters for winning this opportunity. Be concise.`;
    
    // Invoke with error handling
    let synthesis;
    try {
      synthesis = await model.invoke([
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]);
    } catch (error) {
      if (error instanceof Error && error.message.includes('prompt is too long')) {
        console.log("[Intelligence Formatter] Token limit hit, using fallback summary");
        
        // Fallback: Create a very basic summary
        const fallbackPrompt = `Based on ${searchResults.length} search results about ${company}, provide a brief intelligence summary in 3-4 paragraphs. Focus on the most critical findings.`;
        
        synthesis = await model.invoke([
          { role: "system", content: "You are a concise intelligence analyst." },
          { role: "user", content: fallbackPrompt }
        ]);
      } else {
        throw error;
      }
    }
    
    // Extract the content
    const briefingContent = typeof synthesis.content === 'string' 
      ? synthesis.content 
      : JSON.stringify(synthesis.content);
    
    // Create the message for the UI
    const briefingMessage = new AIMessage({
      content: briefingContent,
      name: "intelligenceFormatter"
    });
    
    // Return the state update
    return {
      intelligenceGatheringStatus: ProcessingStatus.COMPLETE,
      currentStatus: `Intelligence briefing ready for ${company}`,
      messages: [briefingMessage]
    };
    
  } catch (error) {
    console.error("[Intelligence Formatter] Error formatting intelligence:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown formatting error";
    
    return {
      intelligenceGatheringStatus: ProcessingStatus.ERROR,
      currentStatus: `Intelligence formatting failed: ${errorMessage}`,
      messages: [new AIMessage({
        content: `❌ Failed to format intelligence briefing: ${errorMessage}`,
        name: "intelligenceFormatter"
      })],
      errors: [errorMessage]
    };
  }
}