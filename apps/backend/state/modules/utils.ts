/**
 * Utility functions for state management
 */
import { OverallProposalStateSchema } from "./schemas.js";
import { OverallProposalState, SectionType, SectionData } from "./types.js";
import { ProcessingStatus, LoadingStatus } from "./constants.js";

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
      status: LoadingStatus.NOT_STARTED,
    },
    researchStatus: ProcessingStatus.QUEUED,
    solutionStatus: ProcessingStatus.QUEUED,
    connectionsStatus: ProcessingStatus.QUEUED,
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
    status: ProcessingStatus.QUEUED,
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
  // Define the complete dependency map matching constants.ts and other usages
  const dependencies: Record<SectionType, SectionType[]> = {
    [SectionType.PROBLEM_STATEMENT]: [],
    [SectionType.METHODOLOGY]: [SectionType.PROBLEM_STATEMENT],
    [SectionType.SOLUTION]: [
      SectionType.PROBLEM_STATEMENT,
      SectionType.METHODOLOGY,
    ],
    [SectionType.OUTCOMES]: [SectionType.SOLUTION],
    [SectionType.BUDGET]: [SectionType.METHODOLOGY, SectionType.SOLUTION],
    [SectionType.TIMELINE]: [
      SectionType.METHODOLOGY,
      SectionType.BUDGET,
      SectionType.SOLUTION,
    ],
    [SectionType.TEAM]: [SectionType.METHODOLOGY, SectionType.SOLUTION],
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
      SectionType.BUDGET,
      SectionType.TIMELINE,
    ],
  };

  const sectionDependencies = dependencies[sectionType] || [];

  // If no dependencies, section is ready
  if (sectionDependencies.length === 0) {
    return true;
  }

  // Check if all dependencies are met (APPROVED)
  const allDependenciesMet = sectionDependencies.every((depType) => {
    const depSection = state.sections.get(depType);
    // Use enum for check - A dependency is met if it's APPROVED
    return depSection && depSection.status === ProcessingStatus.APPROVED;
  });

  return allDependenciesMet;
}
