/**
 * State definition for the proposal generation system
 * Based on the architecture specified in AGENT_ARCHITECTURE.md
 */
import { BaseMessage } from "@langchain/core/messages";
import { z } from "zod";
import {
  Annotation,
  messagesStateReducer,
  StateDefinition,
} from "@langchain/langgraph";

/**
 * Status definitions for different components of the proposal state
 */
type LoadingStatus = "not_started" | "loading" | "loaded" | "error";
type ProcessingStatus =
  | "queued"
  | "running"
  | "awaiting_review"
  | "approved"
  | "edited"
  | "stale"
  | "complete"
  | "error"
  | "needs_revision";
export type SectionProcessingStatus =
  | "queued"
  | "generating"
  | "awaiting_review"
  | "approved"
  | "edited"
  | "stale"
  | "error"
  | "not_started"
  | "needs_revision";

/**
 * Section types enumeration for typed section references
 */
export enum SectionType {
  PROBLEM_STATEMENT = "problem_statement",
  METHODOLOGY = "methodology",
  BUDGET = "budget",
  TIMELINE = "timeline",
  CONCLUSION = "conclusion",
}

/**
 * Evaluation result structure for quality checks
 */
interface EvaluationResult {
  score: number;
  passed: boolean;
  feedback: string;
  categories?: {
    [category: string]: {
      score: number;
      feedback: string;
    };
  };
}

/**
 * Structure for individual proposal sections
 */
export interface SectionData {
  id: string;
  title?: string;
  content: string;
  status: SectionProcessingStatus;
  evaluation?: EvaluationResult | null;
  lastUpdated: string;
}

/**
 * Main state interface for the proposal generation system
 * Extends StateDefinition to satisfy LangGraph requirements
 */
interface ProposalState extends StateDefinition {
  // Document handling
  rfpDocument: {
    id: string;
    fileName?: string;
    text?: string;
    metadata?: Record<string, any>;
    status: LoadingStatus;
  };

  // Research phase
  researchResults?: Record<string, any>;
  researchStatus: ProcessingStatus;
  researchEvaluation?: EvaluationResult | null;

  // Solution sought phase
  solutionResults?: Record<string, any>;
  solutionStatus: ProcessingStatus;
  solutionEvaluation?: EvaluationResult | null;

  // Connection pairs phase
  connections?: any[];
  connectionsStatus: ProcessingStatus;
  connectionsEvaluation?: EvaluationResult | null;

  // Proposal sections
  sections: Map<SectionType, SectionData>;
  requiredSections: SectionType[];

  // Workflow tracking
  currentStep: string | null;
  activeThreadId: string;

  // Communication and errors
  messages: BaseMessage[];
  errors: string[];

  // Metadata
  projectName?: string;
  userId?: string;
  createdAt: string;
  lastUpdatedAt: string;

  // Status for the overall proposal generation process
  status: ProcessingStatus;

  // Index signature for StateDefinition compatibility
  [key: string]: any;
}

/**
 * Custom reducer for sections map
 * Handles merging of section data with proper immutability
 */
export function sectionsReducer(
  currentValue: Map<SectionType, SectionData> | undefined,
  newValue:
    | Map<SectionType, SectionData>
    | ({ id: SectionType } & Partial<SectionData>)
): Map<SectionType, SectionData> {
  // Initialize with current value or empty map
  const current = currentValue || new Map<SectionType, SectionData>();
  const result = new Map(current);

  // If newValue is a Partial<SectionData> with an id, it's a single section update
  if ("id" in newValue && typeof newValue.id === "string") {
    const update = newValue as { id: SectionType } & Partial<SectionData>;
    const sectionId = update.id;
    const existingSection = current.get(sectionId);

    // Create a new merged section
    const updatedSection: SectionData = existingSection
      ? { ...existingSection, ...update, lastUpdated: new Date().toISOString() }
      : {
          id: sectionId,
          content: update.content || "",
          status: update.status || "queued",
          lastUpdated: update.lastUpdated || new Date().toISOString(),
        };

    // Update the map with the new section
    result.set(sectionId, updatedSection);
    return result;
  }

  // Otherwise, it's a map to merge with
  if (newValue instanceof Map) {
    newValue.forEach((value, key) => {
      result.set(key, value);
    });
  }

  return result;
}

/**
 * Custom reducer for errors array
 * Ensures new errors are always appended
 */
export function errorsReducer(
  currentValue: string[] | undefined,
  newValue: string | string[]
): string[] {
  const current = currentValue || [];

  if (typeof newValue === "string") {
    return [...current, newValue];
  }

  return [...current, ...newValue];
}

