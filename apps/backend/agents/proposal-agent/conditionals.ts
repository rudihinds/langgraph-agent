/**
 * Conditional routing functions for the Proposal Agent Graph.
 * These functions determine the path through the graph based on state evaluation.
 *
 * Following patterns in AGENT_ARCHITECTURE.md:
 * - All routing functions accept ProposalState and return a string (next node)
 * - Each function includes detailed logging
 * - Functions check state fields defined in /state/proposal.state.ts
 * - Handle potential errors and edge cases
 */

import {
  ProposalState,
  SectionType,
  SectionProcessingStatus,
} from "../../state/proposal.state.js";

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
    return "handleError";
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
  console.log(
    "Routing to awaiting_research_review as evaluation did not pass."
  );
  // Note: The evaluateResearchNode should ideally set the state.researchStatus
  // to 'awaiting_review' when evaluation.passed is false.
  return "awaitResearchReview";
}

/**
 * Determines the next step after solution generation and evaluation.
 *
 * @param state The current overall proposal state.
 * @returns The name of the next node to execute ('planSections', 'await_solution_review', or 'handle_error').
 */
export function routeAfterSolutionEvaluation(state: ProposalState): string {
  console.log("--- Routing after Solution Evaluation ---");
  const evaluation = state.solutionEvaluation;

  // Log the detailed evaluation object if it exists
  console.log(
    "Solution Evaluation Result:",
    evaluation ? JSON.stringify(evaluation, null, 2) : "Not present"
  );
  console.log(`Current Solution Status: ${state.solutionStatus}`);

  // Check for error state or missing evaluation
  if (state.solutionStatus === "error" || !evaluation) {
    console.log(
      "Routing to handleError due to error status or missing solution evaluation."
    );
    return "handleError";
  }

  // Check if evaluation passed
  if (evaluation.passed) {
    console.log("Routing to planSections as solution evaluation passed.");
    return "planSections";
  }

  // Evaluation exists but did not pass
  console.log("Routing to awaitSolutionReview as evaluation did not pass.");
  return "awaitSolutionReview";
}

/**
 * Determines if we need to generate more sections or if the proposal is complete.
 *
 * @param state The current overall proposal state.
 * @returns The name of the next node to execute.
 */
export function determineNextSection(state: ProposalState): string {
  console.log("--- Determining Next Section to Generate ---");

  // Check if we have the required sections defined
  if (!state.requiredSections || state.requiredSections.length === 0) {
    console.log("Required sections not defined. Routing to handleError.");
    return "handleError";
  }

  // Find sections that haven't been started or are in error state
  const pendingSections: SectionType[] = [];

  for (const sectionType of state.requiredSections) {
    const section = state.sections.get(sectionType);

    if (
      !section ||
      section.status === "not_started" ||
      section.status === "error"
    ) {
      pendingSections.push(sectionType);
    }
  }

  console.log(`Pending sections: ${pendingSections.join(", ") || "none"}`);

  // If there are pending sections, pick the first one and update state
  if (pendingSections.length > 0) {
    const nextSectionType = pendingSections[0];
    console.log(`Routing to generateSection for ${nextSectionType}`);

    // Note: The actual node (generateSection) needs to read this value
    // and set the appropriate section as the current one being worked on
    return "generateSection";
  }

  // Check if any sections are awaiting review
  const sectionsAwaitingReview: SectionType[] = [];

  for (const sectionType of state.requiredSections) {
    const section = state.sections.get(sectionType);

    if (section && section.status === "awaiting_review") {
      sectionsAwaitingReview.push(sectionType);
    }
  }

  if (sectionsAwaitingReview.length > 0) {
    console.log(
      "Some sections are awaiting review. Routing to awaitSectionReview."
    );
    return "awaitSectionReview";
  }

  // If everything is complete, finish the proposal
  console.log("All sections complete. Routing to finalizeProposal.");
  return "finalizeProposal";
}

/**
 * Routes after a section has been generated and evaluated.
 * Determines whether to improve the section or submit it for review.
 *
 * @param state The current overall proposal state.
 * @returns The name of the next node to execute.
 */
export function routeAfterSectionEvaluation(state: ProposalState): string {
  // Check if currentStep follows the expected format "section:TYPE"
  const currentStep = state.currentStep;
  const sectionTypeMatch = currentStep?.match(/^section:(.+)$/);
  const currentSectionType = sectionTypeMatch
    ? (sectionTypeMatch[1] as SectionType)
    : undefined;

  console.log(
    `--- Routing After Section Evaluation for ${currentSectionType || "unknown"} ---`
  );

  if (!currentSectionType) {
    console.error("No current section identified in state.currentStep");
    return "handleError";
  }

  const section = state.sections.get(currentSectionType as SectionType);

  if (!section) {
    console.error(`Section ${currentSectionType} not found in state.`);
    return "handleError";
  }

  if (section.status === "needs_revision") {
    console.log(
      `Section ${currentSectionType} needs revision. Routing to improveSection.`
    );
    return "improveSection";
  }

  if (section.status === "queued" || section.status === "not_started") {
    console.log(
      `Section ${currentSectionType} is still in progress. Continuing with awaiting_review.`
    );
    return "submitSectionForReview";
  }

  // Section is ready for review
  console.log(
    `Section ${currentSectionType} is ready for review. Routing to submitSectionForReview.`
  );
  return "submitSectionForReview";
}

/**
 * Routes after user feedback has been received for a section.
 *
 * @param state The current overall proposal state.
 * @returns The name of the next node to execute.
 */
