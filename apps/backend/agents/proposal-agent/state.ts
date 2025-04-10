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
  researchDataReducer,
  solutionRequirementsReducer,
  ConnectionPairSchema,
  ResearchDataSchema,
  SolutionRequirementsSchema,
  SectionContentSchema,
  EvaluationResultSchema
} from "./reducers";

/**
 * Workflow phase for tracking the current stage of proposal development
 */
export type WorkflowPhase = 
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
export interface UserFeedback {
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
    default: () => undefined,
  }),
  
  // Basic funder information
  funderInfo: Annotation<string | undefined>({
    default: () => undefined,
  }),
  
  // Structured research data with specialized reducer
  research: Annotation<ResearchData | null>({
    reducer: researchDataReducer,
    default: () => null,
  }),
  
  // Structured solution requirements with specialized reducer
  solutionSought: Annotation<SolutionRequirements | null>({
    reducer: solutionRequirementsReducer,
    default: () => null,
  }),
  
  // Connection pairs with deduplication reducer
  connectionPairs: Annotation<ConnectionPair[]>({
    reducer: connectionPairsReducer,
    default: () => [],
  }),
  
  // Proposal sections with versioning reducer
  proposalSections: Annotation<Record<string, SectionContent>>({
    reducer: proposalSectionsReducer,
    default: () => ({}),
  }),
  
  // Evaluation results for sections
  evaluations: Annotation<Record<string, EvaluationResult>>({
    default: () => ({}),
  }),
  
  // Current section being worked on
  currentSection: Annotation<string | undefined>({
    default: () => undefined,
  }),
  
  // Current phase of the workflow
  currentPhase: Annotation<WorkflowPhase>({
    default: () => "research",
  }),
  
  // User feedback with timestamp
  userFeedback: Annotation<UserFeedback | undefined>({
    default: () => undefined,
  }),
  
  // Metadata for tracking and persistence
  metadata: Annotation<Record<string, any>>({
    default: () => ({
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      proposalId: "",
      userId: "",
      proposalTitle: "",
    }),
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
    "complete"
  ]),
  userFeedback: z.object({
    targetSection: z.string().optional(),
    feedback: z.string(),
    requestedChanges: z.array(z.string()).optional(),
    timestamp: z.string(),
  }).optional(),
  metadata: z.record(z.string(), z.any()),
});