/**
 * Conditional routing functions for the proposal generation graph
 *
 * These functions determine the next node in the graph based on the current state.
 * They implement the control flow logic for the proposal generation process.
 */
import {
  OverallProposalState as ProposalState,
  SectionType,
  SectionData,
  EvaluationResult,
} from "../../state/modules/types.js";
import { Logger, LogLevel } from "../../lib/logger.js";
import {
  ProcessingStatus,
  SectionStatus,
  InterruptProcessingStatus,
  FeedbackType,
} from "../../state/modules/constants.js";

// Create logger instance
const logger = Logger.getInstance();
logger.setLogLevel(LogLevel.INFO); // Or your desired default level

/**
 * Helper function to get dependencies for a section (based on common patterns).
 * NOTE: Ideally, this comes from a centralized configuration or service.
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
    ],
    [SectionType.OUTCOMES]: [SectionType.SOLUTION],
    [SectionType.BUDGET]: [SectionType.SOLUTION, SectionType.METHODOLOGY],
    [SectionType.TIMELINE]: [
      SectionType.SOLUTION,
      SectionType.METHODOLOGY,
      SectionType.BUDGET,
    ],
    [SectionType.TEAM]: [SectionType.SOLUTION, SectionType.METHODOLOGY],
    [SectionType.EVALUATION_PLAN]: [SectionType.SOLUTION, SectionType.OUTCOMES],
    [SectionType.SUSTAINABILITY]: [
      SectionType.SOLUTION,
      SectionType.BUDGET,
      SectionType.TIMELINE,
    ],
    [SectionType.RISKS]: [
      SectionType.SOLUTION,
      SectionType.TIMELINE,
      SectionType.TEAM,
    ],
    [SectionType.CONCLUSION]: [
      SectionType.PROBLEM_STATEMENT,
      SectionType.SOLUTION,
      SectionType.OUTCOMES,
    ],
  };

  return dependencies[section] || [];
}

/**
 * Determines the next step based on the overall state
 * This is a general-purpose router that can be used when specific routes aren't defined
 */
export function determineNextStep(state: ProposalState): string {
  logger.info("Determining next step based on overall state");

  if (state.errors.length > 0) {
    return "error";
  }

  if (state.status === ProcessingStatus.STALE) {
    logger.info("Overall state is stale, routing to handle stale choice");
    return "handle_stale_choice";
  }

  if (state.researchStatus === ProcessingStatus.STALE) return "deepResearch";
  if (state.solutionStatus === ProcessingStatus.STALE) return "solutionSought";

  for (const [sectionId, sectionData] of state.sections) {
    if (sectionData.status === SectionStatus.STALE) {
      logger.info(`Section ${sectionId} is stale, routing to section manager`);
      return "section_manager";
    }
  }

  if (
    state.researchStatus === ProcessingStatus.QUEUED ||
    state.researchStatus === ProcessingStatus.NEEDS_REVISION
  ) {
    logger.info("Routing to deep research");
    return "deep_research";
  } else if (state.researchStatus === ProcessingStatus.AWAITING_REVIEW) {
    logger.info("Routing to evaluate research");
    return "evaluate_research";
  } else if (state.researchStatus === ProcessingStatus.APPROVED) {
    if (
      state.solutionStatus === ProcessingStatus.QUEUED ||
      state.solutionStatus === ProcessingStatus.NEEDS_REVISION
    ) {
      logger.info("Routing to solution sought");
      return "solution_sought";
    } else if (state.solutionStatus === ProcessingStatus.AWAITING_REVIEW) {
      logger.info("Routing to evaluate solution");
      return "evaluate_solution";
    } else if (state.solutionStatus === ProcessingStatus.APPROVED) {
      if (
        state.connectionsStatus === ProcessingStatus.QUEUED ||
        state.connectionsStatus === ProcessingStatus.NEEDS_REVISION
      ) {
        logger.info("Routing to connection pairs");
        return "connection_pairs";
      } else if (state.connectionsStatus === ProcessingStatus.AWAITING_REVIEW) {
        logger.info("Routing to evaluate connection pairs");
        return "evaluate_connection_pairs";
      } else if (state.connectionsStatus === ProcessingStatus.APPROVED) {
        logger.info("Routing to section manager");
        return "section_manager";
      }
    }
  }

  logger.info("Routing to finalize proposal as fallback/final step");
  return "finalize_proposal";
}

/**
 * Routes after research evaluation
 * @param state The current proposal state
 * @returns The next node to route to
 */
