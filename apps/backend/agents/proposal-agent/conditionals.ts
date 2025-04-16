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
import { OverallProposalState as ProposalState } from "../../state/modules/types.js";

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
      return dependencySection?.status === "approved";
    });
  };

  // Helper function to get the next queued section that's ready to be generated
  const getNextReadySection = (): SectionType | null => {
    const queuedSections: SectionType[] = [];

    // Filter sections that are queued or not_started
    state.sections.forEach((sectionData, sectionType) => {
      if (
        sectionData.status === "queued" ||
        sectionData.status === "not_started"
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
      if (status !== "approved" && status !== "edited") {
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
  const dependencies: Record<SectionType, SectionType[]> = {
    [SectionType.PROBLEM_STATEMENT]: [],
    [SectionType.METHODOLOGY]: [],
    [SectionType.BUDGET]: [SectionType.METHODOLOGY],
    [SectionType.TIMELINE]: [SectionType.METHODOLOGY, SectionType.BUDGET],
    [SectionType.CONCLUSION]: [SectionType.TIMELINE, SectionType.BUDGET],
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
  logger.info("Routing after stale content choice");

  if (
    !state.interruptStatus ||
    !state.interruptStatus.feedback ||
    !state.interruptStatus.feedback.type
  ) {
    logger.error("No stale content choice found in state");
    return "handleError";
  }

  const choice = state.interruptStatus.feedback.type;
  logger.info(`User's stale content choice: ${choice}`);

  if (choice === "regenerate") {
    logger.info("User chose to regenerate stale content");
    return "regenerateStaleContent";
  } else if (choice === "approve") {
    logger.info("User chose to use existing content");
    return "useExistingContent";
  } else {
    logger.error(`Invalid stale content choice: ${choice}`);
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
  const logger = console;
  logger.info("Routing after feedback processing");

  // Check for errors
  if (state.errors && state.errors.length > 0) {
    const lastError = state.errors[state.errors.length - 1];
    logger.error(`Error in feedback processing: ${lastError}`);
    return "handleError";
  }

  // Route based on content reference and its status
  const contentRef = state.interruptMetadata?.contentReference;

  if (!contentRef) {
    logger.error("No content reference found for routing after feedback");
    return "handleError";
  }

  // Research routing
  if (contentRef === "research") {
    if (state.researchStatus === "stale") {
      logger.info("Regenerating research after feedback");
      return "research";
    } else if (state.researchStatus === "approved") {
      logger.info("Moving to solution sought after research approval");
      return "solutionSought";
    } else if (state.researchStatus === "edited") {
      logger.info("Regenerating research with edits");
      return "research";
    }
  }

  // Solution routing
  else if (contentRef === "solution") {
    if (state.solutionStatus === "stale") {
      logger.info("Regenerating solution after feedback");
      return "solutionSought";
    } else if (state.solutionStatus === "approved") {
      logger.info("Moving to section planning after solution approval");
      return "planSections";
    } else if (state.solutionStatus === "edited") {
      logger.info("Regenerating solution with edits");
      return "solutionSought";
    }
  }

  // Connections routing
  else if (contentRef === "connections") {
    if (state.connectionsStatus === "stale") {
      // Need to implement connections regeneration
      logger.info("Regenerating connections after feedback");
      return "generateConnections"; // This node needs to be implemented
    } else if (state.connectionsStatus === "approved") {
      logger.info("Moving to next section after connections approval");
      return "determineNextSection";
    } else if (state.connectionsStatus === "edited") {
      // Need to implement connections editing
      logger.info("Regenerating connections with edits");
      return "generateConnections"; // This node needs to be implemented
    }
  }

  // Section routing (when contentRef is a section ID)
  else {
    // Try to parse the contentRef as a SectionType
    try {
      const sectionType = contentRef as SectionType;
      if (state.sections.has(sectionType)) {
        const section = state.sections.get(sectionType);

        if (section && section.status === "stale") {
          logger.info(`Regenerating section ${contentRef} after feedback`);
          // Set current section before regenerating
          return "generateSection";
        } else if (section && section.status === "approved") {
          logger.info(`Moving to next section after ${contentRef} approval`);
          return "determineNextSection";
        } else if (section && section.status === "edited") {
          logger.info(`Regenerating section ${contentRef} with edits`);
          return "generateSection";
        }
      }
    } catch (e) {
      logger.error(`Invalid section reference: ${contentRef}`);
    }
  }

  // Fallback
  logger.error(`Unexpected state after feedback processing for ${contentRef}`);
  return "handleError";
}

/**
 * Routes the graph after research review based on user feedback
 *
 * @param state Current proposal state
 * @returns The name of the next node to transition to
 */
export function routeAfterResearchReview(state: ProposalState): string {
  const logger = console;
  logger.info("Routing after research review");

  if (state.researchStatus === "approved") {
    return "processFeedback";
  } else if (
    state.researchStatus === "stale" ||
    state.researchStatus === "edited"
  ) {
    return "processFeedback";
  } else {
    return "handleError";
  }
}

/**
 * Routes the graph after solution review based on user feedback
 *
 * @param state Current proposal state
 * @returns The name of the next node to transition to
 */
export function routeAfterSolutionReview(state: ProposalState): string {
  const logger = console;
  logger.info("Routing after solution review");

  if (state.solutionStatus === "approved") {
    return "processFeedback";
  } else if (
    state.solutionStatus === "stale" ||
    state.solutionStatus === "edited"
  ) {
    return "processFeedback";
  } else {
    return "handleError";
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
export function routeFinalizeProposal(state: ProposalState): string {
  const logger = console;
  logger.info("Routing after finalize proposal");

  // Check if there are any sections left to generate
  if (state.requiredSections && state.requiredSections.length > 0) {
    let allSectionsComplete = true;

    for (const sectionType of state.requiredSections) {
      if (state.sections.has(sectionType)) {
        const section = state.sections.get(sectionType);
        if (section && section.status !== "approved") {
          allSectionsComplete = false;
          break;
        }
      } else {
        allSectionsComplete = false;
        break;
      }
    }

    if (allSectionsComplete) {
      return "completeProposal";
    } else {
      return "determineNextSection";
    }
  } else {
    // If no sections defined yet, go back to planning
    return "determineNextSection";
  }
}
