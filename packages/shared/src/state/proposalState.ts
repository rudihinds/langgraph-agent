/**
 * Proposal State Annotation for LangGraph
 *
 * Defines the comprehensive state structure for the Proposal Agent System.
 * This includes message history, RFP analysis, solution information,
 * connection pairs, proposal sections, and workflow state.
 */

import { BaseMessage } from "@langchain/core/messages";
import type { StateGraph } from "@langchain/langgraph";

// Define types for RFP Analysis results
export interface RFPAnalysisResult {
  /**
   * Core information about the RFP
   */
  fundingOrganization: string;
  fundingOpportunity: string;
  submissionDeadline?: string;
  fundingAmount?: string;
  eligibilityCriteria?: string[];
  keyPriorities: string[];

  /**
   * Detailed analysis of the RFP documents
   */
  detailedAnalysis: {
    fundingGoals: string[];
    fundingObjectives: string[];
    evaluationCriteria?: {
      criterionName: string;
      description: string;
      weight?: number;
    }[];
    specificRequirements?: string[];
  };

  /**
   * Raw research data obtained about the funder
   */
  funderResearch: {
    missionStatement?: string;
    pastFundingPatterns?: string[];
    leadershipProfiles?: string[];
    recentAnnouncements?: string[];
  };
}

// Define types for Solution Sought information
export interface SolutionSoughtAnalysis {
  /**
   * What the funder is primarily seeking to solve
   */
  primaryProblem: string;

  /**
   * Specific outcomes the funder wants to achieve
   */
  desiredOutcomes: string[];

  /**
   * Approaches the funder seems to favor
   */
  preferredApproaches?: string[];

  /**
   * Key measurement indicators the funder values
   */
  successMetrics?: string[];

  /**
   * Areas that should be emphasized in the proposal
   */
  emphasisPoints: string[];
}

// Define types for Connection Pairs
export interface ConnectionPair {
  /**
   * Unique identifier for the connection pair
   */
  id: string;

  /**
   * Funder priority or requirement this addresses
   */
  funderNeed: string;

  /**
   * Applicant strength or capability that matches the need
   */
  applicantStrength: string;

  /**
   * How well the applicant strength addresses the funder need (1-10)
   */
  alignmentScore: number;

  /**
   * Detailed explanation of why this is a good match
   */
  alignmentExplanation: string;

  /**
   * Sections where this connection should be emphasized
   */
  relevantSections: string[];
}

// Define types for Proposal Sections
export type SectionStatus =
  | "not_started"
  | "in_progress"
  | "draft_complete"
  | "reviewed"
  | "approved";

export interface SectionMetadata {
  title: string;
  description: string;
  wordLimit?: number;
  dependsOn: string[];
}

export interface ProposalSection {
  content: string;
  status: SectionStatus;
  metadata: SectionMetadata;
  feedback?: string[];
  version: number;
}

export type ProposalSections = Record<string, ProposalSection>;

export type WorkflowPhase =
  | "research"
  | "solution_analysis"
  | "connection_pairs"
  | "section_generation"
  | "review"
  | "finalization";

/**
 * Extended MessageState interface to include all proposal-specific fields
 * This is the state that will be passed to node functions
 */
export interface ProposalStateType {
  messages: BaseMessage[];
  rfpAnalysis: RFPAnalysisResult | null;
  solutionSought: SolutionSoughtAnalysis | null;
  connectionPairs: ConnectionPair[];
  proposalSections: ProposalSections;
  sectionStatus: Record<string, SectionStatus>;
  currentPhase: WorkflowPhase;
  metadata: Record<string, any>;
}

// Custom reducer for connection pairs to prevent duplicates and update existing entries
const connectionPairsReducer = (
  current: ConnectionPair[],
  update: ConnectionPair[]
): ConnectionPair[] => {
  // Start with current pairs
  const result = [...current];
  // Create map of existing IDs for quick lookup
  const existingIds = new Map(result.map((pair) => [pair.id, true]));

  // Add or update with new pairs
  for (const pair of update) {
    if (existingIds.has(pair.id)) {
      // Update existing pair
      const index = result.findIndex((p) => p.id === pair.id);
      result[index] = pair;
    } else {
      // Add new pair
      result.push(pair);
    }
  }

  return result;
};

// Custom reducer for proposal sections to update individual sections
const proposalSectionsReducer = (
  current: ProposalSections,
  update: Partial<ProposalSections>
): ProposalSections => {
  // Create a copy of the current state
  const result: ProposalSections = { ...current };

  // Process each update
  Object.entries(update).forEach(([key, section]) => {
    if (!section) return;

    if (current[key]) {
      // If section exists, update and increment version
      result[key] = {
        ...current[key],
        ...(section as ProposalSection),
        version: current[key].version + 1,
      };
    } else if (isCompleteSection(section)) {
      // If section doesn't exist but is complete, add with version 1
      result[key] = {
        ...section,
        version: 1,
      };
    }
    // Ignore incomplete sections for new entries
  });

  return result;
};

