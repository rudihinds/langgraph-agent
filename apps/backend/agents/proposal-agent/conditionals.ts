/**
 * @fileoverview Routing functions that determine the next steps in the proposal generation workflow.
 * These conditionals analyze the current state and direct the flow based on evaluations, statuses, and content needs.
 */

import {
  OverallProposalState,
  SectionType,
  SectionData,
  EvaluationResult,
  SectionProcessingStatus,
} from "../../state/modules/types.js";
import { Logger, LogLevel } from "../../lib/logger.js";
import { FeedbackType } from "../../lib/types/feedback.js";
import { OverallProposalState as ProposalState } from "../../state/modules/types.js";
import {
  ProcessingStatus,
  SectionStatus,
} from "../../state/modules/constants.js";

// Create logger for conditionals module
const logger = Logger.getInstance();
logger.setLogLevel(LogLevel.INFO);

/**
 * Routes the workflow after research evaluation based on the evaluation result.
 *
 * @param state - The current proposal state
 * @returns The name of the next node to execute in the graph
 */
export function routeAfterResearchEvaluation(
  state: OverallProposalState
): "regenerateResearch" | "generateSolutionSought" {
  logger.info("Routing after research evaluation");

  // Check if research evaluation exists and has results
  if (
    !state.researchEvaluation?.passed ||
    typeof state.researchEvaluation.feedback !== "string"
  ) {
    logger.error("No research evaluation result found, regenerating research");
    return "regenerateResearch";
  }

  const passed = state.researchEvaluation.passed;
  logger.info(`Research evaluation result: ${passed ? "pass" : "fail"}`);

  if (passed) {
    logger.info("Research passed evaluation, moving to solution sought");
    return "generateSolutionSought";
  } else {
    logger.info("Research failed evaluation, regenerating");
    return "regenerateResearch";
  }
}

/**
 * Routes the workflow after solution sought evaluation based on the evaluation result.
 *
 * @param state - The current proposal state
 * @returns The name of the next node to execute in the graph
 */
export function routeAfterSolutionEvaluation(
  state: OverallProposalState
): "regenerateSolutionSought" | "generateConnectionPairs" {
  logger.info("Routing after solution evaluation");

  // Check if solution evaluation exists and has results
  if (
    !state.solutionEvaluation?.passed ||
    typeof state.solutionEvaluation.feedback !== "string"
  ) {
    logger.error(
      "No solution sought evaluation result found, regenerating solution"
    );
    return "regenerateSolutionSought";
  }

  const passed = state.solutionEvaluation.passed;
  logger.info(`Solution evaluation result: ${passed ? "pass" : "fail"}`);

  if (passed) {
    logger.info("Solution passed evaluation, moving to connection pairs");
    return "generateConnectionPairs";
  } else {
    logger.info("Solution failed evaluation, regenerating");
    return "regenerateSolutionSought";
  }
}

/**
 * Routes the workflow after connection pairs evaluation based on the evaluation result.
 *
 * @param state - The current proposal state
 * @returns The name of the next node to execute in the graph
 */
export function routeAfterConnectionPairsEvaluation(
  state: OverallProposalState
): "regenerateConnectionPairs" | "determineNextSection" {
  logger.info("Routing after connection pairs evaluation");

  // Check if connection pairs evaluation exists and has results
  if (
    !state.connectionsEvaluation?.passed ||
    typeof state.connectionsEvaluation.feedback !== "string"
  ) {
    logger.error(
      "No connection pairs evaluation result found, regenerating pairs"
    );
    return "regenerateConnectionPairs";
  }

  const passed = state.connectionsEvaluation.passed;
  logger.info(
    `Connection pairs evaluation result: ${passed ? "pass" : "fail"}`
  );

  if (passed) {
    logger.info("Connection pairs passed evaluation, determining next section");
    return "determineNextSection";
  } else {
    logger.info("Connection pairs failed evaluation, regenerating");
    return "regenerateConnectionPairs";
  }
}

/**
 * Determines which section to generate next based on sections that are queued and their dependencies.
 *
 * @param state - The current proposal state
 * @returns The name of the next node to execute in the graph
 */
