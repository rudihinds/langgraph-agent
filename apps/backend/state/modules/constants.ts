/**
 * Centralized constants and enums for the proposal generation system
 * These replace string literal unions with proper enums for type safety and consistency
 */

/**
 * Status definitions for the loading state of resources
 */
export enum LoadingStatus {
  NOT_STARTED = "not_started",
  LOADING = "loading",
  LOADED = "loaded",
  ERROR = "error",
}

/**
 * Status definitions for the overall processing state of proposal components
 * Streamlined to better align with LangGraph node execution boundaries
 */
export enum ProcessingStatus {
  NOT_STARTED = "not_started", // Initial state
  RUNNING = "running", // Work in progress (combines LOADING/RUNNING)
  READY_FOR_EVALUATION = "ready_for_evaluation", // Generated but not evaluated
  AWAITING_REVIEW = "awaiting_review", // Evaluated, waiting for user
  APPROVED = "approved", // User approved
  EDITED = "edited", // User edited
  STALE = "stale", // Dependency changed, needs attention
  COMPLETE = "complete", // Final state
  ERROR = "error", // Error occurred
}

/**
 * Types of feedback that can be provided by users
 */
export enum FeedbackType {
  APPROVE = "approve",
  REVISE = "revise",
  REGENERATE = "regenerate",
}

/**
 * Reasons for interrupting the proposal generation flow
 */
export enum InterruptReason {
  EVALUATION_NEEDED = "EVALUATION_NEEDED",
  CONTENT_REVIEW = "CONTENT_REVIEW",
  ERROR_OCCURRED = "ERROR_OCCURRED",
}

/**
 * Section types for the proposal
 * Aligned with the sections defined in dependencies.json
 */
export enum SectionType {
  PROBLEM_STATEMENT = "problem_statement",
  ORGANIZATIONAL_CAPACITY = "organizational_capacity",
  SOLUTION = "solution",
  IMPLEMENTATION_PLAN = "implementation_plan",
  EVALUATION_APPROACH = "evaluation_approach",
  BUDGET = "budget",
  EXECUTIVE_SUMMARY = "executive_summary",
  CONCLUSION = "conclusion",
}

/**
 * Processing status for interrupt handling
 */
export enum InterruptProcessingStatus {
  PENDING = "pending",
  PROCESSED = "processed",
  FAILED = "failed",
}
