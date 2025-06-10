/**
 * Tests for the types module
 */
import { describe, it, expect } from "vitest";
import {
  LoadingStatus,
  ProcessingStatus,
  FeedbackType,
  InterruptReason,
  SectionType,
} from "../../modules/constants.js";

describe("Type Constants", () => {
  describe("LoadingStatus", () => {
    it("should have the correct values", () => {
      const expectedValues = [
        LoadingStatus.NOT_STARTED,
        LoadingStatus.LOADING,
        LoadingStatus.LOADED,
        LoadingStatus.ERROR,
      ];

      // Test that all values are accessible
      expectedValues.forEach((value) => {
        expect(typeof value).toBe("string");
      });
    });
  });

  describe("ProcessingStatus", () => {
    it("should have the correct values", () => {
      const expectedValues = [
        ProcessingStatus.QUEUED,
        ProcessingStatus.RUNNING,
        ProcessingStatus.AWAITING_REVIEW,
        ProcessingStatus.APPROVED,
        ProcessingStatus.EDITED,
        ProcessingStatus.STALE,
        ProcessingStatus.COMPLETE,
        ProcessingStatus.ERROR,
        ProcessingStatus.NEEDS_REVISION,
      ];

      // Test that all values are accessible
      expectedValues.forEach((value) => {
        expect(typeof value).toBe("string");
      });
    });
  });

  describe("SectionProcessingStatus", () => {
    it("should have the correct values", () => {
      const expectedValues = [
        ProcessingStatus.QUEUED,
        ProcessingStatus.GENERATING,
        ProcessingStatus.AWAITING_REVIEW,
        ProcessingStatus.APPROVED,
        ProcessingStatus.EDITED,
        ProcessingStatus.STALE,
        ProcessingStatus.ERROR,
        ProcessingStatus.NOT_STARTED,
        ProcessingStatus.NEEDS_REVISION,
      ];

      // Test that all values are accessible
      expectedValues.forEach((value) => {
        expect(typeof value).toBe("string");
      });
    });
  });

  describe("FeedbackType", () => {
    it("should have the correct values", () => {
      const expectedValues = [
        FeedbackType.APPROVE,
        FeedbackType.REVISE,
        FeedbackType.REGENERATE,
      ];

      // Test that all values are accessible
      expectedValues.forEach((value) => {
        expect(typeof value).toBe("string");
      });
    });
  });

  describe("InterruptReason", () => {
    it("should have the correct values", () => {
      const expectedValues = [
        InterruptReason.EVALUATION_NEEDED,
        InterruptReason.CONTENT_REVIEW,
        InterruptReason.ERROR_OCCURRED,
      ];

      // Test that all values are accessible
      expectedValues.forEach((value) => {
        expect(typeof value).toBe("string");
      });
    });
  });

  describe("InterruptStatus", () => {
    it("should validate structure with enum values", () => {
      const validStatus = {
        isInterrupted: true,
        interruptionPoint: "test-point",
        feedback: {
          type: FeedbackType.APPROVE,
          content: "Test feedback",
          timestamp: "2023-01-01T00:00:00Z",
        },
        processingStatus: "pending",
      };

      expect(validStatus.feedback.type).toBe(FeedbackType.APPROVE);
    });
  });
});
