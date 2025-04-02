/**
 * Proposal State Annotation for LangGraph
 *
 * Defines the core state structure for the Proposal Agent System.
 * This includes message history and extensible fields for proposal generation.
 */

import { BaseMessage } from "@langchain/core/messages";
import type { StateGraph } from "@langchain/langgraph";

/**
 * Extended MessageState interface with proposal-specific fields
 * Uses a minimal core structure with flexible object shapes
 */
export interface ProposalStateType {
  // Standard messages field from MessagesAnnotation
  messages: BaseMessage[];

  // High-level analysis of the RFP document
  rfpAnalysis: Record<string, any> | null;

  // Solution alignment information
  solutionSought: Record<string, any> | null;

  // Alignment points between applicant and funder
  connectionPairs: Array<Record<string, any>>;

  // Content and metadata for proposal sections
  proposalSections: Record<string, Record<string, any>>;

  // Status tracking for each section
  sectionStatus: Record<string, string>;

  // Current phase of the workflow
  currentPhase: string;

  // Additional metadata
  metadata: Record<string, any>;
}

// Custom reducer for connection pairs that prevents duplicates using ID
const connectionPairsReducer = (
  current: Array<Record<string, any>>,
  update: Array<Record<string, any>>
): Array<Record<string, any>> => {
  // Start with current pairs
  const result = [...current];

  // Create map of existing IDs for quick lookup
  const existingIds = new Map(result.map((pair) => [pair.id, true]));

  // Add or update with new pairs
  for (const pair of update) {
    if (pair.id && existingIds.has(pair.id)) {
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

// Custom reducer for proposal sections
const proposalSectionsReducer = (
  current: Record<string, Record<string, any>>,
  update: Record<string, any>
): Record<string, Record<string, any>> => {
  // Create a copy of the current state
  const result = { ...current };

  // Process each section update
  Object.entries(update).forEach(([key, section]) => {
    if (!section) return;

    if (current[key]) {
      // If section exists, merge and increment version
      result[key] = {
        ...current[key],
        ...(section as Record<string, any>),
        version: (current[key].version || 0) + 1,
      };
    } else {
      // If section doesn't exist, add it with version 1
      result[key] = {
        ...(section as Record<string, any>),
        version: 1,
      };
    }
  });

  return result;
};

// Section status reducer
const sectionStatusReducer = (
  current: Record<string, string>,
  update: Record<string, string>
): Record<string, string> => {
  return {
    ...current,
    ...update,
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
    updatedAt: new Date().toISOString(),
  };
};

/**
 * ProposalState object to be used with StateGraph
 *
 * This defines the core state structure and reducers while
 * keeping the actual data shape flexible for evolution.
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

    // Flexible RFP analysis state
    rfpAnalysis: {
      value: (x: ProposalStateType) => x.rfpAnalysis,
      default: () => null,
    },

    // Solution sought analysis
    solutionSought: {
      value: (x: ProposalStateType) => x.solutionSought,
      default: () => null,
    },

    // Connection pairs with ID-based deduplication
    connectionPairs: {
      value: (x: ProposalStateType) => x.connectionPairs,
      reducer: connectionPairsReducer,
      default: () => [],
    },

    // Proposal sections with version tracking
    proposalSections: {
      value: (x: ProposalStateType) => x.proposalSections,
      reducer: proposalSectionsReducer,
      default: () => ({}),
    },

    // Section status tracking
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

    // Workflow phase tracking
    currentPhase: {
      value: (x: ProposalStateType) => x.currentPhase,
      default: () => "research",
    },

    // Metadata with automatic timestamp updates
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
 *       detailedAnalysis: {
 *         // Flexible structure that can evolve as needed
 *         fundingGoals: ["Improve local communities", "Foster innovation"],
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
