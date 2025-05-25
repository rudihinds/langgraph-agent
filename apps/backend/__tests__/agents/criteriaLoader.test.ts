import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  loadCriteria,
  evaluationCriteriaSchema,
  getDefaultCriteriaPath,
  formatCriteriaForPrompt,
} from "../criteriaLoader.js";

// Mock fs and path modules
vi.mock("fs", () => ({
  promises: {
    readFile: vi.fn(),
    access: vi.fn(),
  },
}));

vi.mock("path", () => ({
  isAbsolute: vi.fn(),
  resolve: vi.fn((_, ...segments) => segments.join("/")),
  join: vi.fn(),
}));

describe("criteriaLoader utility", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default mock for path.isAbsolute
    vi.mocked(path.isAbsolute).mockReturnValue(false);
    // Initialize console.warn mock
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("loadCriteria function", () => {
    it("should load and validate valid criteria from a JSON file", async () => {
      // Mock valid criteria JSON
      const validCriteria = {
        contentType: "research",
        passingThreshold: 0.7,
        criteria: [
          {
            id: "relevance",
            name: "Relevance",
            description: "Content is relevant to the topic",
            passingThreshold: 0.7,
            weight: 0.3,
            isCritical: true,
          },
          {
            id: "accuracy",
            name: "Accuracy",
            description: "Information is factually accurate",
            passingThreshold: 0.8,
            weight: 0.7,
            isCritical: false,
          },
        ],
        instructions: "Evaluate based on these criteria",
      };

      // Mock readFile to return our valid criteria
      vi.mocked(fs.promises.readFile).mockResolvedValue(
        JSON.stringify(validCriteria)
      );

      const result = await loadCriteria("path/to/criteria.json");

      expect(fs.promises.readFile).toHaveBeenCalledWith(
        "path/to/criteria.json",
        "utf-8"
      );
      expect(result).toEqual(validCriteria);
      expect(console.warn).not.toHaveBeenCalled();
    });

    it("should throw an error if the file is not found", async () => {
      // Mock ENOENT error
      const error = new Error("File not found") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      vi.mocked(fs.promises.readFile).mockRejectedValue(error);

      await expect(loadCriteria("nonexistent.json")).rejects.toThrow(
        "Criteria file not found"
      );
    });

    it("should throw an error if the JSON format is invalid", async () => {
      vi.mocked(fs.promises.readFile).mockResolvedValue("invalid json");

      await expect(loadCriteria("invalid.json")).rejects.toThrow();
    });

    it("should throw a validation error if criteria schema is invalid", async () => {
      // Missing required fields
      const invalidCriteria = {
        contentType: "research",
        // Missing passingThreshold
        criteria: [
          {
            // Missing id
            name: "Relevance",
            description: "Content is relevant to the topic",
            // Other fields present
            passingThreshold: 0.7,
            weight: 0.5,
          },
        ],
      };

      vi.mocked(fs.promises.readFile).mockResolvedValue(
        JSON.stringify(invalidCriteria)
      );

      await expect(loadCriteria("invalid-schema.json")).rejects.toThrow(
        "Invalid criteria format"
      );
    });

    it("should warn if weights do not sum to 1.0", async () => {
      const criteriaWithBadWeights = {
        contentType: "research",
        passingThreshold: 0.7,
        criteria: [
          {
            id: "relevance",
            name: "Relevance",
            description: "Content is relevant to the topic",
            passingThreshold: 0.7,
            weight: 0.3,
            isCritical: true,
          },
          {
            id: "accuracy",
            name: "Accuracy",
            description: "Information is factually accurate",
            passingThreshold: 0.8,
            weight: 0.3, // Sum will be 0.6, not 1.0
            isCritical: false,
          },
        ],
      };

      vi.mocked(fs.promises.readFile).mockResolvedValue(
        JSON.stringify(criteriaWithBadWeights)
      );

      const result = await loadCriteria("criteria-bad-weights.json");

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("Sum of weights (0.6) is not 1.0")
      );
      expect(result).toEqual(criteriaWithBadWeights);
    });

    it("should use absolute path if provided", async () => {
      const validCriteria = {
        contentType: "research",
        passingThreshold: 0.7,
        criteria: [
          {
            id: "relevance",
            name: "Relevance",
            description: "Description",
            passingThreshold: 0.7,
            weight: 1.0,
            isCritical: false,
          },
        ],
      };

      vi.mocked(path.isAbsolute).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(
        JSON.stringify(validCriteria)
      );

      await loadCriteria("/absolute/path/criteria.json");

      expect(fs.promises.readFile).toHaveBeenCalledWith(
        "/absolute/path/criteria.json",
        "utf-8"
      );
    });
  });

  describe("getDefaultCriteriaPath function", () => {
    it("should return the correct default path for a content type", () => {
      const result = getDefaultCriteriaPath("Research");

      expect(result).toBe("config/evaluation/research_criteria.json");
      expect(path.resolve).toHaveBeenCalled();
    });

    it("should convert content type to lowercase", () => {
      const result = getDefaultCriteriaPath("SOLUTION");

      expect(result).toBe("config/evaluation/solution_criteria.json");
    });
  });

  describe("formatCriteriaForPrompt function", () => {
    it("should format criteria into a readable prompt string", () => {
      const criteria = {
        contentType: "Research",
        passingThreshold: 0.75,
        criteria: [
          {
            id: "relevance",
            name: "Relevance",
            description: "Evaluates how relevant the content is",
            passingThreshold: 0.7,
            weight: 0.4,
            isCritical: true,
          },
          {
            id: "accuracy",
            name: "Accuracy",
            description: "Checks factual accuracy",
            passingThreshold: 0.8,
            weight: 0.6,
            isCritical: false,
          },
        ],
        instructions: "Use these criteria to evaluate the research",
      };

      const result = formatCriteriaForPrompt(criteria);

      // Check that the result contains key elements
      expect(result).toContain("# Evaluation Criteria for Research");
      expect(result).toContain("Use these criteria to evaluate the research");
      expect(result).toContain("### Relevance (relevance) [CRITICAL]");
      expect(result).toContain("### Accuracy (accuracy)");
      expect(result).toContain("Weight: 40%");
      expect(result).toContain("Weight: 60%");
      expect(result).toContain("Overall passing threshold: 75%");
    });

    it("should handle optional instructions field", () => {
      const criteriaWithoutInstructions = {
        contentType: "Solution",
        passingThreshold: 0.8,
        criteria: [
          {
            id: "test",
            name: "Test",
            description: "Test description",
            passingThreshold: 0.7,
            weight: 1.0,
            isCritical: false,
          },
        ],
      };

      const result = formatCriteriaForPrompt(criteriaWithoutInstructions);

      expect(result).toContain("# Evaluation Criteria for Solution");
      expect(result).toContain("### Test (test)");
      expect(result).not.toContain("[CRITICAL]");
      expect(result).toContain("Weight: 100%");
    });
  });
});
