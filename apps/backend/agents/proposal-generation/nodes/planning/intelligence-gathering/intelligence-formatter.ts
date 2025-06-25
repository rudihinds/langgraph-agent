/**
 * Intelligence Formatter Node
 * 
 * Takes the raw search results from the messages history and formats them
 * into a human-readable executive briefing.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { ProcessingStatus } from "@/state/modules/types.js";

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
  state: typeof OverallProposalStateAnnotation.State
): Promise<{
  intelligenceGatheringStatus?: ProcessingStatus;
  currentStatus?: string;
  messages?: any[];
  errors?: string[];
}> {
  console.log("[Intelligence Formatter] Starting to format research results");
  
  const company = state.company || "";
  const industry = state.industry || "";
  
  try {
    // Extract research results from message history
    const messages = state.messages || [];
    
    // Find all tool messages (search results)
    const toolMessages = messages.filter(msg => {
      const messageType = 'tool_calls' in msg ? 'ai' : msg.role || msg._getType?.() || 'unknown';
      return messageType === 'tool';
    });
    console.log(`[Intelligence Formatter] Found ${toolMessages.length} search results to process`);
    
    if (toolMessages.length === 0) {
      throw new Error("No research results found to format");
    }
    
    // Compile all search results
    const searchResults = toolMessages.map(msg => {
      try {
        const content = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
        return content;
      } catch {
        return { content: msg.content };
      }
    });
    
    console.log("[Intelligence Formatter] Creating executive briefing");
    
    // Format into human-readable briefing
    const synthesis = await model.invoke([
      { 
        role: "system", 
        content: `You are an intelligence analyst presenting findings to proposal strategists. 
Be clear, concise, and focus on actionable insights that will help win the proposal.
Company: ${company}
Industry: ${industry}` 
      },
      { 
        role: "user", 
        content: `Transform this raw intelligence into a clear, actionable briefing:
${JSON.stringify(searchResults, null, 2)}

Format as:
- Executive Summary (2-3 key strategic insights about ${company})
- Critical Findings (bullets with implications for our proposal)
- Information Gaps (what we couldn't find but need to know)
- Recommended Actions (specific next steps for the proposal team)

Focus on what matters for winning this opportunity.`
      }
    ]);
    
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