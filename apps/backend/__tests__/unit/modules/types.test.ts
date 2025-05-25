/**
 * Tests for the state types module
 */
import { describe, it, expect } from "vitest";
import {
  SectionType,
  InterruptStatus,
  SectionProcessingStatus,
  ProcessingStatus,
  LoadingStatus,
  FeedbackType,
  InterruptReason,
} from "../../modules/types.js";

describe("State Types Module", () => {
  describe("enum and type definitions", () => {
    it("should have SectionType enum defined with expected values", () => {
      expect(SectionType).toBeDefined();
      expect(SectionType.PROBLEM_STATEMENT).toBe("problem_statement");
      expect(SectionType.METHODOLOGY).toBe("methodology");
      expect(SectionType.BUDGET).toBe("budget");
      expect(SectionType.TIMELINE).toBe("timeline");
      expect(SectionType.CONCLUSION).toBe("conclusion");
    });

    // Test type definitions by validating valid values don't cause TypeScript errors
    it("should have LoadingStatus type defined with expected values", () => {
      const validLoadingStatuses: LoadingStatus[] = [
        "not_started",
        "loading",
        "loaded",
        "error",
      ];

      validLoadingStatuses.forEach((status) => {
        // If TypeScript doesn't error, the test passes
        expect(status).toBeDefined();
      });
    });

    it("should have ProcessingStatus type defined with expected values", () => {
      const validProcessingStatuses: ProcessingStatus[] = [
        "queued",
        "running",
        "awaiting_review",
        "approved",
        "edited",
        "stale",
        "complete",
        "error",
        "needs_revision",
      ];

      validProcessingStatuses.forEach((status) => {
        expect(status).toBeDefined();
      });
    });

    it("should have SectionProcessingStatus type defined with expected values", () => {
      const validSectionStatuses: SectionProcessingStatus[] = [
        "queued",
        "generating",
        "awaiting_review",
        "approved",
        "edited",
        "stale",
        "error",
        "not_started",
        "needs_revision",
      ];

      validSectionStatuses.forEach((status) => {
        expect(status).toBeDefined();
      });
    });

    it("should have FeedbackType type defined with expected values", () => {
      const validFeedbackTypes: FeedbackType[] = [
        "approve",
        "revise",
        "regenerate",
      ];

      validFeedbackTypes.forEach((type) => {
        expect(type).toBeDefined();
      });
    });

    it("should have InterruptReason type defined with expected values", () => {
      const validInterruptReasons: InterruptReason[] = [
        "EVALUATION_NEEDED",
        "CONTENT_REVIEW",
        "ERROR_OCCURRED",
      ];

      validInterruptReasons.forEach((reason) => {
        expect(reason).toBeDefined();
      });
    });
  });

  describe("interface structures", () => {
    it("should allow creating a valid InterruptStatus object", () => {
      const validInterruptStatus: InterruptStatus = {
        isInterrupted: true,
        interruptionPoint: "evaluateResearch",
        feedback: {
          type: "approve",
          content: "Looks good",
          timestamp: new Date().toISOString(),
        },
        processingStatus: "pending",
      };

      expect(validInterruptStatus.isInterrupted).toBe(true);
      expect(validInterruptStatus.interruptionPoint).toBe("evaluateResearch");
      expect(validInterruptStatus.feedback?.type).toBe("approve");
    });

    it("should allow creating a valid InterruptStatus with null values", () => {
      const validInterruptStatus: InterruptStatus = {
        isInterrupted: false,
        interruptionPoint: null,
        feedback: null,
        processingStatus: null,
      };

      expect(validInterruptStatus.isInterrupted).toBe(false);
      expect(validInterruptStatus.interruptionPoint).toBeNull();
      expect(validInterruptStatus.feedback).toBeNull();
      expect(validInterruptStatus.processingStatus).toBeNull();
    });
  });
});