export function determineNextSection(
  state: OverallProposalState
):
  | "generateExecutiveSummary"
  | "generateGoalsAligned"
  | "generateTeamAssembly"
  | "generateImplementationPlan"
  | "generateBudget"
  | "generateImpact"
  | "finalizeProposal"
  | "handleError" {
  logger.info("Determining next section to generate");

  // Check if we have sections in state
  if (!state.sections || state.sections.size === 0) {
    logger.error("No sections found in state");
    return "handleError";
  }

  // Helper function to check if a section is ready to be generated based on its dependencies
  const isSectionReady = (section: SectionType): boolean => {
    const dependencies = getSectionDependencies(section);
    if (!dependencies || dependencies.length === 0) {
      return true;
    }

    return dependencies.every((dependency) => {
      const dependencySection = state.sections.get(dependency);
      return dependencySection?.status === SectionStatus.APPROVED;
    });
  };

  // Helper function to get the next queued section that's ready to be generated
  const getNextReadySection = (): SectionType | null => {
    const queuedSections: SectionType[] = [];

    // Filter sections that are queued or not_started
    state.sections.forEach((sectionData, sectionType) => {
      if (
        sectionData.status === SectionStatus.QUEUED ||
        sectionData.status === SectionStatus.NOT_STARTED
      ) {
        queuedSections.push(sectionType);
      }
    });

    const readySections = queuedSections.filter((section) =>
      isSectionReady(section)
    );

    if (readySections.length === 0) {
      return null;
    }

    return readySections[0];
  };

  const nextSection = getNextReadySection();
  logger.info(`Next section to generate: ${nextSection || "none available"}`);

  if (!nextSection) {
    let allSectionsCompleted = true;

    // Check if all sections are approved or completed
    state.sections.forEach((section) => {
      const status = section.status;
      if (
        status !== SectionStatus.APPROVED &&
        status !== SectionStatus.EDITED
      ) {
        allSectionsCompleted = false;
      }
    });

    if (allSectionsCompleted) {
      logger.info("All sections complete, finalizing proposal");
      return "finalizeProposal";
    }

    logger.error("No sections ready to generate and not all sections complete");
    return "handleError";
  }

  // Map section type to the appropriate node name
  switch (nextSection) {
    case SectionType.PROBLEM_STATEMENT:
      return "generateExecutiveSummary";
    case SectionType.METHODOLOGY:
      return "generateGoalsAligned";
    // Add appropriate mappings for other section types
    // This is a placeholder mapping - adjust according to your actual section types
    default:
      logger.error(`Unknown section: ${nextSection}`);
      return "handleError";
  }
}

/**
 * Helper function that retrieves dependencies for a given proposal section.
 *
 * @param section - The proposal section to get dependencies for
 * @returns Array of section names that are dependencies for the specified section
 */
function getSectionDependencies(section: SectionType): SectionType[] {
  // Define section dependencies based on proposal structure
  // This should match the dependency map in config/dependencies.json or DependencyService
  const dependencies: Record<SectionType, SectionType[]> = {
    [SectionType.PROBLEM_STATEMENT]: [],
    [SectionType.METHODOLOGY]: [SectionType.PROBLEM_STATEMENT],
    [SectionType.SOLUTION]: [
      SectionType.PROBLEM_STATEMENT,
      SectionType.METHODOLOGY,
    ], // Added SOLUTION
    [SectionType.OUTCOMES]: [SectionType.SOLUTION], // Added OUTCOMES
    [SectionType.BUDGET]: [SectionType.METHODOLOGY, SectionType.SOLUTION], // Added SOLUTION dependency
    [SectionType.TIMELINE]: [
      SectionType.METHODOLOGY,
      SectionType.BUDGET,
      SectionType.SOLUTION,
    ], // Added SOLUTION dependency
    [SectionType.TEAM]: [SectionType.METHODOLOGY, SectionType.SOLUTION], // Added TEAM and SOLUTION dependency
    [SectionType.EVALUATION_PLAN]: [SectionType.SOLUTION, SectionType.OUTCOMES], // Added EVALUATION_PLAN and OUTCOMES dependency
    [SectionType.SUSTAINABILITY]: [
      SectionType.SOLUTION,
      SectionType.BUDGET,
      SectionType.TIMELINE,
    ], // Added SUSTAINABILITY and SOLUTION dependency
    [SectionType.RISKS]: [
      SectionType.SOLUTION,
      SectionType.TIMELINE,
      SectionType.TEAM,
    ], // Added RISKS and TEAM dependency
    [SectionType.CONCLUSION]: [
      SectionType.PROBLEM_STATEMENT,
      SectionType.SOLUTION,
      SectionType.OUTCOMES,
      SectionType.BUDGET,
      SectionType.TIMELINE,
    ], // Added missing dependencies
  };

  return dependencies[section] || [];
}

