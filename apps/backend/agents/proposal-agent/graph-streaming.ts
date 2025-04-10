/**
 * Streaming implementation of the proposal agent graph
 *
 * This file implements the proposal agent using standard LangGraph streaming
 * mechanisms for better compatibility with the LangGraph ecosystem.
 */

import { StateGraph } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { ProposalState, ProposalStateAnnotation } from "./state.js";
import {
  streamingOrchestratorNode,
  streamingResearchNode,
  streamingSolutionSoughtNode,
  streamingConnectionPairsNode,
  streamingSectionGeneratorNode,
  streamingEvaluatorNode,
  streamingHumanFeedbackNode,
  processHumanFeedback,
} from "./nodes-streaming.js";

/**
 * Create a streaming proposal agent with a multi-stage workflow
 * This implementation uses standard LangGraph streaming
 * @returns Compiled graph for the proposal agent
 */
function createStreamingProposalAgent() {
  // Initialize StateGraph with the state annotation
  const graph = new StateGraph(ProposalStateAnnotation)
    .addNode("orchestrator", streamingOrchestratorNode)
    .addNode("research", streamingResearchNode)
    .addNode("solution_sought", streamingSolutionSoughtNode)
    .addNode("connection_pairs", streamingConnectionPairsNode)
    .addNode("section_generator", streamingSectionGeneratorNode)
    .addNode("evaluator", streamingEvaluatorNode)
    .addNode("human_feedback", streamingHumanFeedbackNode)
    .addNode("process_feedback", processHumanFeedback);

  // Define the entry point
  graph.setEntryPoint("orchestrator");

  // Define conditional edges
  graph.addConditionalEdges(
    "orchestrator",
    (state: ProposalState) => {
      const messages = state.messages;
      const lastMessage = messages[messages.length - 1];
      const content = lastMessage.content as string;

      if (content.includes("research") || content.includes("RFP analysis")) {
        return "research";
      } else if (
        content.includes("solution sought") ||
        content.includes("what the funder is looking for")
      ) {
        return "solution_sought";
      } else if (
        content.includes("connection pairs") ||
        content.includes("alignment")
      ) {
        return "connection_pairs";
      } else if (
        content.includes("generate section") ||
        content.includes("write section")
      ) {
        return "section_generator";
      } else if (content.includes("evaluate") || content.includes("review")) {
        return "evaluator";
      } else if (
        content.includes("human feedback") ||
        content.includes("ask user")
      ) {
        return "human_feedback";
      } else {
        return "orchestrator";
      }
    },
    {
      research: "research",
      solution_sought: "solution_sought",
      connection_pairs: "connection_pairs",
      section_generator: "section_generator",
      evaluator: "evaluator",
      human_feedback: "human_feedback",
      orchestrator: "orchestrator",
    }
  );

  // Define edges from each node back to the orchestrator
  graph.addEdge("research", "orchestrator");
  graph.addEdge("solution_sought", "orchestrator");
  graph.addEdge("connection_pairs", "orchestrator");
  graph.addEdge("section_generator", "orchestrator");
  graph.addEdge("evaluator", "orchestrator");

  // Human feedback needs special handling
  graph.addEdge("human_feedback", "process_feedback");
  graph.addEdge("process_feedback", "orchestrator");

  // Compile the graph
  return graph.compile();
}

// Create the agent
export const streamingGraph = createStreamingProposalAgent();

/**
 * Run the streaming proposal agent
 * @param query Initial user query
 * @returns Final state after workflow execution
 */
export async function runStreamingProposalAgent(query: string): Promise<any> {
  // Initialize state with just the initial message
  const initialState = {
    messages: [new HumanMessage(query)],
  };

  // Define config with streaming enabled
  const config: RunnableConfig = {
    recursionLimit: 25,
    configurable: {
      // These values will be used by the streaming nodes
      streaming: true,
      temperature: 0.7,
      maxTokens: 2000,
    },
  };

  // Run the agent
  return await streamingGraph.invoke(initialState, config);
}

// Example usage if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runStreamingProposalAgent(
    "I need help writing a grant proposal for a community garden project."
  )
    .then((result) => {
      console.log("Final messages:", result.messages);
    })
    .catch(console.error);
}
