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
  SectionToolInteraction,
  Funder,
  Applicant,
  WordLength,
  RFPDocument,
  ProposalSection,
  SectionEvaluationResults,
  PlanningIntelligence,
  UserCollaboration,
  AdaptiveWorkflow,
  EvaluationCriteria,
  InterruptProcessingStatus,
  GenerationApproach,
} from "./modules/types.js";

// Import the schema for validation (temporarily commented due to compilation issues)
// import { OverallProposalStateSchema } from "./modules/schemas.js";

// Import helper functions
import {
  createInitialPlanningIntelligence,
  createInitialUserCollaboration,
  createInitialAdaptiveWorkflow,
} from "./modules/helpers.js";

// Re-export everything for convenient access
export * from "./modules/types.js";
export * from "./modules/constants.js";
// export * from "./modules/schemas.js"; // Temporarily commented due to compilation issues

/**
 * Binary operator type used by LangGraph for reducer functions
 */
type BinaryOperator<A, B = A> = (a: A, b: B) => A;

/**
 * Type-safe reducer for the sections map
 */
export const sectionsReducer = (
  existing: Record<string, ProposalSection> = {},
  incoming: Record<string, ProposalSection> = {}
): Record<string, ProposalSection> => {
  return { ...existing, ...incoming };
};

/**
 * Type-safe reducer for error arrays
 */
export const errorsReducer: BinaryOperator<string[]> = (
  existing = [],
  incoming = []
) => {
  return [...existing, ...incoming];
};

/**
 * Type-safe reducer for section tool messages
 */
const sectionToolMessagesReducer: BinaryOperator<
  Record<SectionType, SectionToolInteraction>
> = (
  existing = {} as Record<SectionType, SectionToolInteraction>,
  incoming = {} as Record<SectionType, SectionToolInteraction>
) => {
  const result = { ...existing };

  Object.entries(incoming).forEach(([sectionKey, value]) => {
    const section = sectionKey as SectionType;
    if (result[section]) {
      // Merge with existing tool interaction data
      result[section] = {
        ...result[section],
        ...value,
        // Merge messages correctly
        messages:
          value.messages.length > 0
            ? [...result[section].messages, ...value.messages]
            : result[section].messages,
      };
    } else {
      // Add new section tool interaction
      result[section] = value;
    }
  });

  return result;
};

/**
 * Default last value reducer (typesafe)
 */
function lastValueReducer<T>(a: T, b: T | undefined): T {
  return b !== undefined ? b : a;
}

// Custom reducer for planning intelligence that preserves existing data while merging new insights
const planningIntelligenceReducer: BinaryOperator<PlanningIntelligence> = (
  existing: PlanningIntelligence | undefined,
  incoming: Partial<PlanningIntelligence> | undefined
): PlanningIntelligence | undefined => {
  if (!incoming) return existing;
  if (!existing) return incoming as PlanningIntelligence;

  return {
    rfpCharacteristics:
      incoming.rfpCharacteristics || existing.rfpCharacteristics,
    researchIntelligence:
      incoming.researchIntelligence || existing.researchIntelligence,
    industryAnalysis: incoming.industryAnalysis || existing.industryAnalysis,
    competitiveIntel: incoming.competitiveIntel || existing.competitiveIntel,
    requirementAnalysis:
      incoming.requirementAnalysis || existing.requirementAnalysis,
    evaluationPrediction:
      incoming.evaluationPrediction || existing.evaluationPrediction,
    strategicApproach: incoming.strategicApproach || existing.strategicApproach,
    solutionRequirements:
      incoming.solutionRequirements || existing.solutionRequirements,
  };
};

// Custom reducer for user collaboration that accumulates user input over time
const userCollaborationReducer: BinaryOperator<UserCollaboration> = (
  existing: UserCollaboration | undefined,
  incoming: Partial<UserCollaboration> | undefined
): UserCollaboration | undefined => {
  if (!incoming) return existing;
  if (!existing) {
    return {
      strategicPriorities: incoming.strategicPriorities || [],
      competitiveAdvantages: incoming.competitiveAdvantages || [],
      riskFactors: incoming.riskFactors || [],
      userQueries: incoming.userQueries || [],
      expertiseContributions: incoming.expertiseContributions || [],
      feedbackHistory: incoming.feedbackHistory || {},
      preferredApproach: incoming.preferredApproach,
    };
  }

  return {
    strategicPriorities:
      incoming.strategicPriorities || existing.strategicPriorities,
    competitiveAdvantages:
      incoming.competitiveAdvantages || existing.competitiveAdvantages,
    riskFactors: incoming.riskFactors || existing.riskFactors,
    userQueries: [
      ...(existing.userQueries || []),
      ...(incoming.userQueries || []),
    ],
    expertiseContributions: [
      ...(existing.expertiseContributions || []),
      ...(incoming.expertiseContributions || []),
    ],
    feedbackHistory: {
      ...existing.feedbackHistory,
      ...incoming.feedbackHistory,
    },
    preferredApproach: incoming.preferredApproach || existing.preferredApproach,
  };
};

