import { StateGraph } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { ResearchStateAnnotation, ResearchState } from "./state";
import { documentLoaderNode, deepResearchNode, solutionSoughtNode } from "./nodes";

/**
 * Creates the research agent graph
 * 
 * This function constructs the LangGraph workflow for the research agent,
 * defining the nodes and edges that control the flow of execution
 */
export const createResearchGraph = () => {
  // Create the research state graph
  const researchGraph = new StateGraph(ResearchStateAnnotation)
    .addNode("documentLoader", documentLoaderNode)
    .addNode("deepResearch", deepResearchNode)
    .addNode("solutionSought", solutionSoughtNode)
    
    // Define workflow sequence
    .addEdge("__start__", "documentLoader")
    .addConditionalEdges(
      "documentLoader",
      (state: ResearchState) => state.status.documentLoaded ? "deepResearch" : "__end__"
    )
    .addConditionalEdges(
      "deepResearch",
      (state: ResearchState) => state.status.researchComplete ? "solutionSought" : "__end__"
    )
    .addEdge("solutionSought", "__end__");

  // Initialize memory saver for persistence
  const checkpointer = new MemorySaver();
  
  // Compile the graph
  const compiledGraph = researchGraph.compile({ checkpointer });
  
  return compiledGraph;
};

/**
 * Research agent interface
 * 
 * Provides a simplified API for interacting with the research agent
 * from other parts of the application
 */
export const researchAgent = {
  /**
   * Invoke the research agent on an RFP document
   * 
   * @param rfpDocumentId - The ID of the RFP document to analyze
   * @param threadId - Optional thread ID for persistence
   * @returns The final state of the research agent
   */
  invoke: async (rfpDocumentId: string, threadId?: string) => {
    const graph = createResearchGraph();
    
    // Initial state with document ID
    const initialState = {
      rfpDocument: {
        id: rfpDocumentId,
        text: "",
        metadata: {}
      }
    };
    
    // Invoke the graph with thread_id for persistence if provided
    const config = threadId ? { configurable: { thread_id: threadId } } : undefined;
    const finalState = await graph.invoke(initialState, config);
    
    return finalState;
  }
};

// Export all components
export * from "./state";
export * from "./nodes";
export * from "./tools";
export * from "./agents";