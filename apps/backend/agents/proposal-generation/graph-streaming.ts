/**
 * Streaming version of the proposal generation graph
 *
 * This file configures and exports the streaming version of the proposal generation graph.
 * It serves as a wrapper around the regular graph but configured for streaming responses.
 */

import { createProposalGenerationGraph } from "./graph.js";
import {
  OverallProposalState,
  createInitialState,
  LoadingStatus,
} from "../../state/proposal.state.js";
import { Logger } from "../../lib/logger.js";
import { ENV } from "../../lib/config/env.js";
import { GraphRecursionError } from "@langchain/langgraph";

const logger = Logger.getInstance();

/**
 * Run the proposal generation agent with streaming configured
 *
 * @param query The input query or document to process
 * @returns The result of the graph execution
 */
export async function runStreamingProposalAgent(query: string): Promise<any> {
  // Log the start of the streaming proposal agent
  logger.info("Starting streaming proposal agent with query:", query);

  try {
    // Create a thread ID for this run
    const threadId = `thread_${Date.now()}`;

    // Initialize the state with a new thread ID
    const initialState = createInitialState(threadId);

    // Add the query to the initial state
    initialState.rfpDocument = {
      ...initialState.rfpDocument,
      id: query,
      text: query,
      status: LoadingStatus.LOADED,
    };

    // Create the graph with a test user ID
    const graph = await createProposalGenerationGraph(
      ENV.TEST_USER_ID,
      `proposal_${Date.now()}`
    );

    // Invoke the graph with the initial state
    const result = await graph.invoke(initialState);

    // Log successful completion
    logger.info("Streaming proposal agent completed successfully");

    return result;
  } catch (error) {
    // Handle recursion limit errors specifically
    if (error instanceof GraphRecursionError) {
      logger.error("Graph recursion limit reached - agent ran too many iterations", {
        error: error.message,
        recursionLimit: 50,
      });
      throw new Error(
        "The research process exceeded the maximum number of iterations. This usually happens when search quality thresholds cannot be met. Please try with simpler requirements or contact support."
      );
    }
    
    // Log any other errors that occur
    logger.error("Error in streaming proposal agent:", error);
    throw error;
  }
}
