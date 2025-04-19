import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import type { OverallProposalState } from "../../state/proposal.state.js";
import type { default as EvaluationNodeFactory } from "../factory.js";
import * as extractorsModule from "../extractors.js";

// Define mock functions using vi.hoisted
const mocks = vi.hoisted(() => {
  // Mock for createEvaluationNode
  const createEvaluationNode = vi.fn((options) => {
    return async (state: Partial<OverallProposalState>) => {
      // Create a deep copy of the state to avoid direct mutations
      const result = JSON.parse(JSON.stringify(state));

      // Extract content using the provided extractor
      let content;
      try {
        content = options.contentExtractor(state);
      } catch (error: unknown) {
        // If content extraction fails, return an error state
        const errorMessage = `${options.contentType}: ${(error as Error).message}`;

        // Update errors array
        if (!result.errors) {
          result.errors = [];
        }
        result.errors.push(errorMessage);

        // Handle nested status field paths (e.g., sections.problem_statement.status)
        if (options.statusField.includes(".")) {
          const parts = options.statusField.split(".");
          let current = result;

          // Create path if it doesn't exist
          for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {
              current[parts[i]] = {};
            }
            current = current[parts[i]];
          }

          // Set the status field
          current[parts[parts.length - 1]] = "error";
        } else {
          // Set direct status field
          result[options.statusField] = "error";
        }

        return result;
      }

      // Simulate validation
      if (
        options.customValidator &&
        typeof options.customValidator === "function"
      ) {
        const validationResult = options.customValidator(content);
        if (!validationResult.valid) {
          // Update errors array
          if (!result.errors) {
            result.errors = [];
          }
          result.errors.push(validationResult.error);

          // Handle nested status fields
          if (options.statusField.includes(".")) {
            const parts = options.statusField.split(".");
            let current = result;

            // Create path if it doesn't exist
            for (let i = 0; i < parts.length - 1; i++) {
              if (!current[parts[i]]) {
                current[parts[i]] = {};
              }
              current = current[parts[i]];
            }

            // Set the status field
            current[parts[parts.length - 1]] = "error";
          } else {
            // Set direct status field
            result[options.statusField] = "error";
          }

          return result;
        }
      }

      // For successful evaluation, update the result field and status
      const evaluationResult = {
        score: 0.85,
        feedback: "Test evaluation feedback",
        criteriaScores: { test: 0.85 },
      };

      // Handle nested result field paths
      if (options.resultField.includes(".")) {
        const parts = options.resultField.split(".");
        let current = result;

        // Create path if it doesn't exist
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]]) {
            current[parts[i]] = {};
          }
          current = current[parts[i]];
        }

        // Set the result field
        current[parts[parts.length - 1]] = evaluationResult;
      } else {
        // Set direct result field
        result[options.resultField] = evaluationResult;
      }

      // Handle nested status field paths
      if (options.statusField.includes(".")) {
        const parts = options.statusField.split(".");
        let current = result;

        // Create path if it doesn't exist
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]]) {
            current[parts[i]] = {};
          }
          current = current[parts[i]];
        }

        // Set the status field
        current[parts[parts.length - 1]] = "complete";
      } else {
        // Set direct status field
        result[options.statusField] = "complete";
      }

      // Update messages
      if (!result.messages) {
        result.messages = [];
      }
      result.messages.push(new HumanMessage("Evaluation completed"));

      // Preserve interrupt flag if it exists
      if (state.interrupt !== undefined) {
        result.interrupt = state.interrupt;
      }

      return result;
    };
  });

  // Content extractor mocks
  const extractResearchContent = vi.fn((state) => {
    if (!state.research) {
      throw new Error("missing research field");
    }
    if (!state.research.content) {
      throw new Error("missing content field");
    }
    return state.research.content;
  });

  const extractSectionContent = vi.fn((state, sectionId) => {
    if (state.sections && state.sections instanceof Map) {
      const section = state.sections.get(sectionId);
      if (section && section.content) {
        return section.content;
      }
    }
    return null;
  });

  // Other utility mocks
  const loadCriteriaConfiguration = vi.fn().mockResolvedValue({
    passingThreshold: 0.7,
    criteria: [
      {
        name: "test",
        description: "Test criteria",
        weight: 1,
      },
    ],
  });

  // Path resolve mock
  const pathResolve = vi.fn((...segments) => segments.join("/"));

  return {
    createEvaluationNode,
    extractResearchContent,
    extractSectionContent,
    loadCriteriaConfiguration,
    pathResolve,
  };
});

