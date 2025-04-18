/**
 * Utility functions for state management
 */
import { OverallProposalStateSchema } from "./schemas";
import { OverallProposalState, SectionType } from "./types";

/**
 * Create a new initial state with default values
 * @param threadId - Unique thread identifier for the proposal
 * @param userId - Optional user identifier
 * @param projectName - Optional project name
 * @returns An initialized OverallProposalState object
 */
export function createInitialProposalState(
  threadId: string,
  userId?: string,
  projectName?: string
): OverallProposalState {
  const timestamp = new Date().toISOString();

  return {
    rfpDocument: {
      id: "",
      status: "not_started",
    },
    researchStatus: "queued",
    solutionStatus: "queued",
    connectionsStatus: "queued",
    sections: new Map(),
    requiredSections: [],

    // Initial HITL interrupt state
    interruptStatus: {
      isInterrupted: false,
      interruptionPoint: null,
      feedback: null,
      processingStatus: null,
    },

    currentStep: null,
    activeThreadId: threadId,
    messages: [],
    errors: [],
    userId,
    projectName,
    createdAt: timestamp,
    lastUpdatedAt: timestamp,
    status: "queued",
  };
}

/**
 * Validate state against schema
 * @param state - The state object to validate
 * @returns The validated state or throws error if invalid
 */
export function validateProposalState(
  state: OverallProposalState
): OverallProposalState {
  return OverallProposalStateSchema.parse(state);
}

/**
 * Get required sections based on RFP content and user preferences
 * @param state - Current proposal state
 * @returns Array of required section types
 */
export function getRequiredSections(
  state: OverallProposalState
): SectionType[] {
  // This is a placeholder implementation
  // In a real implementation, this would analyze the RFP content
  // and determine which sections are required based on that analysis

  // Default to including all sections for now
  return Object.values(SectionType);
}

/**
 * Check if a section is ready to be generated based on dependencies
 * @param state - Current proposal state
 * @param sectionType - The section to check
 * @returns Boolean indicating if section can be generated
 */
export function isSectionReady(
  state: OverallProposalState,
  sectionType: SectionType
): boolean {
  // This is a placeholder implementation
  // In a real implementation, this would check the dependency map
  // and verify that all dependencies are in an approved state

  // Define a simple dependency map
  const dependencies: Record<SectionType, SectionType[]> = {
    [SectionType.PROBLEM_STATEMENT]: [],
    [SectionType.METHODOLOGY]: [SectionType.PROBLEM_STATEMENT],
    [SectionType.BUDGET]: [SectionType.METHODOLOGY],
    [SectionType.TIMELINE]: [SectionType.METHODOLOGY],
    [SectionType.CONCLUSION]: [
      SectionType.PROBLEM_STATEMENT,
      SectionType.METHODOLOGY,
      SectionType.BUDGET,
      SectionType.TIMELINE,
    ],
  };

  const sectionDependencies = dependencies[sectionType] || [];

  // If no dependencies, section is ready
  if (sectionDependencies.length === 0) {
    return true;
  }

  // Check if all dependencies are in an approved state
  return sectionDependencies.every((depType) => {
    const depSection = state.sections.get(depType);
    return (
      depSection &&
      (depSection.status === "approved" || depSection.status === "complete")
    );
  });
}