// Type guard to check if a section is complete
function isCompleteSection(
  section: Partial<ProposalSection>
): section is ProposalSection {
  return (
    typeof section.content === "string" &&
    typeof section.status === "string" &&
    section.metadata !== undefined
  );
}

// SectionStatus reducer for tracking section progress
const sectionStatusReducer = (
  current: Record<string, SectionStatus>,
  update: Partial<Record<string, SectionStatus>>
): Record<string, SectionStatus> => {
  // Filter out any undefined values from update
  const validUpdates: Record<string, SectionStatus> = {};

  Object.entries(update).forEach(([key, status]) => {
    if (status !== undefined) {
      validUpdates[key] = status;
    }
  });

  return {
    ...current,
    ...validUpdates,
  };
};

// Metadata reducer
const metadataReducer = (
  current: Record<string, any>,
  update: Record<string, any>
): Record<string, any> => {
  return {
    ...current,
    ...update,
  };
};

/**
 * ProposalState object to be used as a state type when creating a StateGraph
 *
 * Note: The actual MessagesAnnotation import is used in the actual implementation
 * when creating the StateGraph. This interface just provides type definitions
 * for the state that will be used in node functions.
 *
 * Example:
 * ```
 * import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
 * import { ProposalStateType } from "./proposalState";
 *
 * const graph = new StateGraph<ProposalStateType>(MessagesAnnotation);
 * ```
 */
export const ProposalState = {
  // Define a placeholder that's compatible with StateGraph
  channelDescriptions: {
    // We use this for typing but this will be replaced by MessagesAnnotation
    messages: {
      value: (x: ProposalStateType) => x.messages,
      reducer: (current: BaseMessage[], update: BaseMessage[]) =>
        current.concat(update),
      default: () => [],
    },

    // Custom channel descriptions for proposal state
    rfpAnalysis: {
      value: (x: ProposalStateType) => x.rfpAnalysis,
      default: () => null,
    },

    solutionSought: {
      value: (x: ProposalStateType) => x.solutionSought,
      default: () => null,
    },

    connectionPairs: {
      value: (x: ProposalStateType) => x.connectionPairs,
      reducer: connectionPairsReducer,
      default: () => [],
    },

    proposalSections: {
      value: (x: ProposalStateType) => x.proposalSections,
      reducer: proposalSectionsReducer,
      default: () => ({}),
    },

    sectionStatus: {
      value: (x: ProposalStateType) => x.sectionStatus,
      reducer: sectionStatusReducer,
      default: () => ({
        problem_statement: "not_started",
        solution: "not_started",
        organizational_capacity: "not_started",
        implementation_plan: "not_started",
        evaluation: "not_started",
        budget: "not_started",
        executive_summary: "not_started",
        conclusion: "not_started",
      }),
    },

    currentPhase: {
      value: (x: ProposalStateType) => x.currentPhase,
      default: () => "research",
    },

    metadata: {
      value: (x: ProposalStateType) => x.metadata,
      reducer: metadataReducer,
      default: () => ({
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        proposalId: "",
        userId: "",
        proposalTitle: "",
      }),
    },
  },
};

// Default state for testing purposes
export const defaultProposalState: ProposalStateType = {
  messages: [],
  rfpAnalysis: null,
  solutionSought: null,
  connectionPairs: [],
  proposalSections: {},
  sectionStatus: {
    problem_statement: "not_started",
    solution: "not_started",
    organizational_capacity: "not_started",
    implementation_plan: "not_started",
    evaluation: "not_started",
    budget: "not_started",
    executive_summary: "not_started",
    conclusion: "not_started",
  },
  currentPhase: "research",
  metadata: {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    proposalId: "",
    userId: "",
    proposalTitle: "",
  },
};

/**
 * Example usage:
 *
 * ```typescript
 * import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
 * import { ProposalStateType } from "./proposalState";
 *
 * // Define a node function that works with the proposal state
 * const analyzeRfp = async (state: ProposalStateType) => {
 *   // Perform RFP analysis...
 *   return {
 *     rfpAnalysis: {
 *       fundingOrganization: "Example Foundation",
 *       fundingOpportunity: "Community Innovation Grant",
 *       keyPriorities: ["sustainability", "community engagement"],
 *       // ... other fields
 *       detailedAnalysis: {
 *         fundingGoals: ["Improve local communities", "Foster innovation"],
 *         fundingObjectives: ["Create sustainable solutions", "Engage diverse populations"],
 *       },
 *       funderResearch: {
 *         missionStatement: "Supporting community-driven innovation",
 *       }
 *     }
 *   };
 * };
 *
 * // Create a graph with our proposal state
 * const builder = new StateGraph<ProposalStateType>(MessagesAnnotation)
 *   .addNode("analyzeRfp", analyzeRfp)
 *   .addEdge(START, "analyzeRfp")
 *   .addEdge("analyzeRfp", END);
 *
 * const graph = builder.compile();
 * ```
 */
