// Rewriting graph definition based on AGENT_ARCHITECTURE.md

import {
  StateGraph,
  END,
  START,
  messagesStateReducer,
  StateGraphArgs,
} from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import { BaseCheckpointSaver } from "@langchain/langgraph";
import {
  OverallProposalState as ProposalState,
  SectionType,
  SectionData,
} from "../../state/modules/types.js";
import {
  lastValueReducer,
  lastValueWinsReducerStrict,
  sectionsReducer,
  errorsReducer,
} from "../../state/modules/reducers.js";
import { OverallProposalStateAnnotation as ProposalStateAnnotation } from "../../state/modules/annotations.js";
import {
  researchNode,
  evaluateResearchNode,
  solutionSoughtNode,
  awaitResearchReviewNode,
  handleErrorNode,
  // Import all required nodes
  planSectionsNode,
  generateSectionNode,
  evaluateSectionNode,
  improveSection,
  submitSectionForReviewNode,
  awaitSectionReviewNode,
  awaitSolutionReviewNode,
  awaitUserInputNode,
  completeProposalNode,
  finalizeProposalNode,
  evaluateSolutionNode,
} from "./nodes.js";
import {
  routeAfterResearchEvaluation,
  routeAfterSolutionEvaluation,
  determineNextSection,
  routeAfterSectionEvaluation,
  routeAfterStaleContentChoice,
} from "./conditionals.js";
import { SupabaseCheckpointer } from "../../lib/persistence/supabase-checkpointer.js";
import { LangGraphCheckpointer } from "../../lib/persistence/langgraph-adapter.js";
import { InMemoryCheckpointer } from "../../lib/persistence/memory-checkpointer.js";
import { MemoryLangGraphCheckpointer } from "../../lib/persistence/memory-adapter.js";
import { ChatOpenAI } from "@langchain/openai";
import {
  createCheckpointer,
  generateThreadId,
} from "../../services/checkpointer.service.js";

// Restore FULL explicit channels definition
const proposalGraphStateChannels: StateGraphArgs<ProposalState>["channels"] = {
  // Document handling
  rfpDocument: {
    reducer: lastValueReducer,
    default: () => ({ id: "", status: "not_started" }),
  },
  // Research phase
  researchResults: {
    reducer: lastValueReducer,
    default: () => undefined,
  },
  researchStatus: {
    reducer: lastValueWinsReducerStrict,
    default: () => "queued",
  },
  researchEvaluation: {
    reducer: lastValueReducer,
    default: () => undefined,
  },
  // Solution sought phase
  solutionResults: {
    reducer: lastValueReducer,
    default: () => undefined,
  },
  solutionStatus: {
    reducer: lastValueWinsReducerStrict,
    default: () => "queued",
  },
  solutionEvaluation: {
    reducer: lastValueReducer,
    default: () => undefined,
  },
  // Connection pairs phase
  connections: {
    reducer: lastValueReducer,
    default: () => undefined,
  },
  connectionsStatus: {
    reducer: lastValueWinsReducerStrict,
    default: () => "queued",
  },
  connectionsEvaluation: {
    reducer: lastValueReducer,
    default: () => null,
  },
  // Proposal sections
  sections: {
    reducer: sectionsReducer,
    default: () => new Map<SectionType, SectionData>(),
  },
  requiredSections: {
    reducer: lastValueReducer,
    default: () => [],
  },
  // HITL Interrupt handling
  interruptStatus: {
    reducer: (existing, incoming) => incoming ?? existing,
    default: () => ({
      isInterrupted: false,
      interruptionPoint: null,
      feedback: null,
      processingStatus: null,
    }),
  },
  interruptMetadata: {
    reducer: lastValueReducer,
    default: () => undefined,
  },
  userFeedback: {
    reducer: lastValueReducer,
    default: () => undefined,
  },
  // Workflow tracking
  currentStep: {
    reducer: lastValueReducer,
    default: () => null,
  },
  activeThreadId: {
    reducer: lastValueWinsReducerStrict,
    default: () => "",
  },
  // Communication and errors
  messages: {
    reducer: messagesStateReducer,
    default: () => [] as BaseMessage[],
  },
  errors: {
    reducer: errorsReducer,
    default: () => [],
  },
  // Metadata
  projectName: {
    reducer: lastValueReducer,
    default: () => undefined,
  },
  userId: {
    reducer: lastValueReducer,
    default: () => undefined,
  },
  createdAt: {
    reducer: lastValueWinsReducerStrict,
    default: () => new Date().toISOString(),
  },
  lastUpdatedAt: {
    reducer: lastValueWinsReducerStrict,
    default: () => new Date().toISOString(),
  },
  // Overall status
  status: {
    reducer: lastValueWinsReducerStrict,
    default: () => "queued",
  },
};

/**
 * Creates the Proposal Generation StateGraph based on AGENT_ARCHITECTURE.md
 *
 * @param checkpointer Optional checkpointer to use for state persistence
 * @returns Compiled StateGraph for the proposal agent
 */
