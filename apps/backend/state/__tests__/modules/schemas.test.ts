/**
 * Tests for the state schemas module
 */
import { describe, it, expect } from "vitest";
import {
  interruptStatusSchema,
  OverallProposalStateSchema,
  rfpDocumentSchema,
  sectionDataSchema,
} from "../../modules/schemas.js";
import { SectionType } from "../../modules/types.js";

describe("State Schemas Module", () => {
  describe("interruptStatusSchema", () => {
    it("should validate a valid interrupt status", () => {
      const validStatus = {
        isInterrupted: true,
        interruptionPoint: "evaluateResearch",
        feedback: {
          type: "approve",
          content: "Looks good",
          timestamp: "2023-01-01T00:00:00Z",
        },
        processingStatus: "pending",
      };

      const result = interruptStatusSchema.safeParse(validStatus);
      expect(result.success).toBe(true);
    });

    it("should validate with nulls", () => {
      const validStatus = {
        isInterrupted: false,
        interruptionPoint: null,
        feedback: null,
        processingStatus: null,
      };

      const result = interruptStatusSchema.safeParse(validStatus);
      expect(result.success).toBe(true);
    });

    it("should fail with missing required fields", () => {
      const invalidStatus = {
        interruptionPoint: "node1",
        // Missing required fields
      };

      const result = interruptStatusSchema.safeParse(invalidStatus);
      expect(result.success).toBe(false);
    });

    it("should fail with invalid feedback type", () => {
      const invalidStatus = {
        isInterrupted: true,
        interruptionPoint: "evaluateResearch",
        feedback: {
          type: "invalid_type", // Invalid feedback type
          content: "Feedback",
          timestamp: "2023-01-01T00:00:00Z",
        },
        processingStatus: "pending",
      };

      const result = interruptStatusSchema.safeParse(invalidStatus);
      expect(result.success).toBe(false);
    });
  });

  describe("sectionDataSchema", () => {
    it("should validate a valid section data", () => {
      const validSection = {
        id: SectionType.PROBLEM_STATEMENT,
        content: "Problem statement content",
        status: "approved",
        lastUpdated: "2023-01-01T00:00:00Z",
      };

      const result = sectionDataSchema.safeParse(validSection);
      expect(result.success).toBe(true);
    });

    it("should validate with optional fields", () => {
      const validSection = {
        id: SectionType.PROBLEM_STATEMENT,
        title: "Problem Statement",
        content: "Problem statement content",
        status: "approved",
        evaluation: {
          score: 8,
          passed: true,
          feedback: "Good section",
        },
        lastUpdated: "2023-01-01T00:00:00Z",
      };

      const result = sectionDataSchema.safeParse(validSection);
      expect(result.success).toBe(true);
    });

    it("should fail with invalid status", () => {
      const invalidSection = {
        id: SectionType.PROBLEM_STATEMENT,
        content: "Problem statement content",
        status: "invalid_status", // Invalid status
        lastUpdated: "2023-01-01T00:00:00Z",
      };

      const result = sectionDataSchema.safeParse(invalidSection);
      expect(result.success).toBe(false);
    });
  });

  describe("rfpDocumentSchema", () => {
    it("should validate a valid RFP document", () => {
      const validDoc = {
        id: "doc-123",
        status: "loaded",
      };

      const result = rfpDocumentSchema.safeParse(validDoc);
      expect(result.success).toBe(true);
    });

    it("should validate with optional fields", () => {
      const validDoc = {
        id: "doc-123",
        fileName: "rfp.pdf",
        text: "RFP content",
        metadata: { pages: 10 },
        status: "loaded",
      };

      const result = rfpDocumentSchema.safeParse(validDoc);
      expect(result.success).toBe(true);
    });

    it("should fail with invalid status", () => {
      const invalidDoc = {
        id: "doc-123",
        status: "unknown", // Invalid status
      };

      const result = rfpDocumentSchema.safeParse(invalidDoc);
      expect(result.success).toBe(false);
    });
  });

  describe("overallProposalStateSchema", () => {
    it("should validate a minimal valid state", () => {
      const minimalState = {
        rfpDocument: {
          id: "doc-123",
          status: "not_started",
        },
        researchStatus: "queued",
        solutionStatus: "queued",
        connectionsStatus: "queued",
        sections: new Map(),
        requiredSections: [],
        interruptStatus: {
          isInterrupted: false,
          interruptionPoint: null,
          feedback: null,
          processingStatus: null,
        },
        currentStep: null,
        activeThreadId: "thread-123",
        messages: [],
        errors: [],
        createdAt: "2023-01-01T00:00:00Z",
        lastUpdatedAt: "2023-01-01T00:00:00Z",
        status: "queued",
      };

      // We need to convert the Map to a plain object for Zod
      const stateForZod = {
        ...minimalState,
        sections: {},
      };

      const result = OverallProposalStateSchema.safeParse(stateForZod);
      expect(result.success).toBe(true);
    });

    it("should fail with missing required fields", () => {
      const invalidState = {
        rfpDocument: {
          id: "doc-123",
          status: "not_started",
        },
        // Missing many required fields
      };

      const result = OverallProposalStateSchema.safeParse(invalidState);
      expect(result.success).toBe(false);
    });
  });
});
