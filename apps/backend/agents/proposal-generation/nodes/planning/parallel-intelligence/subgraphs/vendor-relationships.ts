/**
 * Vendor Relationships Subgraph
 * 
 * Isolated subgraph for vendor relationships intelligence gathering.
 * Contains its own state management and message handling.
 */

import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { BaseMessage } from "@langchain/core/messages";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { vendorRelationshipsAgent } from "../vendor-relationships-agent.js";
import { createTopicTools } from "@/agents/proposal-generation/tools/parallel-intelligence-tools.js";
import { TopicResearch } from "../types.js";

// Define the subgraph state - isolated from main graph
const VendorSubgraphAnnotation = {
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
  vendorRelationshipsResearch: {
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
interface VendorSubgraphState {
  messages: BaseMessage[];
  company: string;
  industry: string;
  rfpDocument: any;
  vendorRelationshipsResearch: TopicResearch;
  parallelIntelligenceState: any;
}

// Tool result processor to update state after ToolNode execution
async function processToolResults(state: VendorSubgraphState): Promise<Partial<VendorSubgraphState>> {
  console.log("[Vendor Tool Processor] 🔄 Processing tool results from messages");
  console.log(`[Vendor Tool Processor] 📨 Total messages to process: ${state.messages?.length || 0}`);
  
  // Log all messages with their types
  state.messages?.forEach((msg, index) => {
    const msgType = msg.constructor?.name || 'Unknown';
    console.log(`  Message ${index + 1}: ${msgType}`);
    if (msgType === 'ToolMessage') {
      console.log(`    Tool: ${(msg as any).name || 'Unknown'}`);
      console.log(`    Content length: ${(msg as any).content?.length || 0} chars`);
    }
  });
  
  const { extractToolResults, mergeToolResults, markEntitiesAsSearched } = await import("../tool-result-utils.js");
  
  // Extract tool results from all messages (ToolNode will have added ToolMessages)
  const toolResults = extractToolResults(state.messages);
  
  console.log(`[Vendor Tool Processor] 📊 Extracted tool results:`, {
    queries: toolResults.queries?.length || 0,
    searchResults: toolResults.searchResults?.length || 0,
    urls: toolResults.urls?.length || 0,
    entities: toolResults.entities?.length || 0,
    insights: toolResults.insights?.length || 0
  });
  
  // Log sample queries to check quality
  if (toolResults.queries?.length > 0) {
    console.log(`[Vendor Tool Processor] 📝 Sample queries extracted:`);
    toolResults.queries.slice(0, 3).forEach((query, i) => {
      console.log(`  ${i + 1}. "${query}"`);
    });
  }
  
  // Merge with existing research
  const updatedResearch = mergeToolResults(state.vendorRelationshipsResearch, toolResults);
  
  // Mark entities as searched if they were processed by deep-dive tools
  const searchedEntityNames = toolResults.insights
    .map((insight: any) => insight.entity)
    .filter(Boolean);
    
  if (searchedEntityNames.length > 0) {
    updatedResearch.extractedEntities = markEntitiesAsSearched(
      updatedResearch.extractedEntities, 
      searchedEntityNames
    );
    console.log(`[Vendor Tool Processor] ✅ Marked ${searchedEntityNames.length} entities as searched`);
  }
  
  console.log(`[Vendor Tool Processor] 📊 Final updated research:`, {
    queries: updatedResearch.searchQueries?.length || 0,
    results: updatedResearch.searchResults?.length || 0,
    urls: updatedResearch.extractedUrls?.length || 0,
    entities: updatedResearch.extractedEntities?.length || 0,
    insights: updatedResearch.insights?.length || 0
  });
  
  const processorResult = {
    vendorRelationshipsResearch: updatedResearch,
    parallelIntelligenceState: {
      ...state.parallelIntelligenceState,
      vendorRelationships: {
        status: "running",
        lastUpdate: new Date().toISOString()
      }
    }
  };
  
  console.log(`[Vendor Tool Processor] 📤 Returning updated state for next agent iteration`);
  return processorResult;
}

// Router function for the subgraph
function vendorShouldContinue(state: VendorSubgraphState): "tools" | typeof END {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];
  const research = state.vendorRelationshipsResearch;
  
  console.log(`[Vendor Subgraph Router] 🧭 Routing decision - Messages: ${messages.length}, Research queries: ${research?.searchQueries?.length || 0}`);
  
  // Check for completion conditions first
  const hasSubstantialResults = (research?.searchQueries?.length || 0) >= 10 || (research?.extractedUrls?.length || 0) >= 8;
  const hasErrors = (research as any)?.error;
  
  if (hasSubstantialResults) {
    console.log(`[Vendor Subgraph Router] ✅ Substantial results achieved - ending subgraph`);
    console.log(`  - Queries: ${research?.searchQueries?.length || 0}`);
    console.log(`  - URLs: ${research?.extractedUrls?.length || 0}`);
    console.log(`  - Entities: ${research?.extractedEntities?.length || 0}`);
    return END;
  }
  
  if (hasErrors) {
    console.log(`[Vendor Subgraph Router] ❌ Error detected - ending subgraph: ${(research as any).error}`);
    return END;
  }
  
  // Check for tool calls
  if (lastMessage && 
      'tool_calls' in lastMessage && 
      Array.isArray(lastMessage.tool_calls) && 
      lastMessage.tool_calls?.length > 0) {
    console.log(`[Vendor Subgraph Router] 🔧 Tool calls detected (${lastMessage.tool_calls.length}), routing to tools`);
    return "tools";
  }
  
  console.log("[Vendor Subgraph Router] ✅ No tool calls, ending subgraph");
  return END;
}

// Create the subgraph
export const vendorRelationshipsSubgraph = new StateGraph<VendorSubgraphState>({
  channels: VendorSubgraphAnnotation
})
  // Add the agent node
  .addNode("agent", vendorRelationshipsAgent)
  // Add the tool node with vendor-specific tools
  .addNode("tools", new ToolNode(createTopicTools("vendor_relationships")))
  // Add tool result processor
  .addNode("processResults", processToolResults)
  // Set up the flow
  .addEdge(START, "agent")
  .addConditionalEdges("agent", vendorShouldContinue, {
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
export async function vendorRelationshipsSubgraphNode(
  state: any, // Main graph state
  config?: LangGraphRunnableConfig
): Promise<{
  vendorRelationshipsResearch: TopicResearch;
  parallelIntelligenceState: any;
}> {
  console.log("[Vendor Subgraph Node] 🚀 Starting isolated vendor relationships research");
  console.log(`[Vendor Subgraph Node] 📊 Input state - Company: "${state.company}", Industry: "${state.industry}"`);
  console.log(`[Vendor Subgraph Node] 📋 Input state keys:`, Object.keys(state));
  console.log(`[Vendor Subgraph Node] 🔍 Existing research:`, {
    queries: state.vendorRelationshipsResearch?.searchQueries?.length || 0,
    results: state.vendorRelationshipsResearch?.searchResults?.length || 0,
    urls: state.vendorRelationshipsResearch?.extractedUrls?.length || 0,
    entities: state.vendorRelationshipsResearch?.extractedEntities?.length || 0
  });
  
  try {
    // Create subgraph input state with detailed logging
    const subgraphInput = {
      messages: [], // Fresh messages for this subgraph
      company: state.company,
      industry: state.industry,
      rfpDocument: state.rfpDocument,
      vendorRelationshipsResearch: state.vendorRelationshipsResearch || {
        searchQueries: [],
        searchResults: [],
        extractedUrls: [],
        extractedEntities: [],
        insights: [],
        complete: false
      }
    };
    
    console.log(`[Vendor Subgraph Node] 🔄 Invoking subgraph with input:`, {
      company: subgraphInput.company,
      industry: subgraphInput.industry,
      hasRfpDocument: !!subgraphInput.rfpDocument,
      messagesCount: subgraphInput.messages.length
    });
    
    // Invoke the subgraph with clean, isolated state
    const result = await vendorRelationshipsSubgraph.invoke(subgraphInput, config);
    
    console.log("[Vendor Subgraph Node] ✅ Subgraph completed successfully");
    console.log(`[Vendor Subgraph Node] 📊 Final research results:`, {
      queries: result.vendorRelationshipsResearch?.searchQueries?.length || 0,
      results: result.vendorRelationshipsResearch?.searchResults?.length || 0,
      urls: result.vendorRelationshipsResearch?.extractedUrls?.length || 0,
      entities: result.vendorRelationshipsResearch?.extractedEntities?.length || 0,
      insights: result.vendorRelationshipsResearch?.insights?.length || 0,
      complete: result.vendorRelationshipsResearch?.complete || false
    });
    console.log(`[Vendor Subgraph Node] 🔄 Final messages count:`, result.messages?.length || 0);
    
    // Return only the research results, not the internal messages
    return {
      vendorRelationshipsResearch: result.vendorRelationshipsResearch,
      parallelIntelligenceState: result.parallelIntelligenceState
    };
  } catch (error) {
    console.error("[Vendor Subgraph Node] Error:", error);
    
    // Return error state
    return {
      vendorRelationshipsResearch: {
        ...(state.vendorRelationshipsResearch || {}),
        complete: true,
        error: error instanceof Error ? error.message : "Unknown error"
      },
      parallelIntelligenceState: {
        ...state.parallelIntelligenceState,
        vendorRelationships: {
          status: "error" as const,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
          quality: 0
        }
      }
    };
  }
}