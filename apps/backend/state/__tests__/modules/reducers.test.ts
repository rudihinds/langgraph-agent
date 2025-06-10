/**
 * Tests for the proposal state management reducers
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  sectionsReducer,
  errorsReducer,
  lastValueReducer,
  lastValueWinsReducerStrict,
  createdAtReducer,
  lastUpdatedAtReducer,
  interruptStatusReducer,
} from "../../modules/reducers.js";
import { SectionType, SectionData } from "../../modules/types.js";
import { ProcessingStatus } from "../../modules/constants.js";
import {
  updateSectionData,
  updateSectionStatus,
  addNewSection,
} from "../../modules/reducers.js";

describe("State Reducers Module", () => {
  describe("sectionsReducer", () => {
    it("should add a new section", () => {
      const initialSections = new Map<SectionType, SectionData>();
      const newSection: Partial<SectionData> & { id: SectionType } = {
        id: SectionType.PROBLEM_STATEMENT,
        content: "This is the problem statement",
        status: "queued",
      };

      const result = sectionsReducer(initialSections, newSection);

      expect(result.get(SectionType.PROBLEM_STATEMENT)).toBeDefined();
      expect(result.get(SectionType.PROBLEM_STATEMENT)?.id).toBe(
        SectionType.PROBLEM_STATEMENT
      );
      expect(result.get(SectionType.PROBLEM_STATEMENT)?.content).toBe(
        "This is the problem statement"
      );
      expect(result.get(SectionType.PROBLEM_STATEMENT)?.status).toBe("queued");
      expect(
        result.get(SectionType.PROBLEM_STATEMENT)?.lastUpdated
      ).toBeDefined();
    });

    it("should update an existing section", () => {
      const initialSections = new Map<SectionType, SectionData>([
        [
          SectionType.PROBLEM_STATEMENT,
          {
            id: SectionType.PROBLEM_STATEMENT,
            content: "Initial content",
            status: "queued",
            lastUpdated: "2023-01-01T00:00:00Z",
          },
        ],
      ]);

      const update: Partial<SectionData> & { id: SectionType } = {
        id: SectionType.PROBLEM_STATEMENT,
        content: "New content",
        status: "approved",
      };

      const result = sectionsReducer(initialSections, update);

      expect(result.size).toBe(1);
      expect(result.get(SectionType.PROBLEM_STATEMENT)?.content).toBe(
        "New content"
      );
      expect(result.get(SectionType.PROBLEM_STATEMENT)?.status).toBe(
        "approved"
      );
      expect(result.get(SectionType.PROBLEM_STATEMENT)?.lastUpdated).not.toBe(
        "2023-01-01T00:00:00Z"
      );
    });

    it("should merge multiple sections", () => {
      const initialSections = new Map<SectionType, SectionData>([
        [
          SectionType.PROBLEM_STATEMENT,
          {
            id: SectionType.PROBLEM_STATEMENT,
            content: "Problem statement content",
            status: "approved",
            lastUpdated: "2023-01-01T00:00:00Z",
          },
        ],
      ]);

      const newSections = new Map<SectionType, SectionData>([
        [
          SectionType.METHODOLOGY,
          {
            id: SectionType.METHODOLOGY,
            content: "Methodology content",
            status: "queued",
            lastUpdated: "2023-01-02T00:00:00Z",
          },
        ],
      ]);

      const result = sectionsReducer(initialSections, newSections);

      expect(result.size).toBe(2);
      expect(result.get(SectionType.PROBLEM_STATEMENT)).toEqual(
        initialSections.get(SectionType.PROBLEM_STATEMENT)
      );
      expect(result.get(SectionType.METHODOLOGY)).toEqual(
        newSections.get(SectionType.METHODOLOGY)
      );
    });
  });

  describe("errorsReducer", () => {
    it("should add a string error", () => {
      const initialErrors = ["Error 1"];
      const newError = "Error 2";

      const result = errorsReducer(initialErrors, newError);

      expect(result).toHaveLength(2);
      expect(result).toEqual(["Error 1", "Error 2"]);
    });

    it("should add multiple errors", () => {
      const initialErrors = ["Error 1"];
      const newErrors = ["Error 2", "Error 3"];

      const result = errorsReducer(initialErrors, newErrors);

      expect(result).toHaveLength(3);
      expect(result).toEqual(["Error 1", "Error 2", "Error 3"]);
    });

    it("should work with undefined initial value", () => {
      const result = errorsReducer(undefined, "New error");

      expect(result).toHaveLength(1);
      expect(result[0]).toBe("New error");
    });
  });

  describe("lastValueReducer", () => {
    it("should return the new value", () => {
      expect(lastValueReducer("old", "new")).toBe("new");
    });

    it("should return undefined if new value is undefined", () => {
      expect(lastValueReducer("old", undefined)).toBeUndefined();
    });

    it("should work with different types", () => {
      expect(lastValueReducer(123, "new")).toBe("new");
      expect(lastValueReducer({ a: 1 }, { b: 2 })).toEqual({ b: 2 });
      expect(lastValueReducer([1, 2], [3, 4])).toEqual([3, 4]);
    });
  });

  describe("lastValueWinsReducerStrict", () => {
    it("should return the new value if defined", () => {
      expect(lastValueWinsReducerStrict("old", "new")).toBe("new");
    });

    it("should return the current value if new value is undefined", () => {
      expect(lastValueWinsReducerStrict("old", undefined)).toBe("old");
    });
  });

  describe("createdAtReducer", () => {
    it("should keep the current value if it exists", () => {
      const current = "2023-01-01T00:00:00Z";
      const newValue = "2023-01-02T00:00:00Z";
      expect(createdAtReducer(current, newValue)).toBe(current);
    });

    it("should use the new value if current is undefined", () => {
      const newValue = "2023-01-02T00:00:00Z";
      expect(createdAtReducer(undefined, newValue)).toBe(newValue);
    });
  });

  describe("lastUpdatedAtReducer", () => {
    it("should use the new value if provided", () => {
      const current = "2023-01-01T00:00:00Z";
      const newValue = "2023-01-02T00:00:00Z";
      expect(lastUpdatedAtReducer(current, newValue)).toBe(newValue);
    });

    it("should generate a current timestamp if new value is undefined", () => {
      const current = "2023-01-01T00:00:00Z";
      const result = lastUpdatedAtReducer(current, undefined);

      // Verify it's a valid ISO string and more recent than the current value
      expect(new Date(result).getTime()).toBeGreaterThan(
        new Date(current).getTime()
      );
    });
  });

  describe("interruptStatusReducer", () => {
    it("should return current state if newValue is undefined", () => {
      const current = {
        isInterrupted: true,
        interruptionPoint: "node1",
        feedback: {
          type: "approve",
          content: "feedback",
          timestamp: "2023-01-01T00:00:00Z",
        },
        processingStatus: "pending",
      };

      expect(interruptStatusReducer(current, undefined)).toBe(current);
    });

    it("should merge partial updates", () => {
      const current = {
        isInterrupted: true,
        interruptionPoint: "node1",
        feedback: {
          type: "approve",
          content: "feedback",
          timestamp: "2023-01-01T00:00:00Z",
        },
        processingStatus: "pending",
      };

      const update = {
        isInterrupted: false,
        processingStatus: "processed",
      };

      const result = interruptStatusReducer(current, update);

      expect(result).toEqual({
        isInterrupted: false,
        interruptionPoint: "node1",
        feedback: {
          type: "approve",
          content: "feedback",
          timestamp: "2023-01-01T00:00:00Z",
        },
        processingStatus: "processed",
      });
    });

    it("should handle feedback updates correctly", () => {
      const current = {
        isInterrupted: true,
        interruptionPoint: "node1",
        feedback: {
          type: "approve",
          content: "old feedback",
          timestamp: "2023-01-01T00:00:00Z",
        },
        processingStatus: "pending",
      };

      const update = {
        feedback: {
          type: "revise",
          content: "new feedback",
          timestamp: "2023-01-02T00:00:00Z",
        },
      };

      const result = interruptStatusReducer(current, update);

      expect(result.feedback).toEqual({
        type: "revise",
        content: "new feedback",
        timestamp: "2023-01-02T00:00:00Z",
      });
    });

    it("should handle setting feedback to null", () => {
      const current = {
        isInterrupted: true,
        interruptionPoint: "node1",
        feedback: {
          type: "approve",
          content: "feedback",
          timestamp: "2023-01-01T00:00:00Z",
        },
        processingStatus: "pending",
      };

      const update = {
        feedback: null,
      };

      const result = interruptStatusReducer(current, update);

      expect(result.feedback).toBeNull();
    });
  });

  describe("updateSectionData", () => {
    it("should update an existing section", () => {
      const existingSection: SectionData = {
        id: SectionType.PROBLEM_STATEMENT,
        content: "Original content",
        status: ProcessingStatus.QUEUED,
        lastUpdated: "2023-01-01T00:00:00Z",
      };

      const updateData = {
        id: SectionType.PROBLEM_STATEMENT,
        content: "Updated content",
        status: ProcessingStatus.GENERATING,
      };

      const initialSections: Record<string, SectionData> = {
        [SectionType.PROBLEM_STATEMENT]: existingSection,
      };

      const result = updateSectionData(initialSections, updateData);

      expect(result[SectionType.PROBLEM_STATEMENT].content).toBe(
        "Updated content"
      );
      expect(result[SectionType.PROBLEM_STATEMENT].status).toBe(
        ProcessingStatus.GENERATING
      );
      expect(result[SectionType.PROBLEM_STATEMENT].lastUpdated).not.toBe(
        "2023-01-01T00:00:00Z"
      );
    });

    it("should update status for an existing section", () => {
      const existingSection: SectionData = {
        id: SectionType.PROBLEM_STATEMENT,
        content: "Content",
        status: ProcessingStatus.APPROVED,
        lastUpdated: "2023-01-01T00:00:00Z",
      };

      const initialSections: Record<string, SectionData> = {
        [SectionType.PROBLEM_STATEMENT]: existingSection,
      };

      const result = updateSectionStatus(
        initialSections,
        SectionType.PROBLEM_STATEMENT,
        ProcessingStatus.COMPLETE
      );

      expect(result[SectionType.PROBLEM_STATEMENT].status).toBe(
        ProcessingStatus.COMPLETE
      );
    });

    it("should add a new section", () => {
      const newSections: Record<string, SectionData> = {};

      const result = addNewSection(newSections, {
        id: SectionType.METHODOLOGY,
        content: "New methodology content",
        status: ProcessingStatus.QUEUED,
        lastUpdated: new Date().toISOString(),
      });

      expect(result[SectionType.METHODOLOGY]).toBeDefined();
      expect(result[SectionType.METHODOLOGY].content).toBe(
        "New methodology content"
      );
      expect(result[SectionType.METHODOLOGY].status).toBe(
        ProcessingStatus.QUEUED
      );
    });
  });
});
