/**
 * Centralized constants and enums for the proposal generation system
 * These replace string literal unions with proper enums for type safety and consistency
 */

/**
 * Status definitions for a section's processing state
 */
export enum SectionStatus {
  NOT_STARTED = "not_started",
  QUEUED = "queued",
  GENERATING = "generating",
  AWAITING_REVIEW = "awaiting_review",
  APPROVED = "approved",
  EDITED = "edited",
  STALE = "stale",
  ERROR = "error",
  NEEDS_REVISION = "needs_revision",
}

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
 */
export enum ProcessingStatus {
  NOT_STARTED = "not_started",
  LOADING = "loading",
  LOADED = "loaded",
  QUEUED = "queued",
  RUNNING = "running",
  AWAITING_REVIEW = "awaiting_review",
  APPROVED = "approved",
  EDITED = "edited",
  STALE = "stale",
  COMPLETE = "complete",
  ERROR = "error",
  NEEDS_REVISION = "needs_revision",
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
 */
export enum SectionType {
  PROBLEM_STATEMENT = "problem_statement",
  METHODOLOGY = "methodology",
  SOLUTION = "solution",
  OUTCOMES = "outcomes",
  BUDGET = "budget",
  TIMELINE = "timeline",
  TEAM = "team",
  EVALUATION_PLAN = "evaluation_plan",
  SUSTAINABILITY = "sustainability",
  RISKS = "risks",
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