// Custom reducer for adaptive workflow that preserves history while updating current state
const adaptiveWorkflowReducer: BinaryOperator<AdaptiveWorkflow> = (
  existing: AdaptiveWorkflow | undefined,
  incoming: Partial<AdaptiveWorkflow> | undefined
): AdaptiveWorkflow | undefined => {
  if (!incoming) return existing;
  if (!existing) {
    return {
      selectedApproach: incoming.selectedApproach || "standard",
      activeAgentSet: incoming.activeAgentSet || [],
      complexityLevel: incoming.complexityLevel || "moderate",
      skipReasons: incoming.skipReasons || {},
      currentPhase: incoming.currentPhase || "planning",
      phaseCompletionStatus: incoming.phaseCompletionStatus || {},
      adaptationTriggers: incoming.adaptationTriggers || [],
    };
  }

  return {
    selectedApproach: incoming.selectedApproach || existing.selectedApproach,
    activeAgentSet: incoming.activeAgentSet || existing.activeAgentSet,
    complexityLevel: incoming.complexityLevel || existing.complexityLevel,
    skipReasons: { ...existing.skipReasons, ...incoming.skipReasons },
    currentPhase: incoming.currentPhase || existing.currentPhase,
    phaseCompletionStatus: {
      ...existing.phaseCompletionStatus,
      ...incoming.phaseCompletionStatus,
    },
    adaptationTriggers: [
      ...(existing.adaptationTriggers || []),
      ...(incoming.adaptationTriggers || []),
    ],
  };
};

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

  // Sections with custom reducer for proper merging - match interface type
  sections: Annotation<Record<string, ProposalSection>>({
    reducer: sectionsReducer,
    default: () => ({}),
  }),
  requiredSections: Annotation<SectionType[]>({
    reducer: lastValueReducer,
    default: () => [],
  }),

  // Tool interactions per section
  sectionToolMessages: Annotation<Record<SectionType, SectionToolInteraction>>({
    reducer: sectionToolMessagesReducer,
    default: () => ({}) as Record<SectionType, SectionToolInteraction>,
  }),

  // Funder and applicant info
  funder: Annotation<Funder | undefined>({
    reducer: lastValueReducer,
    default: () => undefined,
  }),
  applicant: Annotation<Applicant | undefined>({
    reducer: lastValueReducer,
    default: () => undefined,
  }),
  wordLength: Annotation<WordLength | undefined>({
    reducer: lastValueReducer,
    default: () => undefined,
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

  // Intent
  intent: Annotation<OverallProposalState["intent"] | undefined>({
    reducer: lastValueReducer,
    default: () => undefined,
  }),

  // Enhanced Planning Intelligence
  planningIntelligence: Annotation<PlanningIntelligence | undefined>({
    reducer: planningIntelligenceReducer,
    default: () => undefined,
  }),
  userCollaboration: Annotation<UserCollaboration | undefined>({
    reducer: userCollaborationReducer,
    default: () => undefined,
  }),
  adaptiveWorkflow: Annotation<AdaptiveWorkflow | undefined>({
    reducer: adaptiveWorkflowReducer,
    default: () => undefined,
  }),
  currentPhase: Annotation<"planning" | "writing" | "complete" | undefined>({
    reducer: lastValueReducer,
    default: () => undefined,
  }),

  // Section processing
  sectionDiscoveryStatus: Annotation<ProcessingStatus>({
    reducer: lastValueReducer,
    default: () => ProcessingStatus.NOT_STARTED,
  }),
  currentSectionBeingProcessed: Annotation<string | undefined>({
    reducer: lastValueReducer,
    default: () => undefined,
  }),

  // Evaluation configuration
  evaluationCriteria: Annotation<EvaluationCriteria | undefined>({
    reducer: lastValueReducer,
    default: () => undefined,
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
    // Core identification and metadata
    userId: userId || "",
    sessionId: threadId,
    proposalId: `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: now,
    updatedAt: now,

    // RFP Document - must match RFPDocument interface
    rfpDocument: {
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
    },
    rfpProcessingStatus: ProcessingStatus.NOT_STARTED,

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

    // Sections - must be Record, not Map
    sections: {},
    requiredSections: [],

    // Section processing
    sectionDiscoveryStatus: ProcessingStatus.NOT_STARTED,
    currentSectionBeingProcessed: undefined,

    // Section generation and evaluation
    evaluationStatus: ProcessingStatus.NOT_STARTED,
    evaluationResults: undefined,

    // Enhanced Planning Intelligence
    planningIntelligence: undefined,
    userCollaboration: undefined,
    adaptiveWorkflow: undefined,
    currentPhase: undefined,

    // Tool interactions
    sectionToolMessages: undefined,

    // Funder and applicant info
    funder: undefined,
    applicant: undefined,
    wordLength: undefined,

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
    lastUpdatedAt: now,

    // Intent
    intent: undefined,

    // Evaluation configuration
    evaluationCriteria: undefined,
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
    // TODO: Fix schema compilation issues - temporarily bypassing validation
    // return OverallProposalStateSchema.parse(state as unknown) as OverallProposalState;

    // Basic validation that the required fields exist
    if (!state.userId || !state.sessionId) {
      throw new Error("Missing required state fields: userId and sessionId");
    }

    return state;
  } catch (error) {
    console.error("State validation failed:", error);
    // Re-throw to allow proper error handling
    throw error;
  }
}

// Define a type for accessing the state based on the annotation
export type AnnotatedOverallProposalState =
  typeof ProposalStateAnnotation.State;

export function createInitialProposalState(
  userId: string,
  sessionId: string,
  proposalId?: string
): OverallProposalState {
  const proposalIdToUse =
    proposalId ||
    `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = new Date().toISOString();

  return {
    // Core identification and metadata
    userId,
    sessionId,
    proposalId: proposalIdToUse,
    createdAt: timestamp,
    updatedAt: timestamp,

    // RFP document - must match RFPDocument interface
    rfpDocument: {
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
    },
    rfpProcessingStatus: ProcessingStatus.NOT_STARTED,

    // Research phase
    researchResults: undefined,
    researchStatus: ProcessingStatus.NOT_STARTED,
    researchEvaluation: undefined,

    // Solution sought phase
    solutionResults: undefined,
    solutionStatus: ProcessingStatus.NOT_STARTED,
    solutionEvaluation: undefined,

    // Connection pairs phase
    connections: undefined,
    connectionsStatus: ProcessingStatus.NOT_STARTED,
    connectionsEvaluation: undefined,

    // Section processing - must match Record<string, ProposalSection>
    sections: {},
    sectionDiscoveryStatus: ProcessingStatus.NOT_STARTED,
    currentSectionBeingProcessed: undefined,

    // Section generation and evaluation
    evaluationStatus: ProcessingStatus.NOT_STARTED,
    evaluationResults: undefined,

    // Enhanced Planning Intelligence - with proper helper functions
    planningIntelligence: createInitialPlanningIntelligence(),
    userCollaboration: createInitialUserCollaboration(),
    adaptiveWorkflow: createInitialAdaptiveWorkflow(),
    currentPhase: "planning",

    // Required sections
    requiredSections: [],

    // Tool interaction tracking per section
    sectionToolMessages: undefined,

    // Fields for applicant and funder info
    funder: undefined,
    applicant: undefined,
    wordLength: undefined,

    // HITL Interrupt handling
    interruptStatus: {
      isInterrupted: false,
      interruptionPoint: null,
      feedback: null,
      processingStatus: null,
    },
    interruptMetadata: undefined,
    userFeedback: undefined,

    // Workflow tracking
    currentStep: null,
    activeThreadId: sessionId,

    // Communication and errors
    messages: [],
    errors: [], // Must be string array

    // Chat router fields
    intent: undefined,

    // Evaluation configuration
    evaluationCriteria: undefined,

    // Metadata
    projectName: undefined,
    lastUpdatedAt: timestamp,

    // Status for the overall proposal generation process
    status: ProcessingStatus.NOT_STARTED,
  };
}
