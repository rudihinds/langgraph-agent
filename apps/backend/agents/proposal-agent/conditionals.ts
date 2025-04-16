/**
 * @fileoverview Routing functions that determine the next steps in the proposal generation workflow.
 * These conditionals analyze the current state and direct the flow based on evaluations, statuses, and content needs.
 */

import { ProposalState } from "../../state/proposal.state.js";
import { createLogger } from "../../lib/utils/logger.js";

const logger = createLogger("conditionals");

/**
 * Routes the workflow after research evaluation based on the evaluation result.
 *
 * @param state - The current proposal state
 * @returns The name of the next node to execute in the graph
 */
export function routeAfterResearchEvaluation(
  state: ProposalState
): "regenerateResearch" | "generateSolutionSought" {
  logger.info("Routing after research evaluation");

  // Check if research evaluation exists and has results
  if (
    !state.research?.evaluation?.result ||
    typeof state.research.evaluation.result !== "string"
  ) {
    logger.error("No research evaluation result found, regenerating research");
    return "regenerateResearch";
  }

  const result = state.research.evaluation.result.toLowerCase();
  logger.info(`Research evaluation result: ${result}`);

  if (result === "pass") {
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
  state: ProposalState
): "regenerateSolutionSought" | "generateConnectionPairs" {
  logger.info("Routing after solution evaluation");

  // Check if solution evaluation exists and has results
  if (
    !state.solutionSought?.evaluation?.result ||
    typeof state.solutionSought.evaluation.result !== "string"
  ) {
    logger.error(
      "No solution sought evaluation result found, regenerating solution"
    );
    return "regenerateSolutionSought";
  }

  const result = state.solutionSought.evaluation.result.toLowerCase();
  logger.info(`Solution evaluation result: ${result}`);

  if (result === "pass") {
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
  state: ProposalState
): "regenerateConnectionPairs" | "determineNextSection" {
  logger.info("Routing after connection pairs evaluation");

  // Check if connection pairs evaluation exists and has results
  if (
    !state.connectionPairs?.evaluation?.result ||
    typeof state.connectionPairs.evaluation.result !== "string"
  ) {
    logger.error(
      "No connection pairs evaluation result found, regenerating pairs"
    );
    return "regenerateConnectionPairs";
  }

  const result = state.connectionPairs.evaluation.result.toLowerCase();
  logger.info(`Connection pairs evaluation result: ${result}`);

  if (result === "pass") {
    logger.info("Connection pairs passed evaluation, determining next section");
    return "determineNextSection";
  } else {
    logger.info("Connection pairs failed evaluation, regenerating");
    return "regenerateConnectionPairs";
  }
}

// Define section types to match state structure
type ProposalSection =
  | "executiveSummary"
  | "goalsAligned"
  | "teamAssembly"
  | "implementationPlan"
  | "budget"
  | "impact";

interface SectionData {
  status: string;
  evaluation?: {
    result?: string;
  };
}

/**
 * Determines which section to generate next based on sections that are queued and their dependencies.
 *
 * @param state - The current proposal state
 * @returns The name of the next node to execute in the graph
 */
export function determineNextSection(
  state: ProposalState
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
  if (!state.sections) {
    logger.error("No sections found in state");
    return "handleError";
  }

  // Helper function to check if a section is ready to be generated based on its dependencies
  const isSectionReady = (section: ProposalSection): boolean => {
    const dependencies = getSectionDependencies(section);
    if (!dependencies || dependencies.length === 0) {
      return true;
    }

    return dependencies.every((dependency) => {
      const dependencySection = state.sections?.[dependency] as
        | SectionData
        | undefined;
      return dependencySection?.status === "approved";
    });
  };

  // Helper function to get the next queued section that's ready to be generated
  const getNextReadySection = (): ProposalSection | null => {
    const queuedSections = Object.entries(state.sections)
      .filter(([_, sectionData]) => {
        const section = sectionData as SectionData;
        return section.status === "queued" || section.status === "not_started";
      })
      .map(([section, _]) => section as ProposalSection);

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
    const allSectionsCompleted = Object.values(state.sections).every(
      (section) => {
        const sectionData = section as SectionData;
        return (
          sectionData.status === "approved" || sectionData.status === "complete"
        );
      }
    );

    if (allSectionsCompleted) {
      logger.info("All sections complete, finalizing proposal");
      return "finalizeProposal";
    }

    logger.error("No sections ready to generate and not all sections complete");
    return "handleError";
  }

  switch (nextSection) {
    case "executiveSummary":
      return "generateExecutiveSummary";
    case "goalsAligned":
      return "generateGoalsAligned";
    case "teamAssembly":
      return "generateTeamAssembly";
    case "implementationPlan":
      return "generateImplementationPlan";
    case "budget":
      return "generateBudget";
    case "impact":
      return "generateImpact";
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
function getSectionDependencies(section: ProposalSection): ProposalSection[] {
  // Define section dependencies based on proposal structure
  const dependencies: Record<ProposalSection, ProposalSection[]> = {
    executiveSummary: [],
    goalsAligned: [],
    teamAssembly: ["goalsAligned"],
    implementationPlan: ["goalsAligned", "teamAssembly"],
    budget: ["implementationPlan"],
    impact: ["implementationPlan", "budget"],
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
  state: ProposalState
): "regenerateCurrentSection" | "determineNextSection" {
  logger.info("Routing after section evaluation");

  const currentPhase = state.currentPhase;
  if (!currentPhase || !currentPhase.section) {
    logger.error("No current phase or section found");
    return "determineNextSection";
  }

  const section = currentPhase.section as ProposalSection;
  const sectionData = state.sections?.[section] as SectionData | undefined;
  const evaluationResult = sectionData?.evaluation?.result;

  if (!evaluationResult) {
    logger.error(`No evaluation result found for section ${section}`);
    return "regenerateCurrentSection";
  }

  logger.info(`Section ${section} evaluation result: ${evaluationResult}`);

  if (evaluationResult.toLowerCase() === "pass") {
    logger.info(
      `Section ${section} passed evaluation, determining next section`
    );
    return "determineNextSection";
  } else {
    logger.info(`Section ${section} failed evaluation, regenerating`);
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
  state: ProposalState
): "regenerateStaleContent" | "useExistingContent" | "handleError" {
  logger.info("Routing after stale content choice");

  if (!state.userChoices || !state.userChoices.staleContentChoice) {
    logger.error("No stale content choice found in state");
    return "handleError";
  }

  const choice = state.userChoices.staleContentChoice.toLowerCase();
  logger.info(`User's stale content choice: ${choice}`);

  if (choice === "regenerate") {
    logger.info("User chose to regenerate stale content");
    return "regenerateStaleContent";
  } else if (choice === "use_existing") {
    logger.info("User chose to use existing content");
    return "useExistingContent";
  } else {
    logger.error(`Invalid stale content choice: ${choice}`);
    return "handleError";
  }
}
