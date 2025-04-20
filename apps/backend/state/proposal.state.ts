/**
 * State definition for the proposal generation system
 * Based on the architecture specified in AGENT_ARCHITECTURE.md
 * This file defines the state annotations and re-exports the main types
 *
 * @module proposal.state
 */

import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

// Import all types from the modules
import {
  OverallProposalState,
  SectionData,
  EvaluationResult,
  InterruptStatus,
  InterruptMetadata,
  UserFeedback,
  LoadingStatus,
  ProcessingStatus,
  SectionProcessingStatus,
  SectionType,
} from "./modules/types.js";

// Import the schema for validation
import { OverallProposalStateSchema } from "./modules/schemas.js";

// Re-export everything for convenient access
export * from "./modules/types.js";
export * from "./modules/constants.js";
export * from "./modules/schemas.js";

/**
 * Binary operator type used by LangGraph for reducer functions
 */
type BinaryOperator<A, B = A> = (a: A, b: B) => A;

/**
 * Type-safe reducer for the sections map
 */
const sectionsReducer: BinaryOperator<Map<SectionType, SectionData>> = (
  existing = new Map<SectionType, SectionData>(),
  incoming = new Map<SectionType, SectionData>()
) => {
  // Create a copy of the existing map
  const result = new Map(existing);

  // Merge in the incoming sections - using Array.from to avoid compatibility issues
  Array.from(incoming.keys()).forEach((key) => {
    const value = incoming.get(key)!;
    if (result.has(key)) {
      // Merge with existing section data
      const existingSection = result.get(key)!;
      result.set(key, {
        ...existingSection,
        ...value,
        // Ensure timestamps are updated
        lastUpdated: value.lastUpdated || existingSection.lastUpdated,
      });
    } else {
      // Add new section
      result.set(key, value);
    }
  });

  return result;
};

/**
 * Type-safe reducer for error arrays
 */
const errorsReducer: BinaryOperator<string[]> = (
  existing = [],
  incoming = []
) => {
  return [...existing, ...incoming];
};

/**
 * Default last value reducer (typesafe)
 */
function lastValueReducer<T>(a: T, b: T | undefined): T {
  return b !== undefined ? b : a;
}

/**
 * LangGraph state annotation with properly defined channels and reducers
 */
