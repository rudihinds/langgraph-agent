/**
 * Utility functions for state management
 */
import { OverallProposalStateSchema } from "./schemas.js";
import {
  OverallProposalState,
  SectionType,
  SectionData,
  ProposalSection,
  RfpDocument,
} from "./types.js";
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
  userId: string = "default-user",
  proposalId: string = "default-proposal",
  sessionId: string = "default-session",
  projectName?: string
): OverallProposalState {
  const timestamp = new Date().toISOString();

  const rfpDocument: RfpDocument = {
    raw: "",
    parsed: {
      sections: [],
      requirements: [],
      evaluationCriteria: [],
    },
    metadata: {
      title: "",
      organization: "",
      submissionDeadline: "",
      pageLimit: 0,
      formatRequirements: [],
    },
  };

  return {
    // Required core fields
    userId,
    sessionId,
    proposalId,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastUpdatedAt: timestamp,

    // Document handling
    rfpDocument,
    rfpProcessingStatus: ProcessingStatus.NOT_STARTED,

    // Section processing - using Record as defined in types
    sections: {},
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
    projectName,
    status: ProcessingStatus.NOT_STARTED,

    // Legacy fields for backward compatibility
    researchStatus: ProcessingStatus.NOT_STARTED,
    solutionStatus: ProcessingStatus.NOT_STARTED,
    connectionsStatus: ProcessingStatus.NOT_STARTED,
  };
}

/**
 * Validate state against schema
 * @param state - The state object to validate
 * @returns The validated state or throws error if invalid
 */
export function validateProposalState(
  state: Partial<OverallProposalState>
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
    [SectionType.BUDGET]: [SectionType.METHODOLOGY, SectionType.SOLUTION],
    [SectionType.TIMELINE]: [
      SectionType.METHODOLOGY,
      SectionType.BUDGET,
      SectionType.SOLUTION,
    ],
    [SectionType.CONCLUSION]: [
      SectionType.PROBLEM_STATEMENT,
      SectionType.SOLUTION,
      SectionType.BUDGET,
      SectionType.TIMELINE,
    ],
    // Add all sections from SectionType enum
    [SectionType.ORGANIZATIONAL_CAPACITY]: [SectionType.PROBLEM_STATEMENT],
    [SectionType.IMPLEMENTATION_PLAN]: [SectionType.SOLUTION],
    [SectionType.EVALUATION]: [SectionType.SOLUTION],
    [SectionType.EXECUTIVE_SUMMARY]: [SectionType.SOLUTION, SectionType.BUDGET],
    [SectionType.STAKEHOLDER_ANALYSIS]: [SectionType.PROBLEM_STATEMENT],
  };

  const sectionDependencies = dependencies[sectionType] || [];

  // If no dependencies, section is ready
  if (sectionDependencies.length === 0) {
    return true;
  }

  // Check if all dependencies are met (APPROVED) - now using Record access
  const allDependenciesMet = sectionDependencies.every((depType) => {
    const depSection = state.sections?.[depType];
    // A dependency is met if it's APPROVED
    return depSection && depSection.status === ProcessingStatus.APPROVED;
  });

  return allDependenciesMet;
}
