import { StateGraph } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import {
  orchestratorNode,
  researchNode,
  solutionSoughtNode,
  connectionPairsNode,
  sectionGeneratorNode,
  evaluatorNode,
  humanFeedbackNode,
} from "./nodes.js";
import { RunnableConfig } from "@langchain/core/runnables";
import { ProposalState, ProposalStateAnnotation } from "./state.js";
import { withErrorHandling } from "../../lib/llm/error-handlers.js";

/**
 * Create a proposal agent with a multi-stage workflow
 * @returns Compiled graph for the proposal agent
 */
function createProposalAgent() {
  // Initialize StateGraph with the state annotation
  const graph = new StateGraph(ProposalStateAnnotation)
    .addNode("orchestrator", orchestratorNode)
    .addNode("research_processor", researchNode)
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
    (state: ProposalState) => {
      const messages = state.messages;
      const lastMessage = messages[messages.length - 1];
      const content = lastMessage.content as string;

      if (content.includes("research") || content.includes("RFP analysis")) {
        return "research_processor";
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
      research_processor: "research_processor",
      solution_sought: "solution_sought",
      connection_pairs: "connection_pairs",
      section_generator: "section_generator",
      evaluator: "evaluator",
      human_feedback: "human_feedback",
      orchestrator: "orchestrator",
    }
  );

  // Define edges from each node back to the orchestrator
  graph.addEdge("research_processor", "orchestrator");
  graph.addEdge("solution_sought", "orchestrator");
  graph.addEdge("connection_pairs", "orchestrator");
  graph.addEdge("section_generator", "orchestrator");
  graph.addEdge("evaluator", "orchestrator");

  // Human feedback node needs special handling for interrupts
  graph.addEdge("human_feedback", "orchestrator");

  // Wrap the compile function with error handling
  return withErrorHandling<any, any>(graph, (err) => {
    console.error("Error occurred during graph compilation:", err);
    // Log the error for debugging and future resilience improvements
  })();
}

// Create the agent
export const graph = createProposalAgent();

/**
 * Example function to run the proposal agent
 * @param query Initial user query
 * @returns Final state after workflow execution
 */
export async function runProposalAgent(query: string): Promise<any> {
  // Initialize state with just the initial message
  const initialState = {
    messages: [new HumanMessage(query)],
  };

  // Define config
  const config: RunnableConfig = {
    recursionLimit: 25,
  };

  try {
    // Run the agent with error handling
    return await graph.invoke(initialState, config);
  } catch (error) {
    console.error("Error running proposal agent:", error);
    // Return a graceful failure state
    return {
      messages: [
        ...initialState.messages,
        new HumanMessage(
          "I encountered an error processing your request. Please try again or contact support if the issue persists."
        ),
      ],
      error: error instanceof Error ? error.message : String(error),
    };
  }
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
