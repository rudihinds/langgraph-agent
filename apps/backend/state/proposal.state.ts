/**
 * State definition for the proposal generation system
 * Based on the architecture specified in AGENT_ARCHITECTURE.md
 */
import { BaseMessage } from "@langchain/core/messages";
import { z } from "zod";
import { Annotation, messagesStateReducer } from "@langchain/langgraph";

/**
 * Status definitions for different components of the proposal state
 */
export type LoadingStatus = 'not_started' | 'loading' | 'loaded' | 'error';
export type ProcessingStatus = 'queued' | 'running' | 'awaiting_review' | 'approved' | 'edited' | 'stale' | 'complete' | 'error';
export type SectionProcessingStatus = 'queued' | 'generating' | 'awaiting_review' | 'approved' | 'edited' | 'stale' | 'error';

/**
 * Evaluation result structure for quality checks
 */
export interface EvaluationResult {
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
  solutionSoughtResults?: Record<string, any>;
  solutionSoughtStatus: ProcessingStatus;
  solutionSoughtEvaluation?: EvaluationResult | null;

  // Connection pairs phase
  connectionPairs?: any[];
  connectionPairsStatus: ProcessingStatus;
  connectionPairsEvaluation?: EvaluationResult | null;

  // Proposal sections
  sections: { [sectionId: string]: SectionData | undefined };
  requiredSections: string[];
  
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
}

/**
 * Custom reducer for sections map
 * Handles merging of section data with proper immutability
 */
export function sectionsReducer(
  currentValue: { [sectionId: string]: SectionData | undefined } | undefined,
  newValue: { [sectionId: string]: SectionData | undefined } | Partial<SectionData>
): { [sectionId: string]: SectionData | undefined } {
  // Initialize with current value or empty object
  const current = currentValue || {};
  
  // If newValue is a Partial<SectionData> with an id, it's a single section update
  if ('id' in newValue) {
    const update = newValue as Partial<SectionData>;
    const sectionId = update.id;
    const existingSection = current[sectionId];
    
    // Create a new merged section
    const updatedSection = existingSection 
      ? { ...existingSection, ...update, lastUpdated: new Date().toISOString() }
      : { 
          id: sectionId,
          content: update.content || '',
          status: update.status || 'queued',
          lastUpdated: update.lastUpdated || new Date().toISOString(),
        };
    
    // Return new state with updated section
    return {
      ...current,
      [sectionId]: updatedSection,
    };
  }
  
  // Otherwise, it's a map of sections to merge/replace
  return {
    ...current,
    ...newValue,
  };
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
  
  if (typeof newValue === 'string') {
    return [...current, newValue];
  }
  
  return [...current, ...newValue];
}

/**
 * Zod schema for validation of overall proposal state
 */
export const OverallProposalStateSchema = z.object({
  rfpDocument: z.object({
    id: z.string(),
    fileName: z.string().optional(),
    text: z.string().optional(),
    metadata: z.record(z.any()).optional(),
    status: z.enum(['not_started', 'loading', 'loaded', 'error']),
  }),
  researchResults: z.record(z.any()).optional(),
  researchStatus: z.enum([
    'queued', 'running', 'awaiting_review', 'approved', 'edited', 'stale', 'complete', 'error'
  ]),
  researchEvaluation: z.object({
    score: z.number(),
    passed: z.boolean(),
    feedback: z.string(),
    categories: z.record(z.object({
      score: z.number(),
      feedback: z.string(),
    })).optional(),
  }).nullable().optional(),
  solutionSoughtResults: z.record(z.any()).optional(),
  solutionSoughtStatus: z.enum([
    'queued', 'running', 'awaiting_review', 'approved', 'edited', 'stale', 'complete', 'error'
  ]),
  solutionSoughtEvaluation: z.object({
    score: z.number(),
    passed: z.boolean(),
    feedback: z.string(),
    categories: z.record(z.object({
      score: z.number(),
      feedback: z.string(),
    })).optional(),
  }).nullable().optional(),
  connectionPairs: z.array(z.any()).optional(),
  connectionPairsStatus: z.enum([
    'queued', 'running', 'awaiting_review', 'approved', 'edited', 'stale', 'complete', 'error'
  ]),
  connectionPairsEvaluation: z.object({
    score: z.number(),
    passed: z.boolean(),
    feedback: z.string(),
    categories: z.record(z.object({
      score: z.number(),
      feedback: z.string(),
    })).optional(),
  }).nullable().optional(),
  sections: z.record(z.object({
    id: z.string(),
    title: z.string().optional(),
    content: z.string(),
    status: z.enum([
      'queued', 'generating', 'awaiting_review', 'approved', 'edited', 'stale', 'error'
    ]),
    evaluation: z.object({
      score: z.number(),
      passed: z.boolean(),
      feedback: z.string(),
      categories: z.record(z.object({
        score: z.number(),
        feedback: z.string(),
      })).optional(),
    }).nullable().optional(),
    lastUpdated: z.string(),
  }).optional()),
  requiredSections: z.array(z.string()),
  currentStep: z.string().nullable(),
  activeThreadId: z.string(),
  messages: z.array(z.any()), // BaseMessage is complex to validate with Zod
  errors: z.array(z.string()),
  projectName: z.string().optional(),
  userId: z.string().optional(),
  createdAt: z.string(),
  lastUpdatedAt: z.string(),
});

/**
 * LangGraph State Annotation Definition for OverallProposalState
 * Defines how state should be updated by nodes in the graph
 */
export const ProposalStateAnnotation = Annotation.Root<OverallProposalState>({
  // Messages use the built-in messages reducer
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
  }),
  
  // Sections need custom handling for immutable updates
  sections: Annotation<{ [sectionId: string]: SectionData | undefined }>({
    reducer: sectionsReducer,
  }),
  
  // Errors should be accumulated
  errors: Annotation<string[]>({
    reducer: errorsReducer,
  }),
  
  // Simple value replacement for other fields
  rfpDocument: Annotation(),
  researchResults: Annotation(),
  researchStatus: Annotation(),
  researchEvaluation: Annotation(),
  solutionSoughtResults: Annotation(),
  solutionSoughtStatus: Annotation(),
  solutionSoughtEvaluation: Annotation(),
  connectionPairs: Annotation(),
  connectionPairsStatus: Annotation(),
  connectionPairsEvaluation: Annotation(),
  requiredSections: Annotation(),
  currentStep: Annotation(),
  activeThreadId: Annotation(),
  projectName: Annotation(),
  userId: Annotation(),
  createdAt: Annotation(),
  lastUpdatedAt: Annotation(),
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
      id: '',
      status: 'not_started',
    },
    researchStatus: 'queued',
    solutionSoughtStatus: 'queued',
    connectionPairsStatus: 'queued',
    sections: {},
    requiredSections: [],
    currentStep: null,
    activeThreadId: threadId,
    messages: [],
    errors: [],
    userId,
    projectName,
    createdAt: timestamp,
    lastUpdatedAt: timestamp,
  };
}

/**
 * Validate state against schema
 * @returns The validated state or throws error if invalid
 */
export function validateProposalState(state: OverallProposalState): OverallProposalState {
  return OverallProposalStateSchema.parse(state);
}