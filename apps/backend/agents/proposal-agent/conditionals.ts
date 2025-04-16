import { ProposalState } from "../../state/proposal.state.js";

/**
 * Determines the next step after the research evaluation node.
 *
 * @param state The current overall proposal state.
 * @returns The name of the next node to execute ('solutionSought', 'await_research_review', or 'handle_error').
 */
export function routeAfterResearchEvaluation(state: ProposalState): string {
  console.log("--- Routing after Research Evaluation ---");
  const evaluation = state.researchEvaluation;
  // Log the detailed evaluation object if it exists
  console.log(
    "Evaluation Result:",
    evaluation ? JSON.stringify(evaluation, null, 2) : "Not present"
  );
  console.log(`Current Research Status: ${state.researchStatus}`);

  // 1. Check for evaluation error state OR missing evaluation object
  //    We assume the evaluateResearchNode sets researchStatus to 'error' if it fails internally.
  if (state.researchStatus === "error" || !evaluation) {
    console.log(
      "Routing to handle_error due to error status or missing evaluation."
    );
    return "handle_error";
  }

  // 2. Check if evaluation passed (assuming evaluation object exists now)
  if (evaluation.passed) {
    console.log("Routing to solutionSought as evaluation passed.");
    // Note: The 'researchStatus' might still be 'running' or 'awaiting_review' here.
    // The subsequent node ('solutionSought') should likely update its own status.
    // We don't strictly need to check for 'approved' status here if 'passed' is true.
    return "solutionSought";
  }

  // 3. Evaluation exists but did not pass (failed or needs explicit review)
  console.log("Routing to await_research_review as evaluation did not pass.");
  // Note: The evaluateResearchNode should ideally set the state.researchStatus
  // to 'awaiting_review' when evaluation.passed is false.
  return "await_research_review";

  // Removed the previous complex status checks and default fallback,
  // as the logic above covers all expected outcomes based on the evaluation object.
}

// Add other routing functions here as needed...
// e.g., routeAfterSolutionEvaluation, routeAfterSectionEvaluation, determineNextSection...
