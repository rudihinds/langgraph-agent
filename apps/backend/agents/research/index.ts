import { StateGraph } from "@langchain/langgraph";
import { SupabaseCheckpointer } from "../../lib/persistence/supabase-checkpointer.js";
import { BaseMessage } from "@langchain/core/messages";
import { ResearchStateAnnotation, ResearchState } from "./state.js";
import {
  documentLoaderNode,
  deepResearchNode,
  solutionSoughtNode,
} from "./nodes.js";
import { pruneMessageHistory } from "../../lib/state/messages.js";
import { Logger } from "@/lib/logger.js";
import { BaseCheckpointSaver } from "@langchain/langgraph";

// Initialize logger
const logger = Logger.getInstance();

/**
 * Creates the research agent graph
 *
 * This function constructs the LangGraph workflow for the research agent,
 * defining the nodes and edges that control the flow of execution
 */
export const createResearchGraph = () => {
  // Create the research state graph using the annotation
  const researchGraph = new StateGraph(ResearchStateAnnotation)
    .addNode("documentLoader", documentLoaderNode)
    .addNode("deepResearch", deepResearchNode)
    .addNode("solutionSought", solutionSoughtNode)

    // Define workflow sequence
    .addEdge("__start__", "documentLoader")
    // Ensure conditional logic signature matches expected RunnableLike<State, BranchPathReturnValue>
    .addConditionalEdges(
      "documentLoader",
      async (state: ResearchState) => {
        // Example: Check if document text exists and is not empty
        if (
          state.rfpDocument?.text &&
          state.rfpDocument.text.trim().length > 0
        ) {
          logger.debug("Document loaded, proceeding to deep research");
          return "deepResearch";
        } else {
          logger.warn("Document loading failed or text is empty, ending graph");
          return "__end__";
        }
      },
      {
        // Optional mapping for conditional edges if needed, check docs
        deepResearch: "deepResearch",
        __end__: "__end__",
      }
    )
    .addConditionalEdges(
      "deepResearch",
      async (state: ResearchState) => {
        if (state.status?.researchComplete) {
          // Check the specific status field
          logger.debug("Deep research complete, proceeding to solution sought");
          return "solutionSought";
        } else {
          logger.warn("Deep research not complete, ending graph");
          return "__end__";
        }
      },
      {
        // Optional mapping
        solutionSought: "solutionSought",
        __end__: "__end__",
      }
    )
    .addEdge("solutionSought", "__end__");

  // Persistence is configured during compilation, no addCheckpointer needed here

  return researchGraph;
};

interface ResearchAgentInput {
  documentId: string;
  threadId?: string; // Optional threadId for resuming
  checkpointer?: BaseCheckpointSaver; // Optional checkpointer instance
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
   * @param input - Contains document ID, optional thread ID, and optional checkpointer
   * @returns The final state of the research agent
   */
  invoke: async (input: ResearchAgentInput): Promise<ResearchState> => {
    let checkpointerToUse: BaseCheckpointSaver;

    // Use provided checkpointer or create SupabaseCheckpointer
    if (input.checkpointer) {
      logger.debug("Using provided checkpointer instance.");
      checkpointerToUse = input.checkpointer;
    } else {
      logger.debug("Creating new SupabaseCheckpointer instance.");
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        logger.error(
          "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable is not set."
        );
        throw new Error("Supabase connection details are missing.");
      }

      checkpointerToUse = new SupabaseCheckpointer({
        supabaseUrl,
        supabaseKey,
        // TODO: Replace hardcoded userIdGetter/proposalIdGetter with actual context passing
        userIdGetter: async () => "research-agent-user",
        proposalIdGetter: async () => input.documentId,
      });
    }

    try {
      const graph = createResearchGraph();

      // Compile the graph with the checkpointer instance
      const compiledGraph = graph.compile({
        checkpointer: checkpointerToUse, // Use the determined checkpointer
      });

      // Initial state setup
      const initialState: Partial<ResearchState> = {
        rfpDocument: {
          id: input.documentId,
          text: "", // Text will be populated by documentLoaderNode
          metadata: {},
        },
        status: {
          // Ensure initial status is set
          documentLoaded: false,
          researchComplete: false,
          solutionAnalysisComplete: false,
        },
        messages: [], // Initialize messages array
        errors: [], // Initialize errors array
      };

      // Configure the invocation with thread_id for persistence/resumption
      const config = input.threadId
        ? {
            configurable: {
              thread_id: input.threadId,
            },
          }
        : {}; // For a new thread, LangGraph assigns one if checkpointer is present

      logger.info(`Invoking research agent`, {
        documentId: input.documentId,
        threadId: input.threadId ?? "New Thread",
      });

      // Invoke the graph with initial state and config
      const finalState = await compiledGraph.invoke(
        initialState as ResearchState,
        config
      );

      logger.info("Research agent invocation complete", {
        threadId: config.configurable?.thread_id,
      });
      return finalState;
    } catch (error) {
      logger.error(`Error in research agent invocation`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        documentId: input.documentId,
        threadId: input.threadId,
      });
      throw error;
    }
  },
};

// Create message history pruning utility for the research agent
// This might be integrated directly into the state definition or checkpointer serde
// export const pruneResearchMessages = (messages: BaseMessage[]) => {
//   return pruneMessageHistory(messages, {
//     maxTokens: 6000,
//     keepSystemMessages: true,
//   });
// };

// Export public API
// Type exports;