// Mock modules AFTER defining the hoisted mocks
vi.mock("../index.js", async () => {
  const actual = await vi.importActual("../index.js");
  return {
    ...actual,
    createEvaluationNode: mocks.createEvaluationNode,
    loadCriteriaConfiguration: mocks.loadCriteriaConfiguration,
  };
});

vi.mock("../extractors.js", async () => {
  const actual = await vi.importActual("../extractors.js");
  return {
    ...actual,
    extractResearchContent: mocks.extractResearchContent,
    extractSolutionContent: vi.fn((state) => {
      if (!state.solution) {
        throw new Error("missing solution field");
      }
      if (!state.solution.content) {
        throw new Error("missing content field");
      }
      return state.solution.content;
    }),
    createSectionExtractor: vi.fn((sectionId) => {
      return (state: any) => {
        if (!state.sections) {
          throw new Error("missing sections object");
        }
        if (!(state.sections instanceof Map)) {
          throw new Error("sections must be a Map");
        }
        if (!state.sections.has(sectionId)) {
          throw new Error(`missing ${sectionId} section`);
        }
        const section = state.sections.get(sectionId);
        if (!section.content) {
          throw new Error("missing content field");
        }
        return section.content;
      };
    }),
    extractProblemStatementContent: vi.fn((state) => {
      if (!state.sections) {
        throw new Error("missing sections object");
      }
      if (!(state.sections instanceof Map)) {
        throw new Error("sections must be a Map");
      }
      if (!state.sections.has("problem_statement")) {
        throw new Error("missing problem_statement section");
      }
      const section = state.sections.get("problem_statement");
      if (!section.content) {
        throw new Error("missing content field");
      }
      return section.content;
    }),
  };
});

vi.mock("path", () => ({
  default: {
    resolve: mocks.pathResolve,
    join: (...args: string[]) => args.join("/"),
  },
  resolve: mocks.pathResolve,
  join: (...args: string[]) => args.join("/"),
}));

// Create a function to generate a realistic test state
function createTestState(): Partial<OverallProposalState> {
  const sections = new Map();

  // Add test sections
  sections.set("problem_statement", {
    id: "problem_statement",
    title: "Problem Statement",
    content: "This is a test problem statement",
    status: "approved",
    lastUpdated: new Date().toISOString(),
  });

  sections.set("methodology", {
    id: "methodology",
    title: "Methodology",
    content: "This is a test methodology",
    status: "queued",
    lastUpdated: new Date().toISOString(),
  });

  return {
    rfpDocument: {
      id: "test-rfp",
      status: "loaded",
    },
    researchStatus: "complete",
    researchResults: {
      findings: "Test findings",
      summary: "Test summary",
    },
    solutionStatus: "approved",
    solutionResults: {
      description: "Test solution",
      keyComponents: ["Component 1", "Component 2"],
    },
    connectionsStatus: "approved",
    connections: [{ problem: "Test problem", solution: "Test solution" }],
    sections,
    requiredSections: ["problem_statement", "methodology"],
    currentStep: "generate_sections",
    activeThreadId: "test-thread-id",
    messages: [],
    errors: [],
    interruptStatus: {
      isInterrupted: false,
      interruptionPoint: null,
      feedback: null,
      processingStatus: null,
    },
    createdAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    status: "running",
  };
}

// Define variable types for the test
let factory: any;
let evaluateResearch: (
  state: Partial<OverallProposalState>
) => Promise<Partial<OverallProposalState>>;
let evaluateSolution: (
  state: Partial<OverallProposalState>
) => Promise<Partial<OverallProposalState>>;
let evaluateProblemStatement: (
  state: Partial<OverallProposalState>
) => Promise<Partial<OverallProposalState>>;
let evaluateNested: (
  state: Partial<OverallProposalState>
) => Promise<Partial<OverallProposalState>>;

