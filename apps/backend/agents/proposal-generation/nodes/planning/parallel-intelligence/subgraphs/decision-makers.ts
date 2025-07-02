/**
 * Decision Makers Subgraph
 * 
 * Isolated subgraph for decision makers intelligence gathering.
 * Contains its own state management and message handling.
 */

import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { BaseMessage } from "@langchain/core/messages";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { decisionMakersAgent } from "../decision-makers-agent.js";
import { createTopicTools } from "@/agents/proposal-generation/tools/parallel-intelligence-tools.js";
import { TopicResearch } from "../types.js";

// Define the subgraph state - isolated from main graph
const DecisionSubgraphAnnotation = {
  // Isolated messages for this subgraph's ReAct loop
  messages: {
    reducer: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
    default: () => []
  },
  // Input data from main graph
  company: {
    reducer: (x: string, y: string) => y || x,
    default: () => ""
  },
  industry: {
    reducer: (x: string, y: string) => y || x,
    default: () => ""
  },
  rfpDocument: {
    reducer: (x: any, y: any) => y || x,
    default: () => null
  },
  // Research state for this topic
  decisionMakersResearch: {
    reducer: (x: TopicResearch, y: TopicResearch) => ({ ...x, ...y }),
    default: () => ({
      searchQueries: [],
      searchResults: [],
      extractedUrls: [],
      extractedEntities: [],
      insights: [],
      complete: false
    })
  },
  // Status tracking
  parallelIntelligenceState: {
    reducer: (x: any, y: any) => ({ ...x, ...y }),
    default: () => ({})
  }
};

// Define the state type from the annotation
interface DecisionSubgraphState {
  messages: BaseMessage[];
  company: string;
  industry: string;
  rfpDocument: any;
  decisionMakersResearch: TopicResearch;
  parallelIntelligenceState: any;
}

// Tool result processor to update state after ToolNode execution
async function processToolResults(state: DecisionSubgraphState): Promise<Partial<DecisionSubgraphState>> {
  console.log("[Decision Tool Processor] Processing tool results from messages");
  
  const { extractToolResults, mergeToolResults, markEntitiesAsSearched } = await import("../tool-result-utils.js");
  
  // Extract tool results from all messages (ToolNode will have added ToolMessages)
  const toolResults = extractToolResults(state.messages);
  
  // Merge with existing research
  const updatedResearch = mergeToolResults(state.decisionMakersResearch, toolResults);
  
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
  
  console.log(`[Decision Tool Processor] Updated research:`, {
    queries: updatedResearch.searchQueries?.length || 0,
    results: updatedResearch.searchResults?.length || 0,
    urls: updatedResearch.extractedUrls?.length || 0,
    entities: updatedResearch.extractedEntities?.length || 0,
    insights: updatedResearch.insights?.length || 0
  });
  
  return {
    decisionMakersResearch: updatedResearch,
    parallelIntelligenceState: {
      ...state.parallelIntelligenceState,
      decisionMakers: {
        status: "running",
        lastUpdate: new Date().toISOString()
      }
    }
  };
}

// Router function for the subgraph
function decisionShouldContinue(state: DecisionSubgraphState): "tools" | typeof END {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];
  const research = state.decisionMakersResearch;
  
  console.log(`[Decision Subgraph Router] Routing decision - Messages: ${messages.length}, Research queries: ${research?.searchQueries?.length || 0}`);
  
  // Check for completion conditions first
  const hasSubstantialResults = (research?.searchQueries?.length || 0) >= 8 || 
                               (research?.extractedUrls?.length || 0) >= 5 ||
                               (research?.extractedEntities?.length || 0) >= 5;
  const hasErrors = (research as any)?.error;
  const isComplete = research?.complete;
  
  if (hasSubstantialResults || isComplete) {
    console.log(`[Decision Subgraph Router] Substantial results achieved - ending subgraph`);
    console.log(`  - Queries: ${research?.searchQueries?.length || 0}`);
    console.log(`  - URLs: ${research?.extractedUrls?.length || 0}`);
    console.log(`  - Entities: ${research?.extractedEntities?.length || 0}`);
    return END;
  }
  
  if (hasErrors) {
    console.log(`[Decision Subgraph Router] Error detected - ending subgraph: ${(research as any).error}`);
    return END;
  }
  
  // Check for tool calls
  if (lastMessage && 
      'tool_calls' in lastMessage && 
      Array.isArray(lastMessage.tool_calls) && 
      lastMessage.tool_calls?.length > 0) {
    console.log(`[Decision Subgraph Router] Tool calls detected (${lastMessage.tool_calls.length}), routing to tools`);
    return "tools";
  }
  
  console.log("[Decision Subgraph Router] No tool calls, ending subgraph");
  return END;
}

// Create the subgraph
export const decisionMakersSubgraph = new StateGraph<DecisionSubgraphState>({
  channels: DecisionSubgraphAnnotation
})
  // Add the agent node
  .addNode("agent", decisionMakersAgent)
  // Add the tool node with decision-specific tools
  .addNode("tools", new ToolNode(createTopicTools("decision_makers")))
  // Add tool result processor
  .addNode("processResults", processToolResults)
  // Set up the flow
  .addEdge(START, "agent")
  .addConditionalEdges("agent", decisionShouldContinue, {
    tools: "tools",
    [END]: END
  })
  .addEdge("tools", "processResults")
  .addEdge("processResults", "agent")
  .compile();

/**
 * Wrapper node for the main graph to invoke this subgraph
 * This is what gets called from the main parallel intelligence flow
 */
export async function decisionMakersSubgraphNode(
  state: any, // Main graph state
  config?: LangGraphRunnableConfig
): Promise<{
  decisionMakersResearch: TopicResearch;
  parallelIntelligenceState: any;
}> {
  console.log("[Decision Subgraph Node] Starting isolated decision makers research");
  
  try {
    // Invoke the subgraph with clean, isolated state
    const result = await decisionMakersSubgraph.invoke({
      messages: [], // Fresh messages for this subgraph
      company: state.company,
      industry: state.industry,
      rfpDocument: state.rfpDocument,
      decisionMakersResearch: state.decisionMakersResearch || {
        searchQueries: [],
        searchResults: [],
        extractedUrls: [],
        extractedEntities: [],
        insights: [],
        complete: false
      }
    }, config);
    
    console.log("[Decision Subgraph Node] Subgraph completed, returning research results");
    
    // Return only the research results, not the internal messages
    return {
      decisionMakersResearch: result.decisionMakersResearch,
      parallelIntelligenceState: result.parallelIntelligenceState
    };
  } catch (error) {
    console.error("[Decision Subgraph Node] Error:", error);
    
    // Return error state
    return {
      decisionMakersResearch: {
        ...(state.decisionMakersResearch || {}),
        complete: true,
        error: error instanceof Error ? error.message : "Unknown error"
      },
      parallelIntelligenceState: {
        ...state.parallelIntelligenceState,
        decisionMakers: {
          status: "error" as const,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
          quality: 0
        }
      }
    };
  }
}