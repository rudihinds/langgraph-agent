import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import {
  orchestratorNode,
  researchNode,
  solutionSoughtNode,
  connectionPairsNode,
  sectionGeneratorNode,
  evaluatorNode,
  humanFeedbackNode,
} from "./nodes.ts";
import { RunnableConfig } from "@langchain/core/runnables";
import { stateConfig } from "./state";

/**
 * Create a proposal agent with a multi-stage workflow
 * @returns Compiled graph for the proposal agent
 */
function createProposalAgent() {
  // Use MessagesAnnotation for message state with channels configuration
  const graph = new StateGraph({ channels: stateConfig.channels })
    .addNode("orchestrator", orchestratorNode)
    .addNode("research", researchNode)
    .addNode("solution_sought", solutionSoughtNode)
    .addNode("connection_pairs", connectionPairsNode)
    .addNode("section_generator", sectionGeneratorNode)
    .addNode("evaluator", evaluatorNode)
    .addNode("human_feedback", humanFeedbackNode);

  // Define the entry point
  graph.setEntryPoint("orchestrator");

  // Define conditional edges
  graph.addConditionalEdges(
    "orchestrator",
    (state) => {
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

  // Human feedback node needs special handling for interrupts
  graph.addEdge("human_feedback", "orchestrator");

  // Compile the graph
  return graph.compile();
}

// Create the agent
export const graph = createProposalAgent();

/**
 * Example function to run the proposal agent
 * @param query Initial user query
 * @returns Final state after workflow execution
 */
export async function runProposalAgent(query: string) {
  // Initialize with a question
  const initialState = {
    messages: [new HumanMessage(query)],
  };

  // Define config
  const config: RunnableConfig = {
    recursionLimit: 25,
  };

  // Run the agent
  return await graph.invoke(initialState, config);
}

// Example usage if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runProposalAgent(
    "I need help writing a grant proposal for a community garden project."
  )
    .then((result) => {
      console.log("Final messages:", result.messages);
    })
    .catch(console.error);
}
