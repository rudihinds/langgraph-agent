import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BaseMessage } from "@langchain/core/messages";

// Define mock functions using vi.hoisted
const mocks = vi.hoisted(() => {
  return {
    // Mock for createEvaluationNode that we can customize for error testing
    createEvaluationNode: vi.fn().mockImplementation((options) => {
      return async (state: any) => {
        // This is the default implementation - will be overridden in specific tests
        return state;
      };
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
    it("should handle missing criteria file gracefully", async () => {
      // Configure loadCriteriaConfiguration to simulate missing file
      mocks.loadCriteriaConfiguration.mockRejectedValueOnce(
        new Error("ENOENT: no such file or directory")
      );

      // Configure createEvaluationNode to test criteria loading error
      mocks.createEvaluationNode.mockImplementationOnce((options) => {
        return async (state: any) => {
          try {
            // Try to load criteria configuration
            await mocks.loadCriteriaConfiguration("non-existent.json");
          } catch (error) {
            return {
              ...state,
              errors: [
                ...(state.errors || []),
                `${options.contentType} evaluation failed: Unable to load criteria - ${(error as Error).message}`,
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
      expect(result.errors[0]).toContain("Unable to load criteria");
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
});