export function routeAfterResearchEvaluation(state: ProposalState): string {
  // If research was just approved, move to solution
  if (state.researchStatus === ProcessingStatus.APPROVED) {
    return "solution";
  }

  // If research needs revision, go back to research
  if (state.researchStatus === ProcessingStatus.NEEDS_REVISION) {
    return "revise";
  }

  // Default case - this shouldn't happen if state is properly managed
  console.warn(
    "Unexpected state in routeAfterResearchEvaluation:",
    state.researchStatus
  );
  return "revise";
}

/**
 * Routes after solution evaluation
 * @param state The current proposal state
 * @returns The next node to route to
 */
export function routeAfterSolutionEvaluation(state: ProposalState): string {
  // If solution was approved, move to connections
  if (state.solutionStatus === ProcessingStatus.APPROVED) {
    return "connections";
  }

  // If solution needs revision, go back to solution generation
  if (state.solutionStatus === ProcessingStatus.NEEDS_REVISION) {
    return "revise";
  }

  // Default case
  console.warn(
    "Unexpected state in routeAfterSolutionEvaluation:",
    state.solutionStatus
  );
  return "revise";
}

/**
 * Routes after connections evaluation
 * @param state The current proposal state
 * @returns The next node to route to
 */
export function routeAfterConnectionsEvaluation(state: ProposalState): string {
  // If connections were approved, move to section generation
  if (state.connectionsStatus === ProcessingStatus.APPROVED) {
    return "sections";
  }

  // If connections need revision, go back to connection generation
  if (state.connectionsStatus === ProcessingStatus.NEEDS_REVISION) {
    return "revise";
  }

  // Default case
  console.warn(
    "Unexpected state in routeAfterConnectionsEvaluation:",
    state.connectionsStatus
  );
  return "revise";
}

/**
 * Routes section generation based on which section should be generated next
 * @param state The current proposal state
 * @returns The next section to generate or "complete" if all sections are done
 */
export function routeSectionGeneration(state: ProposalState): string {
  logger.info("Routing section generation");

  // Find the first section that is ready (queued/stale/not_started and dependencies met)
  for (const [sectionId, sectionData] of state.sections) {
    if (
      sectionData.status === SectionStatus.QUEUED ||
      sectionData.status === SectionStatus.STALE ||
      sectionData.status === SectionStatus.NOT_STARTED
    ) {
      const dependencies = getSectionDependencies(sectionId);
      const depsMet = dependencies.every((depId: SectionType) => {
        const depSection = state.sections.get(depId);
        // Use SectionStatus for dependency check
        return depSection && depSection.status === SectionStatus.APPROVED;
      });

      if (depsMet) {
        logger.info(`Section ${sectionId} is ready for generation.`);
        // Return the specific node name for this section
        return `generate_${sectionId}`;
      }
    }
  }

  logger.info("No sections ready for generation, checking completion");
  // Check if all sections are done
  const allDone = Array.from(state.sections.values()).every(
    // Use SectionStatus for completion check
    (s) =>
      s.status === SectionStatus.APPROVED || s.status === SectionStatus.EDITED
  );
  if (allDone) {
    logger.info("All sections complete, routing to finalize");
    return "finalize_proposal";
  }

  logger.warn("No sections ready and not all are complete, possible deadlock?");
  return "handle_error"; // Or wait, depending on logic
}

/**
 * Creates a router function for after section evaluation
 * @param sectionType The section type that was just evaluated
 * @returns A function that routes after section evaluation
 */
export function routeAfterSectionEvaluation(sectionType: SectionType) {
  return (state: ProposalState): string => {
    const sectionState = state.sections.get(sectionType);

    // Use SectionStatus for check
    if (sectionState && sectionState.status === SectionStatus.NEEDS_REVISION) {
      return "revise";
    }

    // Otherwise, move to the next section (or determine next step)
    return "next"; // Or potentially call determineNextStep(state)
  };
}

/**
 * Conditional routing logic after evaluation nodes
 * Determines the next step based on evaluation results and interrupt status
 *
 * @param state The current proposal state
 * @param options Optional parameters including contentType and sectionId
 * @returns The next node to route to
 */
