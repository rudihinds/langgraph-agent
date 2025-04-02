/**
 * Proposal State Annotation for LangGraph
 *
 * Defines the comprehensive state structure for the Proposal Agent System.
 * This includes message history, RFP analysis, solution information,
 * connection pairs, proposal sections, and workflow state.
 */

import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

// We'll extend the base MessagesAnnotation with our custom state
// First, let's define it to ensure we control its structure
const MessagesAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) => current.concat(update),
    default: () => [],
  }),
});

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
  return {
    ...current,
    ...Object.entries(update).reduce<ProposalSections>(
      (acc, [key, section]) => {
        // If section already exists, increment version and merge
        if (current[key]) {
          acc[key] = {
            ...current[key],
            ...section,
            version: current[key].version + 1,
          };
        } else {
          // Otherwise, add new section with version 1
          acc[key] = {
            ...section,
            version: 1,
          };
        }
        return acc;
      },
      {}
    ),
  };
};

// SectionStatus reducer for tracking section progress
const sectionStatusReducer = (
  current: Record<string, SectionStatus>,
  update: Partial<Record<string, SectionStatus>>
): Record<string, SectionStatus> => {
  return {
    ...current,
    ...update,
  };
};

/**
 * The main Proposal State Annotation
 * Contains the complete state structure for the Proposal Agent System
 */
export const ProposalState = Annotation.Root({
  // Include messages from MessagesAnnotation
  ...MessagesAnnotation.spec,

  // RFP analysis results
  rfpAnalysis: Annotation<RFPAnalysisResult | null>({
    default: () => null,
  }),

  // Solution sought analysis
  solutionSought: Annotation<SolutionSoughtAnalysis | null>({
    default: () => null,
  }),

  // Connection pairs with custom reducer to handle updates and additions
  connectionPairs: Annotation<ConnectionPair[]>({
    reducer: connectionPairsReducer,
    default: () => [],
  }),

  // Proposal sections content with versioning and metadata
  proposalSections: Annotation<ProposalSections>({
    reducer: proposalSectionsReducer,
    default: () => ({}),
  }),

  // Section status tracking
  sectionStatus: Annotation<Record<string, SectionStatus>>({
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
  }),

  // Overall workflow tracking
  currentPhase: Annotation<WorkflowPhase>({
    default: () => "research",
  }),

  // Additional metadata
  metadata: Annotation<Record<string, any>>({
    reducer: (current, update) => ({ ...current, ...update }),
    default: () => ({
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      proposalId: "",
      userId: "",
      proposalTitle: "",
    }),
  }),
});

// Export type for use in node functions
export type ProposalStateType = typeof ProposalState.State;

/**
 * Example usage:
 *
 * ```typescript
 * import { StateGraph, START, END } from "@langchain/langgraph";
 * import { ProposalState, ProposalStateType } from "./proposalState";
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
 * const builder = new StateGraph(ProposalState)
 *   .addNode("analyzeRfp", analyzeRfp)
 *   .addEdge(START, "analyzeRfp")
 *   .addEdge("analyzeRfp", END);
 *
 * const graph = builder.compile();
 * ```
 */