/**
 * Routes the workflow after a section evaluation based on the evaluation result.
 *
 * @param state - The current proposal state
 * @returns The name of the next node to execute in the graph
 */
export function routeAfterSectionEvaluation(
  state: OverallProposalState
): "regenerateCurrentSection" | "determineNextSection" {
  logger.info("Routing after section evaluation");

  const currentStep = state.currentStep;
  if (!currentStep) {
    logger.error("No current step found");
    return "determineNextSection";
  }

  // Extract section type from currentStep (assuming format like "evaluateSection:PROBLEM_STATEMENT")
  const sectionMatch = currentStep.match(/evaluate.*?:(\w+)/);
  if (!sectionMatch) {
    logger.error(`Could not extract section from step ${currentStep}`);
    return "determineNextSection";
  }

  const sectionType = sectionMatch[1] as SectionType;
  const sectionData = state.sections.get(sectionType);

  if (!sectionData || !sectionData.evaluation) {
    logger.error(`No evaluation found for section ${sectionType}`);
    return "regenerateCurrentSection";
  }

  const passed = sectionData.evaluation.passed;
  logger.info(
    `Section ${sectionType} evaluation result: ${passed ? "pass" : "fail"}`
  );

  if (passed) {
    logger.info(
      `Section ${sectionType} passed evaluation, determining next section`
    );
    return "determineNextSection";
  } else {
    logger.info(`Section ${sectionType} failed evaluation, regenerating`);
    return "regenerateCurrentSection";
  }
}

/**
 * Routes the workflow after receiving a response to a stale content notification.
 * This function determines what action to take based on the user's choice.
 *
 * @param state - The current proposal state
 * @returns The name of the next node to execute in the graph
 */
export function routeAfterStaleContentChoice(
  state: OverallProposalState
): "regenerateStaleContent" | "useExistingContent" | "handleError" {
  logger.info("Routing based on stale content choice");

  if (!state.interruptStatus?.feedback) {
    logger.error("Missing feedback for stale content decision");
    return "handleError";
  }

  const feedbackType = state.interruptStatus.feedback.type;
  const targetNode = state.interruptStatus.interruptionPoint;

  if (feedbackType === FeedbackType.REGENERATE) {
    logger.info("User chose to regenerate stale content");
    return "regenerateStaleContent";
  } else if (feedbackType === FeedbackType.APPROVE) {
    logger.info("User chose to keep existing stale content");
    return "useExistingContent";
  } else {
    logger.error(`Unsupported feedback type for stale choice: ${feedbackType}`);
    return "handleError";
  }
}

/**
 * Routes the graph after feedback processing based on feedback type and updated state
 *
 * @param state Current proposal state after feedback processing
 * @returns The next node to route to
 */
export function routeAfterFeedbackProcessing(state: ProposalState): string {
  logger.info("Routing after processing human feedback");

  if (!state.interruptStatus?.feedback?.type) {
    logger.warn("No feedback type found, determining next general step");
    return determineNextSection(state);
  }

  const feedbackType = state.interruptStatus.feedback.type;
  const interruptionPoint = state.interruptStatus.interruptionPoint;
  const contentRef = state.interruptMetadata?.contentReference;

  logger.info(
    `Feedback type: ${feedbackType}, Interruption point: ${interruptionPoint}, Content ref: ${contentRef}`
  );

  let statusToCheck: ProcessingStatus | SectionStatus | undefined;
  if (contentRef === "research") {
    statusToCheck = state.researchStatus;
  } else if (contentRef === "solution") {
    statusToCheck = state.solutionStatus;
  } else if (contentRef === "connections") {
    statusToCheck = state.connectionsStatus;
  } else if (contentRef && state.sections.has(contentRef as SectionType)) {
    statusToCheck = state.sections.get(contentRef as SectionType)?.status;
  }

  if (
    statusToCheck === ProcessingStatus.STALE ||
    statusToCheck === SectionStatus.STALE
  ) {
    logger.info(
      `Content ${contentRef} is stale, routing to handle stale choice`
    );
    return "handle_stale_choice";
  }

  if (
    statusToCheck === ProcessingStatus.APPROVED ||
    statusToCheck === SectionStatus.APPROVED
  ) {
    logger.info(`Content ${contentRef} approved, determining next step`);
    return determineNextSection(state);
  }

  if (
    statusToCheck === ProcessingStatus.EDITED ||
    statusToCheck === SectionStatus.EDITED
  ) {
    logger.info(`Content ${contentRef} was edited, determining next step`);
    return determineNextSection(state);
  }

  logger.warn(
    "Could not determine specific route after feedback, using default"
  );
  return determineNextSection(state);
}

