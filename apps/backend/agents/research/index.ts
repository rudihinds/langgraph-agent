import { StateGraph } from "@langchain/langgraph";
import { ResearchStateAnnotation, ResearchState } from "./state.js";
import {
  documentLoaderNode,
  deepResearchNode,
  solutionSoughtNode,
} from "./nodes.js";
import { SupabaseCheckpointer } from "../../lib/state/supabase.js";
import { pruneMessageHistory } from "../../lib/state/messages.js";
import { Logger } from "../../logger.js";

// Initialize logger
const logger = Logger.getInstance();

/**
 * Creates the research agent graph
 *
 * This function constructs the LangGraph workflow for the research agent,
 * defining the nodes and edges that control the flow of execution
 */
export const createResearchGraph = () => {
  // Create the research state graph
  const researchGraph = new StateGraph<ResearchState>({
    channels: ResearchStateAnnotation,
  })
    .addNode("documentLoader", documentLoaderNode)
    .addNode("deepResearch", deepResearchNode)
    .addNode("solutionSought", solutionSoughtNode)

    // Define workflow sequence
    .addEdge("__start__", "documentLoader")
    .addConditionalEdges("documentLoader", (state: ResearchState) => {
      return state.status.documentLoaded ? "deepResearch" : "__end__";
    })
    .addConditionalEdges("deepResearch", (state: ResearchState) => {
      return state.status.researchComplete ? "solutionSought" : "__end__";
    })
    .addEdge("solutionSought", "__end__");

  // Configure state persistence
  researchGraph.addCheckpointer(
    new SupabaseCheckpointer("research-agent", {
      default: pruneMessageHistory,
    })
  );

  return researchGraph;
};

export interface ResearchAgentInput {
  documentId: string;
}

/**
 * Research agent interface
 *
 * Provides a simplified API for interacting with the research agent
 * from other parts of the application
 */
export const researchAgent = {
  /**
   * Invoke the research agent to analyze an RFP document
   *
   * @param input - Contains document ID and optional thread ID for persistence
   * @returns The final state of the research agent
   */
  invoke: async (input: ResearchAgentInput): Promise<ResearchState> => {
    try {
      // Create the graph
      const graph = createResearchGraph();

      // Initialize SupabaseCheckpointer for persistence
      const checkpointer = new SupabaseCheckpointer<ResearchState>();

      // Compile the graph with the checkpointer for persistence
      const compiledGraph = graph.compile({
        checkpointer,
      });

      // Initial state
      const initialState: Partial<ResearchState> = {
        rfpDocument: {
          id: input.documentId,
          text: "",
          metadata: {},
        },
        status: {
          documentLoaded: false,
          researchComplete: false,
          solutionAnalysisComplete: false,
        },
      };

      // Create config with thread_id if provided
      const config = input.threadId
        ? {
            configurable: {
              thread_id: input.threadId,
            },
          }
        : {};

      // Invoke the graph
      logger.info(`Invoking research agent`, {
        documentId: input.documentId,
        threadId: input.threadId,
      });
      const finalState = await compiledGraph.invoke(initialState, config);

      return finalState;
    } catch (error) {
      logger.error(`Error in research agent`, {
        error: error instanceof Error ? error.message : String(error),
        documentId: input.documentId,
        threadId: input.threadId,
      });

      throw error;
    }
  },
};

// Create message history pruning utility for the research agent
export const pruneResearchMessages = (messages: any[]) => {
  return pruneMessageHistory(messages, {
    maxTokens: 6000,
    keepSystemMessages: true,
  });
};

// Export public API
export { ResearchStateAnnotation };
// Type exports
export type { ResearchState };