export function createProposalGenerationGraph(
  checkpointer?: BaseCheckpointSaver
) {
  console.log("Creating proposal generation graph...");

  // Use the FULL explicit channels definition
  const graph = new StateGraph<ProposalState>({
    channels: proposalGraphStateChannels,
  });

  // 1. Add all nodes
  graph.addNode("research", researchNode);
  graph.addNode("evaluateResearch", evaluateResearchNode);
  graph.addNode("solutionSought", solutionSoughtNode);
  graph.addNode("awaitResearchReview", awaitResearchReviewNode);
  graph.addNode("handleError", handleErrorNode);

  // Additional nodes based on conditionals
  graph.addNode("planSections", planSectionsNode);
  graph.addNode("generateSection", generateSectionNode);
  graph.addNode("evaluateSection", evaluateSectionNode);
  graph.addNode("improveSection", improveSection);
  graph.addNode("submitSectionForReview", submitSectionForReviewNode);
  graph.addNode("awaitSectionReview", awaitSectionReviewNode);
  graph.addNode("awaitSolutionReview", awaitSolutionReviewNode);
  graph.addNode("awaitUserInput", awaitUserInputNode);
  graph.addNode("completeProposal", completeProposalNode);
  graph.addNode("finalizeProposal", finalizeProposalNode);
  graph.addNode("evaluateSolution", evaluateSolutionNode);
  // Create a simple node for determineNextSection (which is a routing function when used as a conditional)
  graph.addNode("determineNextSection", async (state: ProposalState) => {
    console.log("Determining next section to generate...");
    return { currentStep: "next_section_determination" };
  });

  // 2. Define initial flow
  graph.addEdge(START, "research");
  graph.addEdge("research", "evaluateResearch");

  // 3. Add conditional edges
  // Research evaluation routing
  graph.addConditionalEdges("evaluateResearch", routeAfterResearchEvaluation, {
    solutionSought: "solutionSought",
    awaitResearchReview: "awaitResearchReview",
    handleError: "handleError",
  });

  // Solution evaluation routing
  graph.addEdge("solutionSought", "evaluateSolution");
  graph.addConditionalEdges("evaluateSolution", routeAfterSolutionEvaluation, {
    planSections: "planSections",
    awaitSolutionReview: "awaitSolutionReview",
    handleError: "handleError",
  });

  // Section planning routing
  graph.addEdge("planSections", "determineNextSection");
  graph.addConditionalEdges("determineNextSection", determineNextSection, {
    generateSection: "generateSection",
    awaitSectionReview: "awaitSectionReview",
    finalizeProposal: "finalizeProposal",
    handleError: "handleError",
  });

  // Section generation and evaluation routing
  graph.addEdge("generateSection", "evaluateSection");
  graph.addConditionalEdges("evaluateSection", routeAfterSectionEvaluation, {
    improveSection: "improveSection",
    submitSectionForReview: "submitSectionForReview",
    handleError: "handleError",
  });
  graph.addEdge("improveSection", "evaluateSection");

  // Human review routing
  graph.addConditionalEdges("awaitResearchReview", routeAfterResearchReview, {
    solutionSought: "solutionSought",
    research: "research",
    handleError: "handleError",
  });

  graph.addConditionalEdges("awaitSolutionReview", routeAfterSolutionReview, {
    planSections: "planSections",
    solutionSought: "solutionSought",
    handleError: "handleError",
  });

  graph.addConditionalEdges("awaitSectionReview", routeAfterSectionFeedback, {
    determineNextSection: "determineNextSection",
    generateSection: "generateSection",
    handleError: "handleError",
  });

  // Add stale content handling node and edge
  graph.addNode("handleStaleChoice", async (state: ProposalState) => {
    console.log("Handling stale content choice...");
    return { currentStep: "stale_choice" };
  });

  // Stale content handling
  graph.addConditionalEdges("handleStaleChoice", routeAfterStaleChoice, {
    research: "research",
    solutionSought: "solutionSought",
    generateSection: "generateSection",
    handleError: "handleError",
  });

  // Finalization routing
  graph.addConditionalEdges("finalizeProposal", routeFinalizeProposal, {
    determineNextSection: "determineNextSection",
    completeProposal: "completeProposal",
  });

  // Terminal edges
  graph.addEdge("completeProposal", END);
  graph.addEdge("handleError", "awaitUserInput");
  graph.addEdge("awaitUserInput", END);

  // Compile the graph with the provided checkpointer
  return graph.compile({
    checkpointer: checkpointer,
    // Task 2.1 & 2.2: Configure interrupt points after evaluation nodes
    interruptAfter: [
      "evaluateResearch",
      "evaluateSolution",
      "evaluateConnections",
      "evaluateSection",
    ],
  });
}

/**
 * Function to determine if the checkpointer should be used based on environment variables
 * @returns Boolean indicating if the checkpointer should be used
 */
export function shouldUseRealCheckpointer(): boolean {
  return !!(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.SUPABASE_URL !== "https://your-project.supabase.co" &&
    process.env.SUPABASE_SERVICE_ROLE_KEY !== "your-service-role-key"
  );
}

/**
 * Creates a proposal generation graph with a properly configured checkpointer
 * @param userId Optional user ID for multi-tenant isolation
 * @returns Compiled StateGraph for the proposal agent
 */
export function createProposalAgentWithCheckpointer(
  userId?: string
): ReturnType<typeof createProposalGenerationGraph> {
  console.log("Creating proposal agent with checkpointer...");

  // Create the checkpointer with the userId if available, or default to test value
  const checkpointer = createCheckpointer(
    userId || process.env.TEST_USER_ID || "anonymous"
  );

  // Create the graph with the configured checkpointer
  return createProposalGenerationGraph(checkpointer);
}

// Export graph factories
export default {
  createProposalGenerationGraph,
  createProposalAgentWithCheckpointer,
};