/**
 * Routes the graph after research review based on user feedback
 *
 * @param state Current proposal state
 * @returns The name of the next node to transition to
 */
export function routeAfterResearchReview(state: OverallProposalState): string {
  if (!state.researchStatus) {
    console.error("Research status not found in state for routing.");
    return "error";
  }

  switch (state.researchStatus) {
    case ProcessingStatus.APPROVED:
      return "continue"; // Research approved, proceed
    case ProcessingStatus.STALE:
      return "stale"; // Research marked stale, regenerate
    case ProcessingStatus.EDITED: // Assuming EDITED implies approved after modification
      return "continue";
    default:
      // Any other status (e.g., NEEDS_REVISION, ERROR, etc.) implies feedback/review is needed
      console.warn(
        `Unexpected research status for routing: ${state.researchStatus}, routing to feedback.`
      );
      return "awaiting_feedback";
  }
}

/**
 * Routes the graph after solution review based on user feedback
 *
 * @param state Current proposal state
 * @returns The name of the next node to transition to
 */
export function routeAfterSolutionReview(state: OverallProposalState): string {
  if (!state.solutionStatus) {
    console.error("Solution status not found in state for routing.");
    return "error";
  }

  switch (state.solutionStatus) {
    case ProcessingStatus.APPROVED:
      return "continue"; // Solution approved, proceed
    case ProcessingStatus.STALE:
      return "stale"; // Solution marked stale, regenerate
    case ProcessingStatus.EDITED:
      return "continue"; // Assuming EDITED implies approved after modification
    default:
      // Any other status implies feedback/review is needed
      console.warn(
        `Unexpected solution status for routing: ${state.solutionStatus}, routing to feedback.`
      );
      return "awaiting_feedback";
  }
}

/**
 * Routes the graph after section review based on user feedback
 *
 * @param state Current proposal state
 * @returns The name of the next node to transition to
 */
export function routeAfterSectionFeedback(state: ProposalState): string {
  const logger = console;
  logger.info("Routing after section feedback");

  // Simply route to the processFeedback node to handle the details
  return "processFeedback";
}

/**
 * Routes the graph after proposal finalization
 *
 * @param state Current proposal state
 * @returns The name of the next node to transition to
 */
export function routeFinalizeProposal(state: OverallProposalState): string {
  const allApprovedOrEdited = Array.from(state.sections.values()).every(
    (section) =>
      section.status === SectionStatus.APPROVED ||
      section.status === SectionStatus.EDITED
  );

  if (allApprovedOrEdited) {
    return "finalize";
  } else {
    // Find the first section data not approved/edited
    const nextSectionData = Array.from(state.sections.values()).find(
      (section) =>
        section.status !== SectionStatus.APPROVED &&
        section.status !== SectionStatus.EDITED
    );

    if (nextSectionData) {
      // Find the corresponding section type (key) for the found section data
      let nextSectionType: string | undefined;
      for (const [key, value] of state.sections.entries()) {
        if (value === nextSectionData) {
          nextSectionType = key;
          break;
        }
      }

      if (nextSectionType) {
        console.log(
          `Not all sections approved/edited. Next section: ${nextSectionType}, Status: ${nextSectionData.status}`
        );
      } else {
        // This should not happen if nextSectionData was found in the map's values
        console.warn(
          "Could not find section type for the next section data in routeFinalizeProposal."
        );
      }

      // You might want more specific routing based on the nextSectionData.status here,
      // e.g., if it's 'queued' or 'generating', route to wait/monitor,
      // if it's 'stale', route to regenerate, if 'error', route to error handler.
      // For now, routing to 'continue' to imply moving to the next processing step.
      return "continue";
    } else {
      // This case shouldn't technically be reachable if not allApprovedOrEdited is true
      console.warn("Could not determine next step in routeFinalizeProposal.");
      return "error";
    }
  }
}