describe("State Management in Evaluation Nodes", () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create a factory instance
    factory = {
      createResearchEvaluationNode: vi.fn().mockImplementation(() => {
        return mocks.createEvaluationNode({
          contentType: "research",
          contentExtractor: mocks.extractResearchContent,
          resultField: "researchEvaluation",
          statusField: "researchStatus",
        });
      }),
      createSolutionEvaluationNode: vi.fn().mockImplementation(() => {
        return mocks.createEvaluationNode({
          contentType: "solution",
          contentExtractor: extractorsModule.extractSolutionContent,
          resultField: "solutionEvaluation",
          statusField: "solutionStatus",
        });
      }),
      createSectionEvaluationNode: vi
        .fn()
        .mockImplementation((sectionType, options = {}) => {
          return mocks.createEvaluationNode({
            contentType: sectionType,
            contentExtractor:
              options.contentExtractor ||
              extractorsModule.createSectionExtractor(sectionType),
            resultField: `sections.${sectionType}.evaluation`,
            statusField: `sections.${sectionType}.status`,
            ...options,
          });
        }),
    };

    // Create evaluation nodes
    evaluateResearch = factory.createResearchEvaluationNode();
    evaluateSolution = factory.createSolutionEvaluationNode();
    evaluateProblemStatement = factory.createSectionEvaluationNode(
      "problem_statement",
      {
        contentExtractor: extractorsModule.extractProblemStatementContent,
      }
    );
    evaluateNested = factory.createSectionEvaluationNode("nested_section");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("OverallProposalState compatibility", () => {
    it("should correctly access research fields in state", async () => {
      const state = createTestState();

      // Call the evaluation node
      const result = await evaluateResearch(state);

      // Verify the extractor was called with the state
      expect(mocks.extractResearchContent).toHaveBeenCalledWith(state);

      // Verify the expected field was extracted
      expect(mocks.extractResearchContent).toHaveReturnedWith(
        state.research?.content
      );
    });

    it("should correctly access section fields in state", async () => {
      const state = createTestState();

      // Call the evaluation node
      const result = await evaluateProblemStatement(state);

      // Verify the section content was correctly extracted
      expect(result).toBeDefined();
      expect(result.sections?.problem_statement?.status).toBe("complete");
    });

    it("should handle deeply nested fields in the state", async () => {
      const state = createTestState();
      const complexState = {
        ...state,
        sections: {
          ...state.sections,
          nested_section: {
            content: "Complex nested content",
            status: "pending",
            metadata: {
              deep: {
                value: "nested value for testing",
              },
            },
          },
        },
      };

      // Call the evaluation node
      const result = await evaluateNested(complexState);

      // Verify the extractor was called and accessed the deep structure
      expect(result).toBeDefined();
      expect(result.sections?.nested_section?.status).toBe("complete");
    });
  });

  describe("State updates and transitions", () => {
    it("should correctly update status fields", async () => {
      const state = createTestState();

      // Call the evaluation node
      const result = await evaluateResearch(state);

      // Verify status was updated correctly
      expect(result.researchStatus).toBe("complete");
    });

    it("should add error messages to state.errors", async () => {
      const state = createTestState();
      // Remove content to trigger an error
      state.research = { status: "incomplete" } as any;

      // Call the evaluation node
      const result = await evaluateResearch(state);

      // Verify error status
      expect(result.researchStatus).toBe("error");
      expect(result.errors).toContain("research: missing content field");
    });

    it("should add messages to state.messages", async () => {
      const state = createTestState();

      // Call the evaluation node
      const result = await evaluateResearch(state);

      // Verify messages were updated
      expect(result.messages).toHaveLength(2);
      expect(result.messages?.[1].content).toBe("Evaluation completed");
    });

    it("should set interrupt flag correctly", async () => {
      const state = createTestState();
      // Add an interrupt flag to test preservation
      const stateWithInterrupt = {
        ...state,
        interrupt: true,
      };

      // Call the evaluation node
      const result = await evaluateResearch(stateWithInterrupt);

      // Verify interrupt flag was set
      expect(result.interrupt).toBe(true);
    });
  });

  describe("Error handling with state", () => {
    it("should handle missing content fields gracefully", async () => {
      const state = createTestState();
      // Remove content but keep the research object
      state.research = { status: "incomplete" } as any;

      // Call the evaluation node
      const result = await evaluateResearch(state);

      // Verify error handling
      expect(result.researchStatus).toBe("error");
      expect(result.errors).toContain("research: missing content field");
    });

    it("should handle missing sections gracefully", async () => {
      const state = createTestState();
      // Remove the problem_statement section
      state.sections = {};

      // Call the evaluation node
      const result = await evaluateProblemStatement(state);

      // Verify error handling for missing sections
      expect(result.sections?.problem_statement?.status).toBe("error");
      expect(result.errors).toContain(
        "problem_statement: missing problem_statement section"
      );
    });
  });
});