export function routeAfterSectionFeedback(state: ProposalState): string {
  console.log("--- Routing after Section Feedback ---");

  // Get the current section from state
  const currentStep = state.currentStep;

  if (!currentStep || !currentStep.startsWith("section:")) {
    console.log(
      "Error: Cannot determine current section. Routing to handleError."
    );
    return "handleError";
  }

  // Extract section type from currentStep (assuming format "section:SECTION_TYPE")
  const sectionTypeStr = currentStep.split(":")[1];
  const sectionType = sectionTypeStr as SectionType;

  const section = state.sections.get(sectionType);

  if (!section) {
    console.log(
      `Error: Section ${sectionType} not found in state. Routing to handleError.`
    );
    return "handleError";
  }

  console.log(
    `Section ${sectionType} status after feedback: ${section.status}`
  );

  // Route based on the updated status after feedback
  switch (section.status) {
    case "approved":
      console.log(`Section ${sectionType} approved. Determining next section.`);
      return "determineNextSection";

    case "needs_revision":
      console.log(
        `Section ${sectionType} needs revision. Routing back to generateSection.`
      );
      return "generateSection";

    case "error":
      console.log(
        `Section ${sectionType} has error status. Routing to handleError.`
      );
      return "handleError";

    default:
      console.log(
        `Unknown status ${section.status} for section ${sectionType}. Routing to handleError.`
      );
      return "handleError";
  }
}

/**
 * Routes after the entire proposal has been generated.
 * Makes a final decision on whether the proposal is complete or needs more work.
 *
 * @param state The current overall proposal state.
 * @returns The name of the next node to execute.
 */
export function routeFinalizeProposal(state: ProposalState): string {
  console.log("--- Routing Final Proposal Decision ---");

  // Check if any sections are not completed
  const incompleteSections: SectionType[] = [];

  for (const sectionType of state.requiredSections) {
    const section = state.sections.get(sectionType);

    if (!section || section.status !== "approved") {
      incompleteSections.push(sectionType);
    }
  }

  if (incompleteSections.length > 0) {
    console.log(`Incomplete sections found: ${incompleteSections.join(", ")}`);
    console.log("Routing back to determineNextSection.");
    return "determineNextSection";
  }

  // All sections are approved, finalize the proposal
  console.log("All sections are approved. Routing to completeProposal.");
  return "completeProposal";
}

/**
 * Routes after a human-in-the-loop interaction for research review.
 *
 * @param state The current overall proposal state.
 * @returns The name of the next node to execute.
 */
export function routeAfterResearchReview(state: ProposalState): string {
  console.log("--- Routing after Research Review ---");

  // Check the status after human review
  console.log(`Research status after review: ${state.researchStatus}`);

  if (state.researchStatus === "approved") {
    console.log("Research approved. Routing to solutionSought.");
    return "solutionSought";
  }

  if (state.researchStatus === "needs_revision") {
    console.log("Research needs revision. Routing back to research.");
    return "research";
  }

  // If status is error or any other unexpected value
  console.log(
    `Unexpected research status: ${state.researchStatus}. Routing to handleError.`
  );
  return "handleError";
}

/**
 * Routes after a human-in-the-loop interaction for solution review.
 *
 * @param state The current overall proposal state.
 * @returns The name of the next node to execute.
 */
export function routeAfterSolutionReview(state: ProposalState): string {
  console.log("--- Routing after Solution Review ---");

  // Check the status after human review
  console.log(`Solution status after review: ${state.solutionStatus}`);

  if (state.solutionStatus === "approved") {
    console.log("Solution approved. Routing to planSections.");
    return "planSections";
  }

  if (state.solutionStatus === "needs_revision") {
    console.log("Solution needs revision. Routing back to solutionSought.");
    return "solutionSought";
  }

  // If status is error or any other unexpected value
  console.log(
    `Unexpected solution status: ${state.solutionStatus}. Routing to handleError.`
  );
  return "handleError";
}

/**
 * Handles routing when a user explicitly marks a section as stale and needs regeneration
 *
 * @param state The current overall proposal state
 * @returns The name of the next node to execute
 */
export function routeAfterStaleChoice(state: ProposalState): string {
  console.log("--- Routing After Stale Choice ---");

  // Check if the current section or phase is marked as stale
  if (state.currentStep?.startsWith("section:")) {
    const sectionType = state.currentStep.split(":")[1] as SectionType;
    const section = state.sections.get(sectionType);

    if (section && section.status === "stale") {
      console.log(
        `Section ${sectionType} marked as stale. Routing to generateSection.`
      );
      return "generateSection";
    }
  }

  // Check global research phase
  if (state.researchStatus === "stale") {
    console.log("Research marked as stale. Routing to research.");
    return "research";
  }

  // Check solution sought phase
  if (state.solutionStatus === "stale") {
    console.log("Solution sought marked as stale. Routing to solutionSought.");
    return "solutionSought";
  }

  // No stale content identified
  console.log("No stale content identified. Routing to handleError.");
  return "handleError";
}

/**
 * Generic error handler that determines what to do when an error occurs.
 *
 * @param state The current overall proposal state.
 * @returns The name of the next node to execute.
 */
export function handleError(state: ProposalState): string {
  console.log("--- Error Handler Routing ---");

  // Log the errors
  console.log("Errors:", state.errors);

  // Check which step had the error
  const currentStep = state.currentStep || "unknown";
  console.log(`Error occurred during step: ${currentStep}`);

  // Most errors should result in stopping and alerting the user,
  // but some could be automatically retried

  // For now, all errors go to await_user_input
  return "awaitUserInput";
}

// Add other routing functions here as needed...
// e.g., routeAfterSolutionEvaluation, routeAfterSectionEvaluation, determineNextSection...
