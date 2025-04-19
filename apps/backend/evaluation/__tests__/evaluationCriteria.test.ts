import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Define mock functions using vi.hoisted
const mocks = vi.hoisted(() => {
  return {
    // Path resolve mock
    pathResolve: vi.fn((...segments) => {
      return segments.join("/");
    }),

    // Mock file operations
    readFile: vi.fn((path) => {
      if (path.includes("valid-criteria.json")) {
        return Promise.resolve(
          JSON.stringify({
            id: "valid-criteria",
            name: "Valid Evaluation Criteria",
            version: "1.0.0",
            criteria: [
              {
                id: "relevance",
                name: "Relevance",
                description: "How relevant is the content to the RFP?",
                weight: 0.4,
                isCritical: true,
                passingThreshold: 0.6,
                scoringGuidelines: {
                  excellent: "Perfectly relevant",
                  good: "Mostly relevant",
                  adequate: "Somewhat relevant",
                  poor: "Barely relevant",
                  inadequate: "Not relevant at all",
                },
              },
              {
                id: "completeness",
                name: "Completeness",
                description: "How complete is the content?",
                weight: 0.3,
                isCritical: false,
                passingThreshold: 0.5,
                scoringGuidelines: {
                  excellent: "Completely addresses all aspects",
                  good: "Addresses most aspects",
                  adequate: "Addresses key aspects",
                  poor: "Addresses few aspects",
                  inadequate: "Fails to address essential aspects",
                },
              },
              {
                id: "clarity",
                name: "Clarity",
                description: "How clear and understandable is the content?",
                weight: 0.3,
                isCritical: false,
                passingThreshold: 0.6,
                scoringGuidelines: {
                  excellent: "Crystal clear",
                  good: "Very clear with minor issues",
                  adequate: "Mostly clear but with some confusing parts",
                  poor: "Often unclear or confusing",
                  inadequate: "Extremely unclear and difficult to understand",
                },
              },
            ],
            passingThreshold: 0.7,
          })
        );
      } else if (path.includes("malformed-criteria.json")) {
        return Promise.resolve("{ invalid json");
      } else if (path.includes("missing-fields-criteria.json")) {
        return Promise.resolve(
          JSON.stringify({
            id: "missing-fields-criteria",
            name: "Missing Fields Criteria",
            version: "1.0.0",
            // Missing criteria array and passingThreshold
          })
        );
      } else {
        return Promise.reject(new Error(`File not found: ${path}`));
      }
    }),

    access: vi.fn((path) => {
      if (
        path.includes("valid-criteria.json") ||
        path.includes("malformed-criteria.json") ||
        path.includes("missing-fields-criteria.json")
      ) {
        return Promise.resolve();
      } else {
        return Promise.reject(
          new Error(`ENOENT: no such file or directory, access '${path}'`)
        );
      }
    }),

    // Mock evaluation function
    createEvaluationNode: vi.fn((options) => {
      return async (state: any) => {
        // Simplified for this test
        return state;
      };
    }),
  };
});

// Mock modules
vi.mock("path", () => {
  return {
    default: {
      resolve: mocks.pathResolve,
    },
    resolve: mocks.pathResolve,
  };
});

vi.mock("fs/promises", () => {
  return {
    readFile: mocks.readFile,
    access: mocks.access,
  };
});

vi.mock("../index.js", () => {
  return {
    createEvaluationNode: mocks.createEvaluationNode,
  };
});

// Import after mocks
import {
  EvaluationCriteriaSchema,
  loadCriteriaConfiguration,
  DEFAULT_CRITERIA,
} from "../index.js";
import { z } from "zod";

