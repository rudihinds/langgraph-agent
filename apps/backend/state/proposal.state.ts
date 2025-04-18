/**
 * State definition for the proposal generation system
 * Based on the architecture specified in AGENT_ARCHITECTURE.md
 * This file defines the OverallProposalState interface and associated types/annotations
 *
 * @module proposal.state
 */

import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import { z } from "zod";
import { OverallProposalStateAnnotation } from "./modules/annotations.js";

// Re-export all types from modular files
export * from "./modules/types.js";
export * from "./modules/reducers.js";
export * from "./modules/schemas.js";
export * from "./modules/annotations.js";
export * from "./modules/utils.js";

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
 * Interrupt-related type definitions for HITL capabilities
 */
export type InterruptReason =
  | "EVALUATION_NEEDED"
  | "CONTENT_REVIEW"
  | "ERROR_OCCURRED";

/**
 * Types of feedback that can be provided by users
 */
export type FeedbackType = "approve" | "revise" | "regenerate";

/**
 * Data structure to track interrupt status
 */
interface InterruptStatus {
  isInterrupted: boolean;
  interruptionPoint: string | null;
  feedback: {
    type: FeedbackType | null;
    content: string | null;
    timestamp: string | null;
  } | null;
  processingStatus: "pending" | "processed" | "failed" | null;
}

export interface InterruptMetadata {
  reason: InterruptReason;
  nodeId: string;
  timestamp: string;
  contentReference?: string; // Section ID or content type being evaluated
  evaluationResult?: any;
}

/**
 * Interface for user feedback structure
 */
export interface UserFeedback {
  type: FeedbackType;
  comments?: string;
  specificEdits?: Record<string, any>;
  timestamp: string;
}

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
 */
export interface OverallProposalState {
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

  // HITL Interrupt handling
  interruptStatus: InterruptStatus;
  interruptMetadata?: InterruptMetadata;
  userFeedback?: UserFeedback;

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

/**
 * Reducer that always takes the last value provided.
 * Allows undefined as a valid new value, returning undefined if newValue is undefined.
 */
export function lastValueReducer<T>(
  _currentValue: T | undefined,
  newValue: T | undefined
): T | undefined {
  return newValue;
}

/**
 * Stricter "last value wins" reducer for non-optional fields.
 * Returns the current value if the new value is undefined, ensuring the field type is maintained.
 */
export function lastValueWinsReducerStrict<T>(
  currentValue: T, // Expects current value to be non-undefined too
  newValue: T | undefined
): T {
  if (newValue === undefined) {
    // Return current value when undefined is passed
    return currentValue;
  }
  return newValue;
}

// Reducer for createdAt - only takes the first value
export function createdAtReducer(
  currentValue: string | undefined,
  newValue: string | undefined
): string | undefined {
  return currentValue ?? newValue; // If currentValue exists, keep it; otherwise, use newValue
}

// Reducer for lastUpdatedAt - always takes the new value or current time
export function lastUpdatedAtReducer(
  _currentValue: string | undefined,
  newValue: string | undefined
): string {
  return newValue ?? new Date().toISOString(); // Use newValue if provided, otherwise current time
}

// Create a Zod schema for the feedback type
const feedbackTypeSchema = z.enum(["approve", "revise", "regenerate"]);

// Define the Zod schema for InterruptStatus
const interruptStatusSchema = z.object({
  isInterrupted: z.boolean(),
  interruptionPoint: z.string().nullable(),
  feedback: z
    .object({
      type: feedbackTypeSchema.nullable(),
      content: z.string().nullable(),
      timestamp: z.string().nullable(),
    })
    .nullable(),
  processingStatus: z.enum(["pending", "processed", "failed"]).nullable(),
});

/**
 * Zod schema for validation of proposal state
 */
export const OverallProposalStateSchema = z.object({
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

  // HITL interrupt validation
  interruptStatus: interruptStatusSchema,
  interruptMetadata: z
    .object({
      reason: z.enum(["EVALUATION_NEEDED", "CONTENT_REVIEW", "ERROR_OCCURRED"]),
      nodeId: z.string(),
      timestamp: z.string(),
      contentReference: z.string().optional(),
      evaluationResult: z.any().optional(),
    })
    .optional(),
  userFeedback: z
    .object({
      type: feedbackTypeSchema,
      comments: z.string().optional(),
      specificEdits: z.record(z.any()).optional(),
      timestamp: z.string(),
    })
    .optional(),

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
 * @returns The validated state or throws error if invalid
 */
export function validateProposalState(
  state: OverallProposalState
): OverallProposalState {
  return OverallProposalStateSchema.parse(state);
}

// Define a type for accessing the state based on the annotation
export type AnnotatedOverallProposalState =
  typeof OverallProposalStateAnnotation.State;
