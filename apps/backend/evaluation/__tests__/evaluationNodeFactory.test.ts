import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";

// Define mock functions using vi.hoisted to ensure they're initialized before vi.mock()
const mocks = vi.hoisted(() => {
  return {
    // Mock for createEvaluationNode
    createEvaluationNode: vi.fn().mockImplementation((options) => {
      // Default implementation - success case
      return async (state: any) => {
        return {
          ...state,
          [options.resultField]: {
            passed: true,
            timestamp: new Date().toISOString(),
            evaluator: "ai",
            overallScore: 0.8,
            scores: { quality: 0.8 },
            strengths: ["Good quality"],
            weaknesses: [],
            suggestions: [],
            feedback: "Good job",
          },
          [options.statusField]: "awaiting_review",
        };
      };
    }),

    // Mock for extractResearchContent
    extractResearchContent: vi.fn().mockReturnValue("Mock research content"),

    // Mock for loadCriteriaConfiguration
    loadCriteriaConfiguration: vi.fn().mockResolvedValue({
      id: "test-criteria",
      name: "Test Evaluation Criteria",
      version: "1.0.0",
      criteria: [
        { id: "quality", name: "Quality", weight: 1, passingThreshold: 0.6 },
      ],
      passingThreshold: 0.7,
    }),

    // Other utility mocks
    pathResolve: vi.fn((...segments) => segments.join("/")),

    readFileSync: vi.fn((filePath) => {
      if (typeof filePath === "string" && filePath.includes("research.json")) {
        return JSON.stringify({
          id: "research",
          name: "Research Evaluation",
          version: "1.0.0",
          criteria: [
            {
              id: "quality",
              name: "Quality",
              weight: 1,
              passingThreshold: 0.6,
            },
          ],
          passingThreshold: 0.7,
        });
      }
      throw new Error(`File not found: ${filePath}`);
    }),

    existsSync: vi.fn(
      (filePath) =>
        typeof filePath === "string" && filePath.includes("research.json")
    ),
  };
});

// Mock modules AFTER defining the hoisted mocks
vi.mock("../index.js", () => ({
  createEvaluationNode: mocks.createEvaluationNode,
  loadCriteriaConfiguration: mocks.loadCriteriaConfiguration,
}));

vi.mock("../extractors.js", () => ({
  extractResearchContent: mocks.extractResearchContent,
  extractSolutionContent: vi.fn(),
  extractConnectionPairsContent: vi.fn(),
  extractFunderSolutionAlignmentContent: vi.fn(),
  createSectionExtractor: vi.fn(),
}));

// Fix the path mock to include default export
vi.mock("path", () => {
  return {
    default: {
      resolve: mocks.pathResolve,
    },
    resolve: mocks.pathResolve,
  };
});

vi.mock("fs", () => ({
  readFileSync: mocks.readFileSync,
  existsSync: mocks.existsSync,
}));

// Import after mocks are set up
import {
  OverallProposalState,
  ProcessingStatus,
  EvaluationResult,
} from "../../state/proposal.state.js";
import { EvaluationNodeFactory } from "../factory.js";
import { EvaluationNodeOptions, EvaluationNodeFunction } from "../index.js";

// Define a proper TestState interface for our testing needs
interface TestState {
  contentType?: string;
  errors?: string[];
  // Fields we access in tests
  researchStatus?: ProcessingStatus;
  researchEvaluation?: EvaluationResult;
  // Special test helper properties
  __mockContentEmpty?: boolean;
  // Allow dynamic access for testing
  [key: string]: any;
}

