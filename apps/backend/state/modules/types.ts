/**
 * Type definitions for the proposal generation system
 */
import { BaseMessage } from "@langchain/core/messages";
import {
  LoadingStatus,
  ProcessingStatus,
  SectionStatus as SectionProcessingStatus,
  FeedbackType,
  InterruptReason,
  SectionType,
  InterruptProcessingStatus,
} from "./constants.js";

/**
 * Status definitions for different components of the proposal state
 */
// These type exports maintain backward compatibility while we transition to enums
export { LoadingStatus, ProcessingStatus, SectionProcessingStatus };

/**
 * Interrupt-related type definitions for HITL capabilities
 */
export { InterruptReason, FeedbackType };

/**
 * Data structure to track interrupt status
 */
export interface InterruptStatus {
  isInterrupted: boolean;
  interruptionPoint: string | null;
  feedback: {
    type: FeedbackType | null;
    content: string | null;
    timestamp: string | null;
  } | null;
  processingStatus: InterruptProcessingStatus | null;
}

/**
 * Metadata about an interrupt event
 */
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
export { SectionType };

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
  previousStatus?: SectionProcessingStatus;
  evaluation?: EvaluationResult | null;
  lastUpdated: string;
  lastError?: string;
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
