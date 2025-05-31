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
  QUEUED = "queued", // Ready to run but waiting its turn/dependency
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
  EDIT = "edit",
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
  EVALUATION = "evaluation_approach",
  BUDGET = "budget",
  EXECUTIVE_SUMMARY = "executive_summary",
  CONCLUSION = "conclusion",
  STAKEHOLDER_ANALYSIS = "stakeholder_analysis",
}

/**
 * Processing status for interrupt handling
 */
export enum InterruptProcessingStatus {
  PENDING = "pending",
  PROCESSED = "processed",
  FAILED = "failed",
}

// Enhanced Planning Intelligence enums
export enum ComplexityLevel {
  SIMPLE = "Simple",
  MEDIUM = "Medium",
  COMPLEX = "Complex",
}

export enum TimelinePressure {
  LOW = "Low",
  MEDIUM = "Medium",
  HIGH = "High",
}

export enum StrategicImportance {
  HIGH = "High",
  MEDIUM = "Medium",
  LOW = "Low",
}

export enum UserValidation {
  CONFIRMED = "confirmed",
  CORRECTED = "corrected",
  UNKNOWN = "unknown",
}

export enum ConfidenceLevel {
  HIGH = "High",
  MEDIUM = "Medium",
  LOW = "Low",
}

export enum RiskLevel {
  CRITICAL = "critical",
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low",
}

export enum ProposalApproach {
  STANDARD = "standard",
  ACCELERATED = "accelerated",
  COMPREHENSIVE = "comprehensive",
  MINIMAL = "minimal",
}

export enum AgentRole {
  RFP_ANALYZER = "rfp_analyzer",
  INDUSTRY_RESEARCHER = "industry_researcher",
  COMPETITOR_ANALYST = "competitor_analyst",
  REQUIREMENTS_ANALYST = "requirements_analyst",
  STRATEGY_PLANNER = "strategy_planner",
  SOLUTION_ARCHITECT = "solution_architect",
  USER_COLLABORATOR = "user_collaborator",
}

// Adaptive workflow constants
export const PHASE_STATUSES = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  SKIPPED: "skipped",
} as const;

export type PhaseStatus = (typeof PHASE_STATUSES)[keyof typeof PHASE_STATUSES];

// Current phase options
export const PHASES = {
  PLANNING: "planning",
  WRITING: "writing",
  COMPLETE: "complete",
} as const;

export type Phase = (typeof PHASES)[keyof typeof PHASES];

// Complexity level options for adaptive workflow
export const COMPLEXITY_LEVELS = {
  MINIMAL: "minimal",
  MODERATE: "moderate",
  COMPREHENSIVE: "comprehensive",
} as const;

export type WorkflowComplexityLevel =
  (typeof COMPLEXITY_LEVELS)[keyof typeof COMPLEXITY_LEVELS];
