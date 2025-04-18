/**
 * LangGraph state annotations for the proposal generation system
 */
import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import {
  OverallProposalState,
  InterruptStatus,
  SectionType,
  SectionData,
  InterruptMetadata,
  UserFeedback,
  ProcessingStatus,
  LoadingStatus,
  EvaluationResult,
} from "./types.js";
import {
  sectionsReducer,
  errorsReducer,
  lastValueReducer,
  lastValueWinsReducerStrict,
  createdAtReducer,
  lastUpdatedAtReducer,
  interruptStatusReducer,
} from "./reducers.js";

/**
 * State annotations for proposal generation, defining default values and reducers
 * Using the newer Annotation.Root pattern for improved type safety and consistency
 */
export const OverallProposalStateAnnotation =
  Annotation.Root<OverallProposalState>({
    // Document handling
    rfpDocument: Annotation<{
      id: string;
      fileName?: string;
      text?: string;
      metadata?: Record<string, any>;
      status: LoadingStatus;
    }>({
      default: () => ({
        id: "",
        status: "not_started" as LoadingStatus,
      }),
      value: (existing, newValue) => ({ ...existing, ...newValue }),
    }),

    // Research phase
    researchResults: Annotation<Record<string, any> | undefined>({
      default: () => undefined,
      value: (existing, newValue) => newValue ?? existing,
    }),
    researchStatus: Annotation<ProcessingStatus>({
      default: () => "queued",
      value: lastValueWinsReducerStrict,
    }),
    researchEvaluation: Annotation<EvaluationResult | null | undefined>({
      default: () => undefined,
      value: lastValueReducer,
    }),

    // Solution sought phase
    solutionResults: Annotation<Record<string, any> | undefined>({
      default: () => undefined,
      value: (existing, newValue) => newValue ?? existing,
    }),
    solutionStatus: Annotation<ProcessingStatus>({
      default: () => "queued",
      value: lastValueWinsReducerStrict,
    }),
    solutionEvaluation: Annotation<EvaluationResult | null | undefined>({
      default: () => undefined,
      value: lastValueReducer,
    }),

    // Connection pairs phase
    connections: Annotation<any[] | undefined>({
      default: () => undefined,
      value: (existing, newValue) => newValue ?? existing,
    }),
    connectionsStatus: Annotation<ProcessingStatus>({
      default: () => "queued",
      value: lastValueWinsReducerStrict,
    }),
    connectionsEvaluation: Annotation<EvaluationResult | null | undefined>({
      default: () => undefined,
      value: lastValueReducer,
    }),

    // Proposal sections
    sections: Annotation<Map<SectionType, SectionData>>({
      default: () => new Map(),
      value: sectionsReducer,
    }),
    requiredSections: Annotation<SectionType[]>({
      default: () => [],
      value: (existing, newValue) => newValue ?? existing,
    }),

    // HITL Interrupt handling
    interruptStatus: Annotation<InterruptStatus>({
      default: () => ({
        isInterrupted: false,
        interruptionPoint: null,
        feedback: null,
        processingStatus: null,
      }),
      value: interruptStatusReducer,
    }),
    interruptMetadata: Annotation<InterruptMetadata | undefined>({
      default: () => undefined,
      value: (existing, newValue) => newValue ?? existing,
    }),
    userFeedback: Annotation<UserFeedback | undefined>({
      default: () => undefined,
      value: (existing, newValue) => newValue ?? existing,
    }),

    // Workflow tracking
    currentStep: Annotation<string | null>({
      default: () => null,
      value: (existing, newValue) => newValue ?? existing,
    }),
    activeThreadId: Annotation<string>({
      // No default as this is required at creation time
      value: (existing, newValue) => newValue ?? existing,
    }),

    // Communication and errors
    messages: Annotation<BaseMessage[]>({
      default: () => [],
      reducer: messagesStateReducer,
    }),
    errors: Annotation<string[]>({
      default: () => [],
      value: errorsReducer,
    }),

    // Metadata
    projectName: Annotation<string | undefined>({
      default: () => undefined,
      value: lastValueReducer,
    }),
    userId: Annotation<string | undefined>({
      default: () => undefined,
      value: lastValueReducer,
    }),
    createdAt: Annotation<string>({
      default: () => new Date().toISOString(),
      value: createdAtReducer,
    }),
    lastUpdatedAt: Annotation<string>({
      default: () => new Date().toISOString(),
      value: lastUpdatedAtReducer,
    }),

    // Status for the overall proposal generation process
    status: Annotation<ProcessingStatus>({
      default: () => "queued",
      value: lastValueWinsReducerStrict,
    }),
  });

// Define a type for accessing the state based on the annotation
export type AnnotatedOverallProposalState =
  typeof OverallProposalStateAnnotation.State;
