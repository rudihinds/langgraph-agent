import { BaseMessage } from "@langchain/core/messages";
import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { z } from "zod";
import {
  ConnectionPair,
  ResearchData,
  SolutionRequirements,
  SectionContent,
  EvaluationResult,
  connectionPairsReducer,
  proposalSectionsReducer,
  ConnectionPairSchema,
  ResearchDataSchema,
  SolutionRequirementsSchema,
  SectionContentSchema,
  EvaluationResultSchema,
} from "./reducers.js";

/**
 * Workflow phase for tracking the current stage of proposal development
 */
type WorkflowPhase =
  | "research"
  | "solution_analysis"
  | "connection_pairs"
  | "section_generation"
  | "evaluation"
  | "revision"
  | "complete";

/**
 * User feedback for interactive improvements and revisions
 */
interface UserFeedback {
  targetSection?: string;
  feedback: string;
  requestedChanges?: string[];
  timestamp: string;
}

/**
 * Define the state using the new Annotation API with specialized reducers
 */
export const ProposalStateAnnotation = Annotation.Root({
  // Messages with special reducer for handling message history
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  // Document content
  rfpDocument: Annotation<string | undefined>({
    value: (existing, newValue) => newValue ?? existing,
    default: () => undefined,
  }),

  // Basic funder information
  funderInfo: Annotation<string | undefined>({
    value: (existing, newValue) => newValue ?? existing,
    default: () => undefined,
  }),

  // Structured research data with custom value function
  research: Annotation<ResearchData | null>({
    value: (existing, newValue) => {
      if (!existing && !newValue) return null;
      if (!existing) return newValue;
      if (!newValue) return existing;

      return {
        keyFindings: [
          ...new Set([
            ...existing.keyFindings,
            ...(newValue.keyFindings || []),
          ]),
        ],
        funderPriorities: [
          ...new Set([
            ...existing.funderPriorities,
            ...(newValue.funderPriorities || []),
          ]),
        ],
        fundingHistory: newValue.fundingHistory || existing.fundingHistory,
        relevantProjects:
          newValue.relevantProjects || existing.relevantProjects,
        competitiveAnalysis:
          newValue.competitiveAnalysis || existing.competitiveAnalysis,
        additionalNotes: newValue.additionalNotes || existing.additionalNotes,
      };
    },
    default: () => null,
  }),

  // Structured solution requirements with custom value function
  solutionSought: Annotation<SolutionRequirements | null>({
    value: (existing, newValue) => {
      if (!existing && !newValue) return null;
      if (!existing) return newValue;
      if (!newValue) return existing;

      return {
        primaryGoals: [
          ...new Set([
            ...existing.primaryGoals,
            ...(newValue.primaryGoals || []),
          ]),
        ],
        secondaryObjectives: [
          ...new Set([
            ...(existing.secondaryObjectives || []),
            ...(newValue.secondaryObjectives || []),
          ]),
        ],
        constraints: [
          ...new Set([
            ...existing.constraints,
            ...(newValue.constraints || []),
          ]),
        ],
        successMetrics: [
          ...new Set([
            ...existing.successMetrics,
            ...(newValue.successMetrics || []),
          ]),
        ],
        preferredApproaches: [
          ...new Set([
            ...(existing.preferredApproaches || []),
            ...(newValue.preferredApproaches || []),
          ]),
        ],
        explicitExclusions: [
          ...new Set([
            ...(existing.explicitExclusions || []),
            ...(newValue.explicitExclusions || []),
          ]),
        ],
      };
    },
    default: () => null,
  }),

  // Connection pairs with deduplication reducer
  connectionPairs: Annotation<ConnectionPair[]>({
    value: connectionPairsReducer,
    default: () => [],
  }),

  // Proposal sections with versioning reducer
  proposalSections: Annotation<Record<string, SectionContent>>({
    value: proposalSectionsReducer,
    default: () => ({}),
  }),

  // Evaluation results for sections
  evaluations: Annotation<Record<string, EvaluationResult>>({
    value: (existing, newValue) => ({ ...existing, ...newValue }),
    default: () => ({}),
  }),

  // Current section being worked on
  currentSection: Annotation<string | undefined>({
    value: (existing, newValue) => newValue ?? existing,
    default: () => undefined,
  }),

  // Current phase of the workflow
  currentPhase: Annotation<WorkflowPhase>({
    value: (existing, newValue) => newValue ?? existing,
    default: () => "research",
  }),

  // User feedback with timestamp
  userFeedback: Annotation<UserFeedback | undefined>({
    value: (existing, newValue) => newValue ?? existing,
    default: () => undefined,
  }),

  // Metadata for tracking and persistence
  metadata: Annotation<Record<string, any>>({
    value: (existing, newValue) => ({ ...existing, ...newValue }),
    default: () => ({
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      proposalId: "",
      userId: "",
      proposalTitle: "",
    }),
  }),

  // Track sections impacted by revisions
  sectionsImpactedByRevision: Annotation<Record<string, string[]>>({
    value: (existing, newValue) => ({ ...existing, ...newValue }),
    default: () => ({}),
  }),
});

/**
 * Define a type for accessing the state
 */
export type ProposalState = typeof ProposalStateAnnotation.State;

/**
 * Comprehensive Zod schema for validating proposal state (for external validation)
 */
export const ProposalStateSchema = z.object({
  messages: z.array(z.any()),
  rfpDocument: z.string().optional(),
  funderInfo: z.string().optional(),
  research: ResearchDataSchema.nullable(),
  solutionSought: SolutionRequirementsSchema.nullable(),
  connectionPairs: z.array(ConnectionPairSchema),
  proposalSections: z.record(z.string(), SectionContentSchema),
  evaluations: z.record(z.string(), EvaluationResultSchema),
  currentSection: z.string().optional(),
  currentPhase: z.enum([
    "research",
    "solution_analysis",
    "connection_pairs",
    "section_generation",
    "evaluation",
    "revision",
    "complete",
  ]),
  userFeedback: z
    .object({
      targetSection: z.string().optional(),
      feedback: z.string(),
      requestedChanges: z.array(z.string()).optional(),
      timestamp: z.string(),
    })
    .optional(),
  metadata: z.record(z.string(), z.any()),
  sectionsImpactedByRevision: z.record(z.string(), z.array(z.string())),
});