export const ProposalStateAnnotation = Annotation.Root({
  // Chat history uses the built-in messagesStateReducer
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  // RFP document
  rfpDocument: Annotation<OverallProposalState["rfpDocument"]>({
    reducer: (existing, newValue) => ({ ...existing, ...newValue }),
    default: () => ({
      id: "",
      status: LoadingStatus.NOT_STARTED,
    }),
  }),

  // Research
  researchResults: Annotation<Record<string, any> | undefined>({
    reducer: lastValueReducer,
    default: () => undefined,
  }),
  researchStatus: Annotation<ProcessingStatus>({
    reducer: lastValueReducer,
    default: () => ProcessingStatus.NOT_STARTED,
  }),
  researchEvaluation: Annotation<EvaluationResult | null | undefined>({
    reducer: lastValueReducer,
    default: () => undefined,
  }),

  // Solution
  solutionResults: Annotation<Record<string, any> | undefined>({
    reducer: lastValueReducer,
    default: () => undefined,
  }),
  solutionStatus: Annotation<ProcessingStatus>({
    reducer: lastValueReducer,
    default: () => ProcessingStatus.NOT_STARTED,
  }),
  solutionEvaluation: Annotation<EvaluationResult | null | undefined>({
    reducer: lastValueReducer,
    default: () => undefined,
  }),

  // Connections
  connections: Annotation<any[] | undefined>({
    reducer: lastValueReducer,
    default: () => undefined,
  }),
  connectionsStatus: Annotation<ProcessingStatus>({
    reducer: lastValueReducer,
    default: () => ProcessingStatus.NOT_STARTED,
  }),
  connectionsEvaluation: Annotation<EvaluationResult | null | undefined>({
    reducer: lastValueReducer,
    default: () => undefined,
  }),

  // Sections with custom reducer for proper merging
  sections: Annotation<Map<SectionType, SectionData>>({
    reducer: sectionsReducer,
    default: () => new Map(),
  }),
  requiredSections: Annotation<SectionType[]>({
    reducer: lastValueReducer,
    default: () => [],
  }),

  // Flow state
  currentStep: Annotation<string | null>({
    reducer: lastValueReducer,
    default: () => null,
  }),
  status: Annotation<ProcessingStatus>({
    reducer: lastValueReducer,
    default: () => ProcessingStatus.NOT_STARTED,
  }),

  // Interrupt handling
  interruptStatus: Annotation<InterruptStatus>({
    reducer: (existing, newValue) => ({
      ...existing,
      ...newValue,
      feedback:
        newValue?.feedback !== null
          ? {
              ...(existing.feedback || {
                type: null,
                content: null,
                timestamp: null,
              }),
              ...(newValue.feedback || {}),
            }
          : null,
    }),
    default: () => ({
      isInterrupted: false,
      interruptionPoint: null,
      feedback: null,
      processingStatus: null,
    }),
  }),
  interruptMetadata: Annotation<InterruptMetadata | undefined>({
    reducer: lastValueReducer,
    default: () => undefined,
  }),
  userFeedback: Annotation<UserFeedback | undefined>({
    reducer: lastValueReducer,
    default: () => undefined,
  }),

  // Thread management
  activeThreadId: Annotation<string>({
    reducer: lastValueReducer,
    default: () => "",
  }),

  // Error tracking with custom reducer
  errors: Annotation<string[]>({
    reducer: errorsReducer,
    default: () => [],
  }),

  // Metadata
  projectName: Annotation<string | undefined>({
    reducer: lastValueReducer,
    default: () => undefined,
  }),
  userId: Annotation<string | undefined>({
    reducer: lastValueReducer,
    default: () => undefined,
  }),
  createdAt: Annotation<string>({
    reducer: (current, newValue) => current || newValue, // Keep first value
    default: () => new Date().toISOString(),
  }),
  lastUpdatedAt: Annotation<string>({
    reducer: (_current, newValue) => newValue || new Date().toISOString(), // Always update
    default: () => new Date().toISOString(),
  }),
});

/**
 * Creates an initial empty state for a new proposal
 */
export function createInitialState(
  threadId: string,
  userId?: string
): OverallProposalState {
  const now = new Date().toISOString();

  return {
    // RFP Document
    rfpDocument: {
      id: "",
      status: LoadingStatus.NOT_STARTED,
    },

    // Research
    researchStatus: ProcessingStatus.NOT_STARTED,
    researchResults: undefined,
    researchEvaluation: undefined,

    // Solution
    solutionStatus: ProcessingStatus.NOT_STARTED,
    solutionResults: undefined,
    solutionEvaluation: undefined,

    // Connections
    connectionsStatus: ProcessingStatus.NOT_STARTED,
    connections: undefined,
    connectionsEvaluation: undefined,

    // Sections
    sections: new Map(),
    requiredSections: [],

    // Flow state
    currentStep: null,
    status: ProcessingStatus.NOT_STARTED,

    // Interrupt handling
    interruptStatus: {
      isInterrupted: false,
      interruptionPoint: null,
      feedback: null,
      processingStatus: null,
    },
    interruptMetadata: undefined,
    userFeedback: undefined,

    // Thread management
    activeThreadId: threadId,

    // Chat history
    messages: [],

    // Error tracking
    errors: [],

    // Metadata
    projectName: undefined,
    userId,
    createdAt: now,
    lastUpdatedAt: now,
  };
}

/**
 * Validate state against schema
 * @returns The validated state or throws error if invalid
 */
export function validateProposalState(
  state: OverallProposalState
): OverallProposalState {
  try {
    // Safely cast result after validation to ensure correct type
    return OverallProposalStateSchema.parse(state) as OverallProposalState;
  } catch (error) {
    console.error("State validation failed:", error);
    // Re-throw to allow proper error handling
    throw error;
  }
}

// Define a type for accessing the state based on the annotation
export type AnnotatedOverallProposalState =
  typeof ProposalStateAnnotation.State;
