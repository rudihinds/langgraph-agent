import { StateGraph, END } from "@langchain/langgraph";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
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
import {
  withErrorHandling,
  createNodeErrorHandler,
  createRetryingNode,
} from "../../lib/llm/error-handlers.js";
import {
  ErrorCategory,
  ErrorEvent,
} from "../../lib/llm/error-classification.js";
import { LLMMonitor, MetricType } from "../../lib/llm/monitoring.js";

// Error handling nodes
/**
 * Handle context window errors gracefully by summarizing and continuing
 * @param state Current proposal state
 * @returns Updated state with recovery message
 */
async function handleContextWindowError(
  state: ProposalState
): Promise<Partial<ProposalState>> {
  console.warn("Handling context window error:", state.lastError);

  // Create a user-friendly error message
  return {
    messages: [
      ...state.messages,
      new AIMessage(
        "I notice our conversation is getting quite long. Let me summarize what we've discussed so far and continue from there."
      ),
    ],
    // Reset any section that was in progress
    currentSection: undefined,
  };
}

/**
 * Handle catastrophic errors that cannot be automatically recovered
 * @param state Current proposal state
 * @returns Updated state with error message
 */
async function handleCatastrophicError(
  state: ProposalState
): Promise<Partial<ProposalState>> {
  console.error("Handling catastrophic error:", state.lastError);

  // Create a user-friendly error message based on the error type
  const errorMessage = new AIMessage(
    `I encountered a technical issue while processing your request. ${
      state.lastError
        ? `Error: ${state.lastError.message}`
        : "Please try a different approach or contact support if this persists."
    }`
  );

  return {
    messages: [...state.messages, errorMessage],
  };
}

/**
 * Create a proposal agent with a multi-stage workflow and error handling
 * @returns Compiled graph for the proposal agent
 */
function createProposalAgent() {
  // Initialize the monitor
  const monitor = LLMMonitor.getInstance({
    debug: process.env.NODE_ENV === "development",
    logErrors: true,
    logMetrics: true,
  });

  // Initialize StateGraph with the state annotation
  const graph = new StateGraph(ProposalStateAnnotation)
    .addNode(
      "orchestrator",
      createRetryingNode(orchestratorNode, "orchestrator", { maxRetries: 2 })
    )
    .addNode(
      "research_node",
      createRetryingNode(researchNode, "research_node", { maxRetries: 2 })
    )
    .addNode(
      "solution_sought",
      createRetryingNode(solutionSoughtNode, "solution_sought", {
        maxRetries: 2,
      })
    )
    .addNode(
      "connection_pairs",
      createRetryingNode(connectionPairsNode, "connection_pairs", {
        maxRetries: 2,
      })
    )
    .addNode(
      "section_generator",
      createRetryingNode(sectionGeneratorNode, "section_generator", {
        maxRetries: 3,
      })
    )
    .addNode(
      "evaluator",
      createRetryingNode(evaluatorNode, "evaluator", { maxRetries: 2 })
    )
    .addNode(
      "human_feedback",
      createNodeErrorHandler("human_feedback")(humanFeedbackNode)
    )
    .addNode("handle_context_window_error", handleContextWindowError)
    .addNode("handle_catastrophic_error", handleCatastrophicError);

  // Define the entry point
  graph.setEntryPoint("orchestrator");

  // Define conditional edges for normal flow
  graph.addConditionalEdges(
    "orchestrator",
    (state: ProposalState) => {
      // Check for errors first
      if (state.lastError) {
        if (
          state.lastError.category === ErrorCategory.CONTEXT_WINDOW_ERROR ||
          state.lastError.category === ErrorCategory.CONTEXT_WINDOW_EXCEEDED
        ) {
          return "handle_context_window_error";
        }
        return "handle_catastrophic_error";
      }

      // Normal flow logic
      const messages = state.messages;
      const lastMessage = messages[messages.length - 1];
      const content = lastMessage.content as string;

      if (content.includes("research") || content.includes("RFP analysis")) {
        return "research_node";
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
      research_node: "research_node",
      solution_sought: "solution_sought",
      connection_pairs: "connection_pairs",
      section_generator: "section_generator",
      evaluator: "evaluator",
      human_feedback: "human_feedback",
      orchestrator: "orchestrator",
      handle_context_window_error: "handle_context_window_error",
      handle_catastrophic_error: "handle_catastrophic_error",
    }
  );

  // Add error handling for all other nodes
  const processNodeErrors = (nodeName: string) => {
    graph.addConditionalEdges(
      nodeName,
      (state: ProposalState) => {
        if (state.lastError) {
          if (
            state.lastError.category === ErrorCategory.CONTEXT_WINDOW_ERROR ||
            state.lastError.category === ErrorCategory.CONTEXT_WINDOW_EXCEEDED
          ) {
            return "handle_context_window_error";
          }
          return "handle_catastrophic_error";
        }
        return "orchestrator";
      },
      {
        orchestrator: "orchestrator",
        handle_context_window_error: "handle_context_window_error",
        handle_catastrophic_error: "handle_catastrophic_error",
      }
    );
  };

  // Add error edges for each node
  processNodeErrors("research_node");
  processNodeErrors("solution_sought");
  processNodeErrors("connection_pairs");
  processNodeErrors("section_generator");
  processNodeErrors("evaluator");
  processNodeErrors("human_feedback");

  // Define normal edges
  graph.addEdge("research_node", "orchestrator");
  graph.addEdge("solution_sought", "orchestrator");
  graph.addEdge("connection_pairs", "orchestrator");
  graph.addEdge("section_generator", "orchestrator");
  graph.addEdge("evaluator", "orchestrator");
  graph.addEdge("human_feedback", "orchestrator");

  // Error handlers route back to orchestrator for recovery
  graph.addEdge("handle_context_window_error", "orchestrator");
  graph.addEdge("handle_catastrophic_error", "orchestrator");

  // Compile and return the graph with error handling wrapper
  return withErrorHandling(graph)();
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

  // Get instance of monitor for tracking
  const monitor = LLMMonitor.getInstance();
  const tracker = monitor.trackOperation(
    "runProposalAgent",
    "proposal-workflow"
  );

  try {
    // Run the agent
    const result = await graph.invoke(initialState, config);

    // Track successful completion
    tracker(undefined);

    return result;
  } catch (error) {
    // Track error
    tracker(
      undefined,
      error instanceof Error ? error : new Error(String(error))
    );

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

      // Log any errors that were handled
      if (result.errors && result.errors.length > 0) {
        console.log("Errors handled:", result.errors);
      }

      // Get error statistics
      const monitor = LLMMonitor.getInstance();
      console.log("Error statistics:", monitor.getErrorStats());
      console.log("Metric statistics:", monitor.getMetricStats());
    })
    .catch(console.error);
}
