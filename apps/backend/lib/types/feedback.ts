/**
 * Feedback types for Human-in-the-Loop interactions
 *
 * This enum is used throughout the application for consistent handling of user feedback:
 * - In the OrchestratorService for processing feedback submissions
 * - In the proposal agent nodes for updating content status based on feedback
 * - In API schemas for validating feedback submissions
 * - In conditionals for routing after feedback processing
 */

/**
 * Types of feedback that can be provided by users
 */
export enum FeedbackType {
  APPROVE = "approve",
  REVISE = "revise",
  REGENERATE = "regenerate",
}

/**
 * Possible content types that can receive feedback
 */
export enum ContentType {
  SECTION = "section",
  RESEARCH = "research",
  ENTIRE_PROPOSAL = "entireProposal",
  EVALUATION = "evaluation",
}

/**
 * Feedback submission interface
 */
export interface FeedbackSubmission {
  proposalId: string;
  feedbackType: FeedbackType;
  contentRef?: string;
  comment?: string;
}

/**
 * Feedback status response interface
 */
export interface FeedbackStatus {
  success: boolean;
  message: string;
  contentRef?: string;
  processingStatus?: string;
  error?: string;
}

/**
 * Feedback data structure submitted by users during HITL interrupts
 */
export interface UserFeedback {
  /**
   * The type of feedback provided
   */
  type: FeedbackType;

  /**
   * Optional comments provided with the feedback
   */
  comments?: string;

  /**
   * Timestamp when the feedback was submitted
   */
  timestamp: string;

  /**
   * Optional specific edits for revision feedback
   */
  specificEdits?: Record<string, unknown>;
}
