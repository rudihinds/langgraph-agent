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
 * Types of feedback that can be provided by users during HITL interrupts
 */
export enum FeedbackType {
  /**
   * Content is approved as-is and can proceed to the next stage
   */
  APPROVE = "approve",

  /**
   * Content needs revision but not complete regeneration
   */
  REVISE = "revise",

  /**
   * Content should be completely regenerated
   */
  REGENERATE = "regenerate",
}