describe("EvaluationNodeFactory", () => {
  let factory: EvaluationNodeFactory;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset our mocks to their default behavior
    mocks.createEvaluationNode.mockClear();
    mocks.extractResearchContent.mockClear();
    mocks.extractResearchContent.mockReturnValue("Mock research content");

    // Create factory instance with test criteria path
    factory = new EvaluationNodeFactory({
      criteriaDirPath: "config/evaluation/criteria",
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("createNode", () => {
    it("should create a research evaluation node", async () => {
      // Set up a simple mock implementation
      mocks.createEvaluationNode.mockImplementation((options) => {
        // Return evaluation node function
        return async (state: any) => {
          return {
            ...state,
            [options.resultField]: {
              passed: true,
              timestamp: new Date().toISOString(),
              evaluator: "ai",
              overallScore: 0.8,
              scores: { quality: 0.8 },
              strengths: ["Good quality"],
              weaknesses: [],
              suggestions: [],
              feedback: "Good job",
            },
            [options.statusField]: "awaiting_review",
          };
        };
      });

      // Create a mock state for testing
      const mockState: TestState = {
        contentType: "research",
      };

      // Get the evaluation node from the factory
      const evaluateResearch = factory.createNode("research", {
        contentExtractor: mocks.extractResearchContent,
        resultField: "researchEvaluation",
        statusField: "researchStatus",
      });

      // Call the evaluation node with our mock state
      const result = await evaluateResearch(mockState as any);

      // Check that the mock implementation was called with the right options
      expect(mocks.createEvaluationNode).toHaveBeenCalledWith(
        expect.objectContaining({
          contentType: "research",
          contentExtractor: mocks.extractResearchContent,
          resultField: "researchEvaluation",
          statusField: "researchStatus",
        })
      );

      // Verify the result contains what we expect
      expect(result.researchEvaluation).toBeDefined();
      expect(result.researchStatus).toBe("awaiting_review");
    });

    it("should throw an error if contentExtractor is not provided", () => {
      // Mock implementation to check validation
      mocks.createEvaluationNode.mockImplementation((options) => {
        if (!options.contentExtractor) {
          throw new Error("Content extractor must be provided");
        }
        return async (state: any) => state;
      });

      expect(() =>
        factory.createNode("research", {
          resultField: "researchEvaluation",
          statusField: "researchStatus",
        } as any)
      ).toThrow("Content extractor must be provided");
    });

    it("should throw an error if resultField is not provided", () => {
      // Mock implementation to check validation
      mocks.createEvaluationNode.mockImplementation((options) => {
        if (!options.resultField) {
          throw new Error("Result field must be provided");
        }
        return async (state: any) => state;
      });

      expect(() =>
        factory.createNode("research", {
          contentExtractor: mocks.extractResearchContent,
          statusField: "researchStatus",
        } as any)
      ).toThrow("Result field must be provided");
    });

    it("should throw an error if statusField is not provided", () => {
      // Mock implementation to check validation
      mocks.createEvaluationNode.mockImplementation((options) => {
        if (!options.statusField) {
          throw new Error("Status field must be provided");
        }
        return async (state: any) => state;
      });

      expect(() =>
        factory.createNode("research", {
          contentExtractor: mocks.extractResearchContent,
          resultField: "researchEvaluation",
        } as any)
      ).toThrow("Status field must be provided");
    });

    it("should handle case when content is empty", async () => {
      // Set up a mock implementation for this specific test
      mocks.createEvaluationNode.mockImplementation((options) => {
        // Return a function that checks for empty content
        return async (state: any) => {
          const content = options.contentExtractor(state);
          if (!content) {
            return {
              ...state,
              errors: [
                ...(state.errors || []),
                `${options.contentType} evaluation failed: Content is missing or empty`,
              ],
              [options.statusField]: "error",
            };
          }
          return {
            ...state,
            [options.resultField]: { passed: true },
            [options.statusField]: "awaiting_review",
          };
        };
      });

      // Create a mock state with empty content
      const mockState: TestState = {
        contentType: "research",
        errors: [],
      };

      // Make extractResearchContent return empty string for this test
      mocks.extractResearchContent.mockReturnValue("");

      // Get evaluation node and call it
      const evaluateResearch = factory.createNode("research", {
        contentExtractor: mocks.extractResearchContent,
        resultField: "researchEvaluation",
        statusField: "researchStatus",
      });

      // Call the evaluation function
      const result = await evaluateResearch(mockState as any);

      // Verify error handling
      expect(result.errors).toContain(
        "research evaluation failed: Content is missing or empty"
      );
      expect(result.researchStatus).toBe("error");
    });

    it("should handle case when validation fails", async () => {
      // Set up a mock implementation for this specific test
      mocks.createEvaluationNode.mockImplementation((options) => {
        // Return a function that checks custom validator
        return async (state: any) => {
          if (options.customValidator && !options.customValidator({})) {
            return {
              ...state,
              errors: [
                ...(state.errors || []),
                `${options.contentType} evaluation failed: Invalid content for evaluation`,
              ],
              [options.statusField]: "error",
            };
          }
          return {
            ...state,
            [options.resultField]: { passed: true },
            [options.statusField]: "awaiting_review",
          };
        };
      });

      // Create a mock state
      const mockState: TestState = {
        contentType: "research",
        errors: [],
      };

      // Get evaluation node with custom validator that always fails
      const evaluateResearch = factory.createNode("research", {
        contentExtractor: mocks.extractResearchContent,
        resultField: "researchEvaluation",
        statusField: "researchStatus",
        customValidator: () => false,
      });

      // Call the evaluation function
      const result = await evaluateResearch(mockState as any);

      // Verify error handling
      expect(result.errors).toContain(
        "research evaluation failed: Invalid content for evaluation"
      );
      expect(result.researchStatus).toBe("error");
    });
  });

  describe("convenience methods", () => {
    it("should create research evaluation node with defaults", async () => {
      // Mock the factory's createNode method directly
      const createNodeSpy = vi
        .spyOn(factory, "createNode")
        .mockImplementation((contentType, overrides = {}) => {
          // Ensure it's called with the right parameters
          expect(contentType).toBe("research");
          expect(overrides.contentExtractor).toBe(mocks.extractResearchContent);
          expect(overrides.resultField).toBe("researchEvaluation");
          expect(overrides.statusField).toBe("researchStatus");

          // Return a simple mock function
          return async (state: any) => ({
            ...state,
            researchEvaluation: {
              passed: true,
              timestamp: new Date().toISOString(),
              evaluator: "ai",
              overallScore: 0.8,
              scores: { quality: 0.8 },
              strengths: ["Good quality"],
              weaknesses: [],
              suggestions: [],
              feedback: "Good job",
            },
            researchStatus: "awaiting_review",
          });
        });

      // Call the convenience method
      const evaluateResearch = factory.createResearchEvaluationNode();

      // Create a state and call the function
      const mockState: TestState = { contentType: "research" };
      const result = await evaluateResearch(mockState as any);

      // Verify the node works
      expect(result.researchEvaluation).toBeDefined();
      expect(result.researchStatus).toBe("awaiting_review");
      expect(createNodeSpy).toHaveBeenCalledWith("research", {
        contentExtractor: expect.any(Function),
        resultField: "researchEvaluation",
        statusField: "researchStatus",
      });
    });
  });
});