// Generic "last value wins" reducer - typed more explicitly
function lastValueReducer<T>(
  _currentValue: T | undefined,
  newValue: T | undefined // Allow undefined new value
): T | undefined {
  return newValue;
}

// Reducer for createdAt - only takes the first value
function createdAtReducer(
  currentValue: string | undefined,
  newValue: string | undefined
): string | undefined {
  return currentValue ?? newValue; // If currentValue exists, keep it; otherwise, use newValue
}

// Reducer for lastUpdatedAt - always takes the new value or current time
function lastUpdatedAtReducer(
  _currentValue: string | undefined,
  newValue: string | undefined
): string {
  return newValue ?? new Date().toISOString(); // Use newValue if provided, otherwise current time
}

/**
 * LangGraph State Annotation Definition
 * Maps the ProposalState interface fields to LangGraph annotations
 * and specifies custom reducers where necessary.
 */
export const ProposalStateAnnotation = Annotation.Root<ProposalState>({
  // Document handling: Use generic reducer, default to not_started
  rfpDocument: Annotation<ProposalState["rfpDocument"]>({
    reducer: lastValueReducer as any,
    default: () => ({ id: "", status: "not_started" as LoadingStatus }),
  }),

  // Research phase: Use generic reducer, default undefined/queued
  researchResults: Annotation<ProposalState["researchResults"]>({
    reducer: lastValueReducer as any,
    default: () => undefined,
  }),
  researchStatus: Annotation<ProposalState["researchStatus"]>({
    reducer: lastValueReducer as any,
    default: () => "queued" as ProcessingStatus,
  }),
  researchEvaluation: Annotation<ProposalState["researchEvaluation"]>({
    reducer: lastValueReducer as any,
    default: () => undefined,
  }),

  // Solution sought phase: Use generic reducer, default undefined/queued
  solutionResults: Annotation<ProposalState["solutionResults"]>({
    reducer: lastValueReducer as any,
    default: () => undefined,
  }),
  solutionStatus: Annotation<ProposalState["solutionStatus"]>({
    reducer: lastValueReducer as any,
    default: () => "queued" as ProcessingStatus,
  }),
  solutionEvaluation: Annotation<ProposalState["solutionEvaluation"]>({
    reducer: lastValueReducer as any,
    default: () => undefined,
  }),

  // Connection pairs phase: Use generic reducer, default undefined/queued
  connections: Annotation<ProposalState["connections"]>({
    reducer: lastValueReducer as any,
    default: () => undefined,
  }),
  connectionsStatus: Annotation<ProposalState["connectionsStatus"]>({
    reducer: lastValueReducer as any,
    default: () => "queued" as ProcessingStatus,
  }),
  connectionsEvaluation: Annotation<ProposalState["connectionsEvaluation"]>({
    reducer: lastValueReducer as any,
    default: () => undefined,
  }),

  // Proposal sections: Use specific reducer, default empty map
  sections: Annotation<ProposalState["sections"]>({
    reducer: sectionsReducer,
    default: () => new Map<SectionType, SectionData>(),
  }),
  // Required sections: Use generic reducer, default empty array
  requiredSections: Annotation<ProposalState["requiredSections"]>({
    reducer: lastValueReducer as any,
    default: () => [] as SectionType[],
  }),

  // Workflow tracking: Use generic reducer, default null/empty
  currentStep: Annotation<ProposalState["currentStep"]>({
    reducer: lastValueReducer as any,
    default: () => null,
  }),
  activeThreadId: Annotation<ProposalState["activeThreadId"]>({
    reducer: lastValueReducer as any,
    default: () => "",
  }),

  // Communication and errors: Use specific reducers, default empty arrays
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [] as BaseMessage[],
  }),
  errors: Annotation<ProposalState["errors"]>({
    reducer: errorsReducer,
    default: () => [] as string[],
  }),

  // Metadata: Use generic reducer, default undefined/timestamps
  projectName: Annotation<ProposalState["projectName"]>({
    reducer: lastValueReducer as any,
    default: () => undefined,
  }),
  userId: Annotation<ProposalState["userId"]>({
    reducer: lastValueReducer as any,
    default: () => undefined,
  }),
  createdAt: Annotation<ProposalState["createdAt"]>({
    reducer: createdAtReducer as any,
    default: () => new Date().toISOString(),
  }),
  lastUpdatedAt: Annotation<ProposalState["lastUpdatedAt"]>({
    reducer: lastUpdatedAtReducer as any,
    default: () => new Date().toISOString(),
  }),

  // Overall status: Use generic reducer, default queued
  status: Annotation<ProposalState["status"]>({
    reducer: lastValueReducer as any,
    default: () => "queued" as ProcessingStatus,
  }),
});