export function routeAfterEvaluation(
  state: ProposalState,
  options: {
    contentType?: string;
    sectionId?: string;
  } = {}
): string {
  const { contentType, sectionId } = options;

  // First priority: check if this is an interrupt for human feedback
  if (state.interruptStatus?.isInterrupted) {
    // For v2 section evaluations (using createSectionEvaluationNode)
    if (!contentType && !sectionId) {
      const nodeId = state.interruptMetadata?.nodeId || "";
      if (nodeId.startsWith("evaluateSection_")) {
        return "review";
      }
    }

    // For legacy contentType-based interrupts
    if (contentType || sectionId) {
      const contentRef = state.interruptMetadata?.contentReference;

      if (contentType === "section" && sectionId) {
        // For section evaluations, compare with sectionId
        if (contentRef === sectionId) {
          return "awaiting_feedback";
        }
      } else if (contentRef === contentType) {
        // For other content types, compare with contentType
        return "awaiting_feedback";
      }
    } else {
      // If no specific content is being checked, any interrupt means awaiting feedback
      return "awaiting_feedback";
    }
  }

  // Handle v2 section evaluations without contentType/sectionId
  if (!contentType && !sectionId) {
    const nodeId = state.interruptMetadata?.nodeId || "";
    if (nodeId.startsWith("evaluateSection_")) {
      const sectionType = nodeId.replace("evaluateSection_", "");
      const section = state.sections.get(sectionType);

      if (!section) {
        return "next";
      }

      switch (section.status) {
        case "APPROVED":
          return "next";
        case "AWAITING_REVIEW":
          return "review";
        case "RUNNING":
          return "revision";
        default:
          return "next";
      }
    }
  }

  // Handle missing metadata
  if (!contentType) {
    console.warn("No content type provided for routing decision");
    return "awaiting_feedback";
  }

  // Check content type and determine routing
  if (contentType === "section" && sectionId) {
    // Section-specific routing
    let sectionTypeKey: SectionType;
    try {
      sectionTypeKey = Object.values(SectionType).find(
        (val) => val === sectionId
      ) as SectionType;
      if (!sectionTypeKey)
        throw new Error(`Invalid section type: ${sectionId}`);
    } catch (e) {
      console.warn(`Invalid section id: ${sectionId}`);
      return "awaiting_feedback";
    }

    const section = state.sections.get(sectionTypeKey);
    if (!section) {
      console.warn(`Section ${sectionId} not found in state`);
      return "awaiting_feedback";
    }

    // Use SectionStatus for checks
    if (section.status === SectionStatus.APPROVED) {
      const isLastSection =
        state.requiredSections.indexOf(sectionTypeKey) ===
        state.requiredSections.length - 1;
      return isLastSection ? "complete" : "continue";
    } else if (section.status === SectionStatus.NEEDS_REVISION) {
      return "revise";
    }
  } else {
    // Handle other content types (research, solution, connections)
    if (contentType === "research") {
      // Use ProcessingStatus for checks
      if (state.researchStatus === ProcessingStatus.APPROVED) {
        return "continue";
      } else if (state.researchStatus === ProcessingStatus.NEEDS_REVISION) {
        return "revise";
      }
    } else if (contentType === "solution") {
      // Use ProcessingStatus for checks
      if (state.solutionStatus === ProcessingStatus.APPROVED) {
        return "continue";
      } else if (state.solutionStatus === ProcessingStatus.NEEDS_REVISION) {
        return "revise";
      }
    } else if (
      contentType === "connections" ||
      contentType === "connection_pairs"
    ) {
      // Use ProcessingStatus for checks
      if (state.connectionsStatus === ProcessingStatus.APPROVED) {
        return "continue";
      } else if (state.connectionsStatus === ProcessingStatus.NEEDS_REVISION) {
        return "revise";
      }
    }
  }

  // Default fallback to awaiting feedback
  return "awaiting_feedback";
}

/**
 * Routes graph execution after processing user feedback
 * Checks for explicit routing destination or examines feedback type and content type
 * to determine the appropriate next node
 *
 * @param state The current proposal state
 * @returns The next node destination key based on feedback
 */
export function routeAfterFeedback(state: OverallProposalState): string {
  // First priority: check for explicit routing destination
  // This is set by processFeedbackNode
  if (
    "feedbackDestination" in state &&
    typeof state.feedbackDestination === "string"
  ) {
    return state.feedbackDestination;
  }

  // If no destination is explicitly set, check feedback type
  if (state.userFeedback && state.interruptMetadata) {
    const { type } = state.userFeedback;
    const { contentType, sectionType } = state.interruptMetadata;

    // If feedback is "approve", continue to next section
    if (type === FeedbackType.APPROVE || type === "approve") {
      return "continue";
    }

    // If feedback is "revise", route to appropriate generation node
    if (
      type === FeedbackType.REVISE ||
      type === "revise" ||
      type === FeedbackType.EDIT ||
      type === "edit"
    ) {
      // Route based on what content needs revision
      if (contentType === "research") return "research";
      if (contentType === "solution") return "solution_content";
      if (contentType === "connections") return "connections";

      // If it's a section, route to the appropriate section node
      if (sectionType) {
        return sectionType;
      }
    }
  }

  // Default: continue to next section if we can't determine a specific route
  return "continue";
}

export default {
  determineNextStep,
  routeAfterResearchEvaluation,
  routeAfterSolutionEvaluation,
  routeAfterConnectionsEvaluation,
  routeSectionGeneration,
  routeAfterSectionEvaluation,
  routeAfterEvaluation,
  routeAfterFeedback,
};
