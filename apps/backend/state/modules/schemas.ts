/**
 * Zod schemas for state validation in the proposal generation system
 */
import { z } from "zod";
import {
  SectionType,
  LoadingStatus,
  ProcessingStatus,
  SectionProcessingStatus,
  InterruptReason,
} from "./types.js";

/**
 * Create a Zod schema for the feedback type
 */
export const feedbackTypeSchema = z.enum(["approve", "revise", "regenerate"]);

/**
 * Define the Zod schema for InterruptStatus
 */
export const interruptStatusSchema = z.object({
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
 * Define the evaluation result schema
 */
export const evaluationResultSchema = z.object({
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
});

/**
 * Zod schema for user feedback
 */
export const userFeedbackSchema = z.object({
  type: feedbackTypeSchema,
  comments: z.string().optional(),
  specificEdits: z.record(z.any()).optional(),
  timestamp: z.string(),
});

/**
 * Schema for section data validation
 */
export const sectionDataSchema = z.object({
  id: z.nativeEnum(SectionType),
  title: z.string().optional(),
  content: z.string(),
  status: z.enum([
    "queued",
    "generating",
    "awaiting_review",
    "approved",
    "edited",
    "stale",
    "error",
    "not_started",
    "needs_revision",
  ]),
  evaluation: evaluationResultSchema.nullable().optional(),
  lastUpdated: z.string(),
});

/**
 * Schema for RFP document validation
 */
export const rfpDocumentSchema = z.object({
  id: z.string(),
  fileName: z.string().optional(),
  text: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  status: z.enum(["not_started", "loading", "loaded", "error"]),
});

/**
 * Main Zod schema for validation of proposal state
 */
export const OverallProposalStateSchema = z.object({
  rfpDocument: rfpDocumentSchema,
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
  researchEvaluation: evaluationResultSchema.nullable().optional(),
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
  solutionEvaluation: evaluationResultSchema.nullable().optional(),
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
  connectionsEvaluation: evaluationResultSchema.nullable().optional(),

  // We use a custom validation for the Map type since Zod doesn't have direct Map support
  sections: z
    .custom<Map<SectionType, any>>(
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
  userFeedback: userFeedbackSchema.optional(),

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
