/**
 * ProposalGenerationGraph Implementation
 * 
 * This module defines the main state graph for proposal generation according to
 * the architecture specifications in AGENT_ARCHITECTURE.md and AGENT_BASESPEC.md.
 */
import { StateGraph } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { ProposalState, ProposalStateAnnotation } from "../../state/proposal.state.js";

// Import node functions
import {
  documentLoaderNode,
  deepResearchNode,
  evaluateResearchNode,
  solutionSoughtNode,
  evaluateSolutionNode,
  connectionPairsNode,
  evaluateConnectionsNode,
  sectionManagerNode,
  // Section generator nodes will be dynamically determined by the sectionManager
  generateProblemStatementNode,
  generateMethodologyNode,
  generateBudgetNode,
  generateTimelineNode,
  generateConclusionNode,
  // Evaluator nodes for each section
  evaluateProblemStatementNode,
  evaluateMethodologyNode,
  evaluateBudgetNode,
  evaluateTimelineNode,
  evaluateConclusionNode,
} from "./nodes.js";

// Import conditional routing functions
import {
  determineNextStep,
  routeAfterResearchEvaluation,
  routeAfterSolutionEvaluation,
  routeAfterConnectionsEvaluation,
  routeSectionGeneration,
  routeAfterSectionEvaluation,
} from "./conditionals.js";

/**
 * Create and configure the proposal generation graph
 * @returns The compiled proposal generation graph
 */
export function createProposalGenerationGraph() {
  // Initialize the state graph with our state annotation
  const graph = new StateGraph(ProposalStateAnnotation);

  // Add all nodes to the graph
  graph.addNode("documentLoader", documentLoaderNode);
  graph.addNode("deepResearch", deepResearchNode);
  graph.addNode("evaluateResearch", evaluateResearchNode);
  graph.addNode("solutionSought", solutionSoughtNode);
  graph.addNode("evaluateSolution", evaluateSolutionNode);
  graph.addNode("connectionPairs", connectionPairsNode);
  graph.addNode("evaluateConnections", evaluateConnectionsNode);
  graph.addNode("sectionManager", sectionManagerNode);
  
  // Section generator nodes
  graph.addNode("generateProblemStatement", generateProblemStatementNode);
  graph.addNode("generateMethodology", generateMethodologyNode);
  graph.addNode("generateBudget", generateBudgetNode);
  graph.addNode("generateTimeline", generateTimelineNode);
  graph.addNode("generateConclusion", generateConclusionNode);
  
  // Section evaluator nodes
  graph.addNode("evaluateProblemStatement", evaluateProblemStatementNode);
  graph.addNode("evaluateMethodology", evaluateMethodologyNode);
  graph.addNode("evaluateBudget", evaluateBudgetNode);
  graph.addNode("evaluateTimeline", evaluateTimelineNode);
  graph.addNode("evaluateConclusion", evaluateConclusionNode);

  // Set the entry point
  graph.setEntryPoint("documentLoader");

  // Define the main workflow edges
  // Document loading -> Research
  graph.addEdge("documentLoader", "deepResearch");
  graph.addEdge("deepResearch", "evaluateResearch");
  
  // Research evaluation -> Solution (conditional based on evaluation)
  graph.addConditionalEdges(
    "evaluateResearch",
    routeAfterResearchEvaluation,
    {
      solution: "solutionSought",
      revise: "deepResearch",
    }
  );
  
  // Solution -> Connection Pairs (conditional based on evaluation)
  graph.addEdge("solutionSought", "evaluateSolution");
  graph.addConditionalEdges(
    "evaluateSolution",
    routeAfterSolutionEvaluation,
    {
      connections: "connectionPairs",
      revise: "solutionSought",
    }
  );
  
  // Connection Pairs -> Section Manager (conditional based on evaluation)
  graph.addEdge("connectionPairs", "evaluateConnections");
  graph.addConditionalEdges(
    "evaluateConnections",
    routeAfterConnectionsEvaluation,
    {
      sections: "sectionManager",
      revise: "connectionPairs",
    }
  );
  
  // Section Manager routes to the appropriate section generator
  graph.addConditionalEdges(
    "sectionManager",
    routeSectionGeneration,
    {
      problem_statement: "generateProblemStatement",
      methodology: "generateMethodology",
      budget: "generateBudget",
      timeline: "generateTimeline",
      conclusion: "generateConclusion",
      complete: "__end__",
    }
  );
  
  // Section generation -> Section evaluation
  graph.addEdge("generateProblemStatement", "evaluateProblemStatement");
  graph.addEdge("generateMethodology", "evaluateMethodology");
  graph.addEdge("generateBudget", "evaluateBudget");
  graph.addEdge("generateTimeline", "evaluateTimeline");
  graph.addEdge("generateConclusion", "evaluateConclusion");
  
  // After evaluation, return to the section manager to determine next section
  graph.addConditionalEdges(
    "evaluateProblemStatement",
    routeAfterSectionEvaluation("problem_statement"),
    {
      next: "sectionManager",
      revise: "generateProblemStatement",
    }
  );
  
  graph.addConditionalEdges(
    "evaluateMethodology",
    routeAfterSectionEvaluation("methodology"),
    {
      next: "sectionManager",
      revise: "generateMethodology",
    }
  );
  
  graph.addConditionalEdges(
    "evaluateBudget",
    routeAfterSectionEvaluation("budget"),
    {
      next: "sectionManager",
      revise: "generateBudget",
    }
  );
  
  graph.addConditionalEdges(
    "evaluateTimeline",
    routeAfterSectionEvaluation("timeline"),
    {
      next: "sectionManager",
      revise: "generateTimeline",
    }
  );
  
  graph.addConditionalEdges(
    "evaluateConclusion",
    routeAfterSectionEvaluation("conclusion"),
    {
      next: "sectionManager",
      revise: "generateConclusion",
    }
  );

  // Configure HITL interrupt points after each evaluation step
  // This enables user feedback/approval at critical points
  const interruptNodes = [
    "evaluateResearch",
    "evaluateSolution", 
    "evaluateConnections",
    "evaluateProblemStatement",
    "evaluateMethodology",
    "evaluateBudget",
    "evaluateTimeline",
    "evaluateConclusion"
  ];

  // Compile the graph with HITL interrupts
  return graph.compile({
    interruptAfter: interruptNodes,
  });
}

/**
 * Runs the proposal generation graph with initial state
 * This is mainly for testing; in production, the Orchestrator will manage graph execution
 */
export async function runProposalGeneration(initialState: Partial<ProposalState>) {
  const graph = createProposalGenerationGraph();
  
  // Configure execution options
  const config: RunnableConfig = {
    recursionLimit: 100, // Prevent infinite loops
  };
  
  try {
    // Run the graph with the initial state
    return await graph.invoke(initialState, config);
  } catch (error) {
    console.error("Error running proposal generation graph:", error);
    throw error;
  }
}

// Export the graph factory and runner
export default {
  createProposalGenerationGraph,
  runProposalGeneration,
};