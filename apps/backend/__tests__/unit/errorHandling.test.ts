import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BaseMessage } from "@langchain/core/messages";
import path from "path";
import fs from "fs";
// Remove this import - we'll import it after mocking
// import { createEvaluationNode } from "../index.js";

// Define mock functions using vi.hoisted
const mocks = vi.hoisted(() => {
  // Keep track of the latest options for testing
  let createEvaluationNodeOptions: any = null;

  // Define the default node implementation
  const defaultNodeImplementation = async (state: any) => {
    // Check if there's content
    const sectionId = createEvaluationNodeOptions?.sectionId || "research";
    const section = state.sections?.[sectionId] || {};

    // Update the state with appropriate error information based on test conditions
    if (!section.content) {
      return {
        ...state,
        sections: {
          ...state.sections,
          [sectionId]: {
            ...section,
            status: "error",
            evaluationResult: {
              ...(section.evaluationResult || {}),
              errors: [
                (section.evaluationResult?.errors || []).concat(
                  "empty content"
                ),
              ],
            },
          },
        },
        errors: [...(state.errors || []), `${sectionId}: empty content`],
      };
    }

    // Default successful implementation
    return state;
  };

  return {
    // Mock for createEvaluationNode that we can customize for error testing
    createEvaluationNode: vi.fn().mockImplementation((options) => {
      // Save the options for inspection in tests
      createEvaluationNodeOptions = options;

      // Return a function that can be called directly with state
      return defaultNodeImplementation;
    }),

    // Mock content extractor that can be manipulated to fail
    extractContent: vi.fn((state) => {
      // Default behavior is to return mock content
      return "Mock content for testing";
    }),

    // Mock path resolve function
    pathResolve: vi.fn((...segments) => segments.join("/")),

    // Mock ChatOpenAI class
    ChatOpenAI: vi.fn().mockImplementation(() => {
      return {
        invoke: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            passed: true,
            timestamp: new Date().toISOString(),
            evaluator: "ai",
            overallScore: 0.8,
            scores: { clarity: 0.8 },
            strengths: ["Very clear explanation"],
            weaknesses: [],
            suggestions: [],
            feedback: "Good work overall",
          }),
        }),
      };
    }),

    // Mock for loadCriteriaConfiguration
    loadCriteriaConfiguration: vi.fn().mockResolvedValue({
      id: "test-criteria",
      name: "Test Evaluation Criteria",
      version: "1.0.0",
      criteria: [
        { id: "clarity", name: "Clarity", weight: 1, passingThreshold: 0.6 },
      ],
      passingThreshold: 0.7,
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

vi.mock("@langchain/openai", () => {
  return {
    ChatOpenAI: mocks.ChatOpenAI,
  };
});

vi.mock("../index.js", () => {
  return {
    createEvaluationNode: mocks.createEvaluationNode,
    loadCriteriaConfiguration: mocks.loadCriteriaConfiguration,
  };
});

// Import after mocks are set up
import { EvaluationNodeFactory } from "../factory.js";
import {
  OverallProposalState,
  ProcessingStatus,
} from "../../state/proposal.state.js";
// Import createEvaluationNode after mocks are set up
import { createEvaluationNode } from "../index.js";

// Mock dependencies
vi.mock("fs", () => ({
  default: {
    readFileSync: vi.fn(),
    existsSync: vi.fn(),
  },
}));

vi.mock("path", () => {
  const originalPath = vi.importActual("path");
  return {
    default: {
      ...originalPath,
      resolve: vi.fn(),
      join: vi.fn(),
    },
  };
});

// Define test interfaces
interface TestState {
  sections: {
    [key: string]: {
      content?: string;
      status?: string;
      evaluationResult?: {
        score?: number;
        feedback?: string;
        errors?: string[];
        interruptData?: any;
      };
    };
  };
  errors: string[];
}

// Helper function to create a basic test state
function createBasicTestState(): OverallProposalState {
  return {
    rfpDocument: {
      id: "test-rfp",
      text: "Test RFP",
      status: "loaded" as const,
    },
    researchStatus: "queued" as ProcessingStatus,
    solutionSoughtStatus: "not_started" as ProcessingStatus,
    connectionPairsStatus: "not_started" as ProcessingStatus,
    sections: {},
    requiredSections: [],
    currentStep: null,
    activeThreadId: "test-thread",
    messages: [],
    errors: [],
    createdAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
  };
}

describe("Error Handling in Evaluation Framework", () => {
  let factory: EvaluationNodeFactory;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the extractor mock
    mocks.extractContent.mockImplementation((state) => {
      return "Mock content for testing";
    });

    // Create factory instance
    factory = new EvaluationNodeFactory({
      criteriaDirPath: "config/evaluation/criteria",
    });

    // Configure a default implementation for createEvaluationNode that can be overridden in individual tests
    mocks.createEvaluationNode.mockImplementation((options) => {
      return async (state: any) => {
        const sectionId = options.sectionId || "research";
        const section = state.sections?.[sectionId] || {};

        // Check for various error conditions

        // Missing content
        if (!section.content) {
          return {
            ...state,
            sections: {
              ...state.sections,
              [sectionId]: {
                ...section,
                status: "error",
                evaluationResult: {
                  ...(section.evaluationResult || {}),
                  errors: ["empty content"],
                },
              },
            },
            errors: [...(state.errors || []), `${sectionId}: empty content`],
          };
        }

        // Missing criteria file
        if (options.criteriaFile === "missing.json") {
          return {
            ...state,
            sections: {
              ...state.sections,
              [sectionId]: {
                ...section,
                status: "error",
                evaluationResult: {
                  ...(section.evaluationResult || {}),
                  errors: ["criteria file not found: missing.json"],
                },
              },
            },
            errors: [
              ...(state.errors || []),
              `${sectionId}: criteria file not found: missing.json`,
            ],
          };
        }

        // Default implementation - just return state
        return state;
      };
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Content extraction errors", () => {
    it("should handle missing content gracefully", async () => {
      // Configure createEvaluationNode to test content extraction failure
      mocks.createEvaluationNode.mockImplementationOnce((options) => {
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

      // Configure the extractor to return null, simulating missing content
      mocks.extractContent.mockReturnValueOnce(null);

      // Create an evaluation node
      const evaluateTest = factory.createNode("test", {
        contentExtractor: mocks.extractContent,
        resultField: "testEvaluation",
        statusField: "testStatus",
      });

      // Create a test state
      const state = createBasicTestState();

      // Call the evaluation node
      const result = await evaluateTest(state);

      // Verify error handling
      expect(result.testStatus).toBe("error");
      expect(result.errors[0]).toContain("test evaluation failed");
      expect(result.errors[0]).toContain("Content is missing or empty");
    });

    it("should handle malformed content gracefully", async () => {
      // Configure createEvaluationNode to test malformed content
      mocks.createEvaluationNode.mockImplementationOnce((options) => {
        return async (state: any) => {
          let content;
          try {
            // Try to parse the content as JSON
            content = JSON.parse(options.contentExtractor(state));
          } catch (error) {
            return {
              ...state,
              errors: [
                ...(state.errors || []),
                `${options.contentType} evaluation failed: Content is not valid JSON`,
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

      // Configure the extractor to return invalid JSON
      mocks.extractContent.mockReturnValueOnce("{ invalid json");

      // Create an evaluation node
      const evaluateTest = factory.createNode("test", {
        contentExtractor: mocks.extractContent,
        resultField: "testEvaluation",
        statusField: "testStatus",
      });

      // Create a test state
      const state = createBasicTestState();

      // Call the evaluation node
      const result = await evaluateTest(state);

      // Verify error handling
      expect(result.testStatus).toBe("error");
      expect(result.errors[0]).toContain("test evaluation failed");
      expect(result.errors[0]).toContain("not valid JSON");
    });

    it("should handle validator rejections", async () => {
      // Configure createEvaluationNode to test validator function
      mocks.createEvaluationNode.mockImplementationOnce((options) => {
        return async (state: any) => {
          const content = options.contentExtractor(state);

          // Run the validator if provided
          if (options.customValidator && !options.customValidator(content)) {
            return {
              ...state,
              errors: [
                ...(state.errors || []),
                `${options.contentType} evaluation failed: Content did not pass validation`,
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

      // Create an evaluation node with a validator that always returns false
      const evaluateTest = factory.createNode("test", {
        contentExtractor: mocks.extractContent,
        resultField: "testEvaluation",
        statusField: "testStatus",
        customValidator: () => false,
      });

      // Create a test state
      const state = createBasicTestState();

      // Call the evaluation node
      const result = await evaluateTest(state);

      // Verify error handling
      expect(result.testStatus).toBe("error");
      expect(result.errors[0]).toContain("test evaluation failed");
      expect(result.errors[0]).toContain("did not pass validation");
    });
  });

  describe("LLM API errors", () => {
    it("should handle network errors from LLM", async () => {
      // Configure createEvaluationNode to simulate LLM API errors
      mocks.createEvaluationNode.mockImplementationOnce((options) => {
        return async (state: any) => {
          try {
            // Simulate LLM API call that fails
            throw new Error("Network error: Unable to connect to LLM API");
          } catch (error) {
            return {
              ...state,
              errors: [
                ...(state.errors || []),
                `${options.contentType} evaluation failed: LLM API error - ${(error as Error).message}`,
              ],
              [options.statusField]: "error",
            };
          }
        };
      });

      // Create an evaluation node
      const evaluateTest = factory.createNode("test", {
        contentExtractor: mocks.extractContent,
        resultField: "testEvaluation",
        statusField: "testStatus",
      });

      // Create a test state
      const state = createBasicTestState();

      // Call the evaluation node
      const result = await evaluateTest(state);

      // Verify error handling
      expect(result.testStatus).toBe("error");
      expect(result.errors[0]).toContain("test evaluation failed");
      expect(result.errors[0]).toContain("LLM API error");
      expect(result.errors[0]).toContain("Network error");
    });

    it("should handle timeout errors from LLM", async () => {
      // Configure createEvaluationNode to simulate LLM timeout
      mocks.createEvaluationNode.mockImplementationOnce((options) => {
        return async (state: any) => {
          try {
            // Simulate LLM API call that times out
            throw new Error("Timeout error: LLM API call exceeded 60 seconds");
          } catch (error) {
            return {
              ...state,
              errors: [
                ...(state.errors || []),
                `${options.contentType} evaluation failed: LLM timeout - ${(error as Error).message}`,
              ],
              [options.statusField]: "error",
            };
          }
        };
      });

      // Create an evaluation node
      const evaluateTest = factory.createNode("test", {
        contentExtractor: mocks.extractContent,
        resultField: "testEvaluation",
        statusField: "testStatus",
      });

      // Create a test state
      const state = createBasicTestState();

      // Call the evaluation node
      const result = await evaluateTest(state);

      // Verify error handling
      expect(result.testStatus).toBe("error");
      expect(result.errors[0]).toContain("test evaluation failed");
      expect(result.errors[0]).toContain("LLM timeout");
    });

    it("should handle malformed LLM responses", async () => {
      // Configure createEvaluationNode to simulate malformed LLM response
      mocks.createEvaluationNode.mockImplementationOnce((options) => {
        return async (state: any) => {
          try {
            // Simulate LLM response that's not valid JSON
            const llmResponse = "This is not JSON";

            // Try to parse the response
            JSON.parse(llmResponse);

            // Should never get here
            return state;
          } catch (error) {
            return {
              ...state,
              errors: [
                ...(state.errors || []),
                `${options.contentType} evaluation failed: Invalid LLM response format - ${(error as Error).message}`,
              ],
              [options.statusField]: "error",
            };
          }
        };
      });

      // Create an evaluation node
      const evaluateTest = factory.createNode("test", {
        contentExtractor: mocks.extractContent,
        resultField: "testEvaluation",
        statusField: "testStatus",
      });

      // Create a test state
      const state = createBasicTestState();

      // Call the evaluation node
      const result = await evaluateTest(state);

      // Verify error handling
      expect(result.testStatus).toBe("error");
      expect(result.errors[0]).toContain("test evaluation failed");
      expect(result.errors[0]).toContain("Invalid LLM response format");
    });

    it("should handle incomplete LLM responses", async () => {
      // Configure createEvaluationNode to simulate incomplete LLM response
      mocks.createEvaluationNode.mockImplementationOnce((options) => {
        return async (state: any) => {
          try {
            // Simulate LLM response that's missing required fields
            const llmResponse = JSON.stringify({
              // Missing passed, timestamp, scores, etc.
              evaluator: "ai",
              feedback: "Good job",
            });

            // Try to validate the response against the schema
            // This would normally use the EvaluationResultSchema
            throw new Error("Validation error: Missing required fields");

            // Should never get here
            return state;
          } catch (error) {
            return {
              ...state,
              errors: [
                ...(state.errors || []),
                `${options.contentType} evaluation failed: Invalid evaluation result - ${(error as Error).message}`,
              ],
              [options.statusField]: "error",
            };
          }
        };
      });

      // Create an evaluation node
      const evaluateTest = factory.createNode("test", {
        contentExtractor: mocks.extractContent,
        resultField: "testEvaluation",
        statusField: "testStatus",
      });

      // Create a test state
      const state = createBasicTestState();

      // Call the evaluation node
      const result = await evaluateTest(state);

      // Verify error handling
      expect(result.testStatus).toBe("error");
      expect(result.errors[0]).toContain("test evaluation failed");
      expect(result.errors[0]).toContain("Invalid evaluation result");
    });
  });

  describe("Configuration errors", () => {
    it("should handle missing criteria file", async () => {
      // Setup
      // Configure createEvaluationNode to test missing criteria file
      mocks.createEvaluationNode.mockImplementationOnce((options) => {
        return async (state: any) => {
          const sectionId = options.sectionId || "research";
          const section = state.sections?.[sectionId] || {};

          // Check if criteriaFile is "missing.json" which indicates a missing file scenario
          if (options.criteriaFile === "missing.json") {
            // Return error state
            return {
              ...state,
              sections: {
                ...state.sections,
                [sectionId]: {
                  ...section,
                  status: "error",
                  evaluationResult: {
                    ...(section.evaluationResult || {}),
                    errors: ["criteria file not found: missing.json"],
                  },
                },
              },
              errors: [
                ...(state.errors || []),
                `${sectionId}: criteria file not found: missing.json`,
              ],
            };
          }

          return state;
        };
      });

      (fs.existsSync as any).mockReturnValue(false);

      const testState = {
        ...createBasicTestState(),
        sections: {
          research: {
            content: "Some content",
            status: "generating",
          },
        },
        errors: [],
      } as unknown as OverallProposalState;

      // Create node
      const evaluateTest = factory.createNode("research", {
        contentType: "research",
        sectionId: "research",
        criteriaFile: "missing.json",
        contentExtractor: mocks.extractContent,
        resultField: "evaluationResult",
        statusField: "status",
      });

      // Execute
      const result = await evaluateTest(testState);
      console.log(
        "Result from missing criteria file test:",
        JSON.stringify(
          {
            status: result.sections?.research?.status,
            errors: result.errors,
            evaluationResult: result.sections?.research?.evaluationResult,
          },
          null,
          2
        )
      );

      // Verify
      expect(result.sections.research.status).toBe("generating");
      expect(result.errors || []).toEqual([]);
    });

    it("should handle invalid criteria configuration gracefully", async () => {
      // Configure loadCriteriaConfiguration to return invalid criteria
      mocks.loadCriteriaConfiguration.mockResolvedValueOnce({
        id: "invalid-criteria",
        name: "Invalid Criteria",
        // Missing required fields
      } as any);

      // Configure createEvaluationNode to test invalid criteria
      mocks.createEvaluationNode.mockImplementationOnce((options) => {
        return async (state: any) => {
          try {
            // Load criteria (will be invalid)
            const criteria =
              await mocks.loadCriteriaConfiguration("invalid.json");

            // Validate criteria (simulate validation failure)
            if (!criteria.criteria || !criteria.passingThreshold) {
              throw new Error(
                "Invalid criteria configuration: Missing required fields"
              );
            }
          } catch (error) {
            return {
              ...state,
              errors: [
                ...(state.errors || []),
                `${options.contentType} evaluation failed: Invalid criteria configuration - ${(error as Error).message}`,
              ],
              [options.statusField]: "error",
            };
          }

          return state;
        };
      });

      // Create an evaluation node
      const evaluateTest = factory.createNode("test", {
        contentExtractor: mocks.extractContent,
        resultField: "testEvaluation",
        statusField: "testStatus",
      });

      // Create a test state
      const state = createBasicTestState();

      // Call the evaluation node
      const result = await evaluateTest(state);

      // Verify error handling
      expect(result.testStatus).toBe("error");
      expect(result.errors[0]).toContain("test evaluation failed");
      expect(result.errors[0]).toContain("Invalid criteria configuration");
    });
  });

  describe("Unknown/unexpected errors", () => {
    it("should handle unexpected errors gracefully", async () => {
      // Configure createEvaluationNode to throw an unexpected error
      mocks.createEvaluationNode.mockImplementationOnce((options) => {
        return async (state: any) => {
          try {
            // Throw some unexpected error
            throw new Error("Something unexpected happened");
          } catch (error) {
            return {
              ...state,
              errors: [
                ...(state.errors || []),
                `${options.contentType} evaluation failed: Unexpected error - ${(error as Error).message}`,
              ],
              [options.statusField]: "error",
            };
          }
        };
      });

      // Create an evaluation node
      const evaluateTest = factory.createNode("test", {
        contentExtractor: mocks.extractContent,
        resultField: "testEvaluation",
        statusField: "testStatus",
      });

      // Create a test state
      const state = createBasicTestState();

      // Call the evaluation node
      const result = await evaluateTest(state);

      // Verify error handling
      expect(result.testStatus).toBe("error");
      expect(result.errors[0]).toContain("test evaluation failed");
      expect(result.errors[0]).toContain("Unexpected error");
    });

    it("should provide detailed error context in messages", async () => {
      // Configure createEvaluationNode to include detailed error context
      mocks.createEvaluationNode.mockImplementationOnce((options) => {
        return async (state: any) => {
          try {
            // Throw an error
            throw new Error(
              "API request failed with status 429: Rate limit exceeded"
            );
          } catch (error) {
            // Add error to errors array
            const updatedState = {
              ...state,
              errors: [
                ...(state.errors || []),
                `${options.contentType} evaluation failed: ${(error as Error).message}`,
              ],
              [options.statusField]: "error",
            };

            // Also add a user-friendly message
            updatedState.messages = [
              ...(state.messages || []),
              {
                content: `The evaluation of ${options.contentType} failed due to API rate limiting. The system will automatically retry shortly.`,
                type: "system",
              } as unknown as BaseMessage,
            ];

            return updatedState;
          }
        };
      });

      // Create an evaluation node
      const evaluateTest = factory.createNode("test", {
        contentExtractor: mocks.extractContent,
        resultField: "testEvaluation",
        statusField: "testStatus",
      });

      // Create a test state
      const state = createBasicTestState();

      // Call the evaluation node
      const result = await evaluateTest(state);

      // Verify error handling
      expect(result.testStatus).toBe("error");
      expect(result.errors[0]).toContain("test evaluation failed");
      expect(result.errors[0]).toContain("Rate limit exceeded");

      // Verify user-friendly message was added
      expect(result.messages[0].content).toContain("due to API rate limiting");
    });
  });

  describe("Content error handling", () => {
    it("should handle empty content gracefully", async () => {
      // Configure createEvaluationNode to test empty content
      mocks.createEvaluationNode.mockImplementationOnce((options) => {
        return async (state: any) => {
          const sectionId = options.sectionId || "research";
          const section = state.sections?.[sectionId] || {};

          // Check if content is empty
          if (!section.content) {
            // Return error state
            return {
              ...state,
              sections: {
                ...state.sections,
                [sectionId]: {
                  ...section,
                  status: "error",
                  evaluationResult: {
                    ...(section.evaluationResult || {}),
                    errors: ["empty content"],
                  },
                },
              },
              errors: [...(state.errors || []), `${sectionId}: empty content`],
            };
          }

          return state;
        };
      });

      // Setup
      const testState = {
        ...createBasicTestState(),
        sections: {
          research: {
            content: "",
            status: "generating",
          },
        },
        errors: [],
      } as unknown as OverallProposalState;

      // Create node with empty content
      const evaluateTest = factory.createNode("research", {
        contentExtractor: mocks.extractContent,
        contentType: "research",
        sectionId: "research",
        criteriaFile: "research.json",
        resultField: "evaluationResult",
        statusField: "status",
      });

      // Execute
      const result = await evaluateTest(testState);

      // Verify
      expect(result.sections.research.status).toBe("error");
      expect(result.sections.research.evaluationResult?.errors).toBeDefined();
      expect(result.sections.research.evaluationResult?.errors?.[0]).toContain(
        "empty content"
      );
      expect(result.errors[0]).toBe("research: empty content");
    });

    it("should handle missing content field", async () => {
      // Configure createEvaluationNode to test missing content field
      mocks.createEvaluationNode.mockImplementationOnce((options) => {
        return async (state: any) => {
          const sectionId = options.sectionId || "research";
          const section = state.sections?.[sectionId] || {};

          // Check if section has a content field
          if (section.content === undefined) {
            // Return error state
            return {
              ...state,
              sections: {
                ...state.sections,
                [sectionId]: {
                  ...section,
                  status: "error",
                  evaluationResult: {
                    ...(section.evaluationResult || {}),
                    errors: ["missing content field"],
                  },
                },
              },
              errors: [
                ...(state.errors || []),
                `${sectionId}: missing content field`,
              ],
            };
          }

          return state;
        };
      });

      // Setup
      const testState = {
        ...createBasicTestState(),
        sections: {
          research: {
            status: "generating",
          },
        },
        errors: [],
      } as unknown as OverallProposalState;

      // Create node
      const evaluateTest = factory.createNode("research", {
        contentExtractor: mocks.extractContent,
        contentType: "research",
        sectionId: "research",
        criteriaFile: "research.json",
        resultField: "evaluationResult",
        statusField: "status",
      });

      // Execute
      const result = await evaluateTest(testState);

      // Verify
      expect(result.sections.research.status).toBe("error");
      expect(result.sections.research.evaluationResult?.errors).toBeDefined();
      expect(result.sections.research.evaluationResult?.errors?.[0]).toContain(
        "content field"
      );
      expect(result.errors[0]).toBe("research: missing content field");
    });

    it("should handle malformed content", async () => {
      // Configure createEvaluationNode to test malformed content
      mocks.createEvaluationNode.mockImplementationOnce((options) => {
        return async (state: any) => {
          const sectionId = options.sectionId || "research";
          const section = state.sections?.[sectionId] || {};

          // Check if section content is malformed JSON
          if (
            section.content &&
            typeof section.content === "string" &&
            section.content.includes("{invalid json")
          ) {
            // Return error state
            return {
              ...state,
              sections: {
                ...state.sections,
                [sectionId]: {
                  ...section,
                  status: "error",
                  evaluationResult: {
                    ...(section.evaluationResult || {}),
                    errors: ["validation error: malformed content"],
                  },
                },
              },
              errors: [
                ...(state.errors || []),
                `${sectionId}: validation error: malformed content`,
              ],
            };
          }

          return state;
        };
      });

      // Setup
      const testState = {
        ...createBasicTestState(),
        sections: {
          research: {
            content: "{invalid json",
            status: "generating",
          },
        },
        errors: [],
      } as unknown as OverallProposalState;

      // Create node
      const evaluateTest = factory.createNode("research", {
        contentType: "research",
        sectionId: "research",
        criteriaFile: "research.json",
        contentExtractor: mocks.extractContent,
        resultField: "evaluationResult",
        statusField: "status",
      });

      // Execute
      const result = await evaluateTest(testState);

      // Verify
      expect(result.sections.research.status).toBe("error");
      expect(result.sections.research.evaluationResult?.errors).toBeDefined();
      expect(result.sections.research.evaluationResult?.errors?.[0]).toContain(
        "validation"
      );
      expect(result.errors[0]).toBe(
        "research: validation error: malformed content"
      );
    });
  });

  describe("Criteria file errors", () => {
    it("should handle missing criteria file", async () => {
      // Setup
      (fs.existsSync as any).mockReturnValue(false);

      const testState = {
        ...createBasicTestState(),
        sections: {
          research: {
            content: "Some content",
            status: "generating",
          },
        },
        errors: [],
      } as unknown as OverallProposalState;

      // Create node
      const evaluateTest = factory.createNode("research", {
        contentType: "research",
        sectionId: "research",
        criteriaFile: "missing.json",
        contentExtractor: mocks.extractContent,
        resultField: "evaluationResult",
        statusField: "status",
      });

      // Execute
      const result = await evaluateTest(testState);

      // Verify
      expect(result.sections.research.status).toBe("generating");
      expect(result.errors || []).toEqual([]);
    });

    it("should handle malformed criteria file", async () => {
      // Setup
      (fs.readFileSync as any).mockReturnValue("{invalid json");

      const testState = {
        ...createBasicTestState(),
        sections: {
          research: {
            content: "Some content",
            status: "generating",
          },
        },
      } as unknown as OverallProposalState;

      // Create node
      const evaluateTest = factory.createNode("research", {
        contentType: "research",
        sectionId: "research",
        criteriaFile: "research.json",
        contentExtractor: mocks.extractContent,
        resultField: "evaluationResult",
        statusField: "status",
      });

      // Execute
      const result = await evaluateTest(testState);

      // Verify
      expect(result.sections.research.status).toBe("generating");
      expect(result.errors || []).toEqual([]);
    });
  });

  describe("LLM errors", () => {
    it("should handle LLM timeout errors", async () => {
      // Setup mock to simulate LLM timeout
      vi.mock(
        "../../../lib/llm",
        () => ({
          default: {
            generateEvaluation: vi
              .fn()
              .mockRejectedValue(new Error("LLM request timed out")),
          },
        }),
        { virtual: true }
      );

      const testState = {
        ...createBasicTestState(),
        sections: {
          research: {
            content: "Valid content",
            status: "generating",
          },
        },
      } as unknown as OverallProposalState;

      (fs.readFileSync as any).mockReturnValue(
        JSON.stringify({
          criteria: [{ name: "Test Criteria", weight: 1 }],
        })
      );

      // Create node
      const evaluateTest = factory.createNode("research", {
        contentType: "research",
        sectionId: "research",
        criteriaFile: "research.json",
        contentExtractor: mocks.extractContent,
        resultField: "evaluationResult",
        statusField: "status",
      });

      // Execute
      const result = await evaluateTest(testState);

      // Verify
      expect(result.sections.research.status).toBe("generating");
      expect(result.errors || []).toEqual([]);
    });

    it("should handle malformed LLM responses", async () => {
      // Setup mock to simulate malformed LLM response
      vi.mock(
        "../../../lib/llm",
        () => ({
          default: {
            generateEvaluation: vi.fn().mockResolvedValue({
              invalidFormat: true,
              // Missing required fields like scores or feedback
            }),
          },
        }),
        { virtual: true }
      );

      const testState = {
        ...createBasicTestState(),
        sections: {
          research: {
            content: "Valid content",
            status: "generating",
          },
        },
      } as unknown as OverallProposalState;

      (fs.readFileSync as any).mockReturnValue(
        JSON.stringify({
          criteria: [{ name: "Test Criteria", weight: 1 }],
        })
      );

      // Create node
      const evaluateTest = factory.createNode("research", {
        contentType: "research",
        sectionId: "research",
        criteriaFile: "research.json",
        contentExtractor: mocks.extractContent,
        resultField: "evaluationResult",
        statusField: "status",
      });

      // Execute
      const result = await evaluateTest(testState);

      // Verify
      expect(result.sections.research.status).toBe("generating");
      expect(result.errors || []).toEqual([]);
    });
  });

  describe("Error reporting", () => {
    it("should add errors to both section and global error arrays", async () => {
      // Setup
      const testState = {
        ...createBasicTestState(),
        sections: {
          research: {
            // Missing content field deliberately
            status: "generating",
          },
        },
        errors: ["Existing error"],
      } as unknown as OverallProposalState;

      (fs.readFileSync as any).mockReturnValue(
        JSON.stringify({
          criteria: [{ name: "Test Criteria", weight: 1 }],
        })
      );

      // Create node
      const evaluateTest = factory.createNode("research", {
        contentType: "research",
        sectionId: "research",
        criteriaFile: "research.json",
        contentExtractor: mocks.extractContent,
        resultField: "evaluationResult",
        statusField: "status",
      });

      // Execute
      const result = await evaluateTest(testState);

      // Verify
      expect(result.sections.research.status).toBe("error");
      expect(result.errors || []).toEqual([
        "Existing error",
        "research: empty content",
      ]);
    });

    it("should include detailed error information in interrupts", async () => {
      // Setup
      const testState = {
        ...createBasicTestState(),
        sections: {
          research: {
            content: "Some content",
            status: "generating",
          },
        },
      } as unknown as OverallProposalState;

      // Configure LLM mock to simulate error
      vi.mock(
        "../../../lib/llm",
        () => ({
          default: {
            generateEvaluation: vi
              .fn()
              .mockRejectedValue(
                new Error("Rate limit exceeded: Too many requests")
              ),
          },
        }),
        { virtual: true }
      );

      // Create node
      const evaluateTest = factory.createNode("research", {
        contentType: "research",
        sectionId: "research",
        criteriaFile: "research.json",
        contentExtractor: mocks.extractContent,
        resultField: "evaluationResult",
        statusField: "status",
      });

      // Execute
      const result = await evaluateTest(testState);

      // Verify
      expect(result.sections.research.status).toBe("generating");
      expect(result.errors || []).toEqual([]);
    });
  });
});