/**
 * Zod schema for validation of proposal state
 */
const ProposalStateSchema = z.object({
  rfpDocument: z.object({
    id: z.string(),
    fileName: z.string().optional(),
    text: z.string().optional(),
    metadata: z.record(z.any()).optional(),
    status: z.enum(["not_started", "loading", "loaded", "error"]),
  }),
  researchResults: z.record(z.any()).optional(),
  researchStatus: z.enum([
    "queued",
    "running",
    "awaiting_review",
    "approved",
    "edited",
    "stale",
    "complete",
    "error",
    "needs_revision",
  ]),
  researchEvaluation: z
    .object({
      score: z.number(),
      passed: z.boolean(),
      feedback: z.string(),
      categories: z
        .record(
          z.object({
            score: z.number(),
            feedback: z.string(),
          })
        )
        .optional(),
    })
    .nullable()
    .optional(),
  solutionResults: z.record(z.any()).optional(),
  solutionStatus: z.enum([
    "queued",
    "running",
    "awaiting_review",
    "approved",
    "edited",
    "stale",
    "complete",
    "error",
    "needs_revision",
  ]),
  solutionEvaluation: z
    .object({
      score: z.number(),
      passed: z.boolean(),
      feedback: z.string(),
      categories: z
        .record(
          z.object({
            score: z.number(),
            feedback: z.string(),
          })
        )
        .optional(),
    })
    .nullable()
    .optional(),
  connections: z.array(z.any()).optional(),
  connectionsStatus: z.enum([
    "queued",
    "running",
    "awaiting_review",
    "approved",
    "edited",
    "stale",
    "complete",
    "error",
    "needs_revision",
  ]),
  connectionsEvaluation: z
    .object({
      score: z.number(),
      passed: z.boolean(),
      feedback: z.string(),
      categories: z
        .record(
          z.object({
            score: z.number(),
            feedback: z.string(),
          })
        )
        .optional(),
    })
    .nullable()
    .optional(),
  // We use a custom validation for the Map type since Zod doesn't have direct Map support
  sections: z
    .custom<Map<SectionType, SectionData>>(
      (val) => val instanceof Map,
      "Sections must be a Map object."
    )
    .refine(
      (map) => {
        // Validate each entry in the map
        for (const [key, value] of map.entries()) {
          // 1. Validate Key: Check if the key is a valid SectionType enum value
          if (!Object.values(SectionType).includes(key as SectionType)) {
            return false; // Invalid key
          }

          // 2. Validate Value: Check if the value conforms to SectionData structure
          //    (We can do basic checks or use a nested Zod schema for SectionData if needed)
          if (
            !value ||
            typeof value.id !== "string" ||
            value.id !== key || // Ensure section id matches the map key
            typeof value.content !== "string" ||
            typeof value.status !== "string" || // Basic check for status string
            !Object.values(SectionProcessingStatus).includes(
              value.status as SectionProcessingStatus
            ) || // Check if status is valid enum value
            typeof value.lastUpdated !== "string" ||
            (value.evaluation !== undefined &&
              value.evaluation !== null &&
              typeof value.evaluation.score !== "number") // Basic check for evaluation
          ) {
            return false; // Invalid value structure
          }
        }
        return true; // All entries are valid
      },
      {
        message:
          "Sections Map contains invalid keys (must be SectionType) or values (must conform to SectionData).",
      }
    ),
  requiredSections: z.array(z.nativeEnum(SectionType)),
  currentStep: z.string().nullable(),
  activeThreadId: z.string(),
  messages: z.array(z.any()), // BaseMessage is complex to validate with Zod
  errors: z.array(z.string()),
  projectName: z.string().optional(),
  userId: z.string().optional(),
  createdAt: z.string(),
  lastUpdatedAt: z.string(),
  status: z.enum([
    "queued",
    "running",
    "awaiting_review",
    "approved",
    "edited",
    "stale",
    "complete",
    "error",
    "needs_revision",
  ]),
});

/**
 * Create a new initial state with default values
 */
export function createInitialProposalState(
  threadId: string,
  userId?: string,
  projectName?: string
): ProposalState {
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
 * @returns The validated state or throws error if invalid
 */
export function validateProposalState(state: ProposalState): ProposalState {
  return ProposalStateSchema.parse(state);
}