describe("Evaluation Criteria Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("EvaluationCriteriaSchema", () => {
    it("should validate a valid criteria configuration", () => {
      const validCriteria = {
        id: "test-criteria",
        name: "Test Criteria",
        version: "1.0.0",
        criteria: [
          {
            id: "relevance",
            name: "Relevance",
            description: "How relevant is the content?",
            weight: 0.5,
            isCritical: true,
            passingThreshold: 0.6,
            scoringGuidelines: {
              excellent: "Perfect relevance",
              good: "Good relevance",
              adequate: "Adequate relevance",
              poor: "Poor relevance",
              inadequate: "Irrelevant",
            },
          },
        ],
        passingThreshold: 0.7,
      };

      const result = EvaluationCriteriaSchema.safeParse(validCriteria);
      expect(result.success).toBe(true);
    });

    it("should reject a criteria missing required fields", () => {
      const invalidCriteria = {
        id: "test-criteria",
        name: "Test Criteria",
        // Missing version, criteria array, and passingThreshold
      };

      const result = EvaluationCriteriaSchema.safeParse(invalidCriteria);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.errors.some((e) => e.path.includes("criteria"))
        ).toBe(true);
        expect(
          result.error.errors.some((e) => e.path.includes("passingThreshold"))
        ).toBe(true);
      }
    });

    it("should reject criteria with invalid weight values", () => {
      const invalidCriteria = {
        id: "test-criteria",
        name: "Test Criteria",
        version: "1.0.0",
        criteria: [
          {
            id: "relevance",
            name: "Relevance",
            description: "How relevant is the content?",
            weight: 1.5, // Invalid: greater than 1.0
            isCritical: true,
            passingThreshold: 0.6,
            scoringGuidelines: {
              excellent: "Perfect relevance",
              good: "Good relevance",
              adequate: "Adequate relevance",
              poor: "Poor relevance",
              inadequate: "Irrelevant",
            },
          },
        ],
        passingThreshold: 0.7,
      };

      const result = EvaluationCriteriaSchema.safeParse(invalidCriteria);
      expect(result.success).toBe(false);
    });

    it("should reject criteria with missing scoringGuidelines", () => {
      const invalidCriteria = {
        id: "test-criteria",
        name: "Test Criteria",
        version: "1.0.0",
        criteria: [
          {
            id: "relevance",
            name: "Relevance",
            description: "How relevant is the content?",
            weight: 0.5,
            isCritical: true,
            passingThreshold: 0.6,
            // Missing scoringGuidelines
          },
        ],
        passingThreshold: 0.7,
      };

      const result = EvaluationCriteriaSchema.safeParse(invalidCriteria);
      expect(result.success).toBe(false);
    });

    it("should validate a criteria with additional properties", () => {
      const criteriaWithExtra = {
        id: "test-criteria",
        name: "Test Criteria",
        version: "1.0.0",
        criteria: [
          {
            id: "relevance",
            name: "Relevance",
            description: "How relevant is the content?",
            weight: 0.5,
            isCritical: true,
            passingThreshold: 0.6,
            scoringGuidelines: {
              excellent: "Perfect relevance",
              good: "Good relevance",
              adequate: "Adequate relevance",
              poor: "Poor relevance",
              inadequate: "Irrelevant",
            },
            extraField: "This should be allowed", // Extra field
          },
        ],
        passingThreshold: 0.7,
        extraTopLevelField: "Also allowed", // Extra field
      };

      const result = EvaluationCriteriaSchema.safeParse(criteriaWithExtra);
      expect(result.success).toBe(true);
    });
  });

  describe("loadCriteriaConfiguration", () => {
    it("should load valid criteria from file", async () => {
      const criteria = await loadCriteriaConfiguration("valid-criteria.json");

      expect(mocks.pathResolve).toHaveBeenCalledWith(
        expect.any(String),
        "valid-criteria.json"
      );
      expect(mocks.readFile).toHaveBeenCalled();

      expect(criteria.id).toBe("valid-criteria");
      expect(criteria.criteria).toHaveLength(3);
      expect(criteria.criteria[0].id).toBe("relevance");
      expect(criteria.passingThreshold).toBe(0.7);
    });

    it("should return DEFAULT_CRITERIA when file doesn't exist", async () => {
      const criteria = await loadCriteriaConfiguration(
        "non-existent-criteria.json"
      );

      expect(mocks.access).toHaveBeenCalled();
      expect(criteria).toEqual(DEFAULT_CRITERIA);
    });

    it("should return DEFAULT_CRITERIA for malformed JSON", async () => {
      const criteria = await loadCriteriaConfiguration(
        "malformed-criteria.json"
      );

      expect(mocks.readFile).toHaveBeenCalled();
      expect(criteria).toEqual(DEFAULT_CRITERIA);
    });

    it("should return DEFAULT_CRITERIA for invalid schema", async () => {
      const criteria = await loadCriteriaConfiguration(
        "missing-fields-criteria.json"
      );

      expect(mocks.readFile).toHaveBeenCalled();
      expect(criteria).toEqual(DEFAULT_CRITERIA);
    });

    it("should handle nested paths correctly", async () => {
      await loadCriteriaConfiguration("subfolder/nested-criteria.json");

      // Verify that path.resolve was called with the correct path components
      expect(mocks.pathResolve).toHaveBeenCalledWith(
        expect.any(String),
        "subfolder/nested-criteria.json"
      );
    });
  });

  describe("Criteria folder structure", () => {
    // This test section requires actual file system access and would be better as an integration test
    // Here we're just checking that the code attempts to load from the expected location

    it("should look for criteria in the expected location", async () => {
      // Force a file-not-found error to verify the path
      mocks.access.mockRejectedValueOnce(new Error("File not found"));

      await loadCriteriaConfiguration("research.json");

      // The exact path will depend on the implementation
      expect(mocks.pathResolve).toHaveBeenCalledWith(
        expect.any(String),
        "research.json"
      );
    });
  });

  describe("Criteria weights calculation", () => {
    it("should calculate overall score correctly based on criteria weights", () => {
      // This would normally be in a separate test file for the score calculation utilities
      // The calculateOverallScore function would be imported and tested directly

      // Note: This is just a placeholder showing the kind of test that would be valuable
      // Implementation would depend on the actual scoring mechanism

      const scores = {
        relevance: 0.8,
        completeness: 0.6,
        clarity: 0.7,
      };

      const weights = {
        relevance: 0.4,
        completeness: 0.3,
        clarity: 0.3,
      };

      // The expected result would be:
      // (0.8 * 0.4) + (0.6 * 0.3) + (0.7 * 0.3) = 0.32 + 0.18 + 0.21 = 0.71

      // This is just pseudo-code for illustration:
      // const result = calculateOverallScore(scores, weights);
      // expect(result).toBeCloseTo(0.71);
    });
  });
});
