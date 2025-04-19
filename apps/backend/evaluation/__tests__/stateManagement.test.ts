import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";

// Define mock functions using vi.hoisted
const mocks = vi.hoisted(() => {
  return {
    // Mock for createEvaluationNode
    createEvaluationNode: vi.fn().mockImplementation((options) => {
      return async (state: any) => {
        // Extract content using the provided extractor
        const content = options.contentExtractor(state);

        // Handle missing content
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

        // Successful evaluation
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
          isInterrupted: true,
          interruptMetadata: {
            type: "evaluation_review",
            contentType: options.contentType,
            actions: ["approve", "revise", "edit"],
          },
          messages: [
            ...(state.messages || []),
            new HumanMessage({
              content: `${options.contentType} has been evaluated.`,
            }),
          ],
        };
      };
    }),

    // Content extractor mocks
    extractResearchContent: vi.fn((state) => {
      if (state.researchResults) {
        return JSON.stringify(state.researchResults);
      }
      return null;
    }),

    extractSectionContent: vi.fn((state, sectionId) => {
      if (
        state.sections &&
        state.sections[sectionId] &&
        state.sections[sectionId].content
      ) {
        return state.sections[sectionId].content;
      }
      return null;
    }),

    // Other utility mocks
    loadCriteriaConfiguration: vi.fn().mockResolvedValue({
      id: "test-criteria",
      name: "Test Evaluation Criteria",
      version: "1.0.0",
      criteria: [
        { id: "quality", name: "Quality", weight: 1, passingThreshold: 0.6 },
      ],
      passingThreshold: 0.7,
    }),

    // Path resolve mock
    pathResolve: vi.fn((...segments) => segments.join("/")),
  };
});

// Mock modules AFTER defining the hoisted mocks
vi.mock("../index.js", () => ({
  createEvaluationNode: mocks.createEvaluationNode,
  loadCriteriaConfiguration: mocks.loadCriteriaConfiguration,
}));

vi.mock("../extractors.js", () => ({
  extractResearchContent: mocks.extractResearchContent,
  extractSectionContent: mocks.extractSectionContent,
  createSectionExtractor: vi.fn((sectionId) => {
    return (state: any) => mocks.extractSectionContent(state, sectionId);
  }),
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

// Import after mocks are set up
import {
  OverallProposalState,
  ProcessingStatus,
  EvaluationResult,
  SectionProcessingStatus,
} from "../../state/proposal.state.js";
import { EvaluationNodeFactory } from "../factory.js";
import {
  extractResearchContent,
  createSectionExtractor,
} from "../extractors.js";

/**
 * Create a realistic test state that matches the OverallProposalState interface
 * This includes all required fields and nested structures
 */
function createTestState(
  overrides: Partial<OverallProposalState> = {}
): OverallProposalState {
  return {
    // Required base fields
    rfpDocument: {
      id: "test-rfp",
      text: "This is a test RFP document",
      status: "loaded" as const,
    },
    researchStatus: "completed" as ProcessingStatus,
    solutionSoughtStatus: "not_started" as ProcessingStatus,
    connectionPairsStatus: "not_started" as ProcessingStatus,
    sections: {},
    requiredSections: ["problem_statement", "solution"],
    currentStep: null,
    activeThreadId: "test-thread-123",
    messages: [],
    errors: [],
    createdAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    // Optional override fields
    ...overrides,
  };
}

/**
 * Create a state with research results
 */
function createStateWithResearch(): OverallProposalState {
  return createTestState({
    researchResults: {
      "Structural & Contextual Analysis": {
        "RFP Tone & Style": "Professional and detailed",
        "Salient Themes & Key Language": "Innovation, efficiency, scalability",
      },
      "Author/Organization Deep Dive": {
        "Company Background": "Fortune 500 technology company",
      },
    },
    researchStatus: "completed",
  });
}

/**
 * Create a state with section content
 */
function createStateWithSection(
  sectionId: string,
  content: string
): OverallProposalState {
  const state = createTestState();
  state.sections = {
    ...state.sections,
    [sectionId]: {
      id: sectionId,
      title: `Test ${sectionId}`,
      content: content,
      status: "completed" as SectionProcessingStatus,
      dependencies: [],
    },
  };
  return state;
}

describe("State Management in Evaluation Nodes", () => {
  let factory: EvaluationNodeFactory;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset extractors to default behavior
    mocks.extractResearchContent.mockImplementation((state) => {
      if (state.researchResults) {
        return JSON.stringify(state.researchResults);
      }
      return null;
    });

    mocks.extractSectionContent.mockImplementation((state, sectionId) => {
      if (
        state.sections &&
        state.sections[sectionId] &&
        state.sections[sectionId].content
      ) {
        return state.sections[sectionId].content;
      }
      return null;
    });

    // Create factory instance
    factory = new EvaluationNodeFactory({
      criteriaDirPath: "config/evaluation/criteria",
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("OverallProposalState compatibility", () => {
    it("should correctly access research fields in state", async () => {
      // Create a research evaluation node
      const evaluateResearch = factory.createResearchEvaluationNode();

      // Create a test state with research results
      const state = createStateWithResearch();

      // Call the evaluation node
      const result = await evaluateResearch(state);

      // Verify the extractor was called with the correct state
      expect(mocks.extractResearchContent).toHaveBeenCalledWith(state);

      // Verify the content was correctly extracted
      expect(mocks.extractResearchContent).toHaveReturnedWith(
        expect.stringContaining("Structural & Contextual Analysis")
      );

      // Verify state fields were updated correctly
      expect(result.researchStatus).toBe("awaiting_review");
      expect(result.researchEvaluation).toBeDefined();
      expect(result.researchEvaluation?.passed).toBe(true);
    });

    it("should correctly access section fields in state", async () => {
      // Create a section evaluation node
      const sectionId = "problem_statement";
      const sectionContent = "This is the problem statement content";

      const evaluateProblemStatement = factory.createNode("problem_statement", {
        contentExtractor: createSectionExtractor(sectionId),
        resultField: "sections.problem_statement.evaluation",
        statusField: "sections.problem_statement.status",
      });

      // Create a test state with section content
      const state = createStateWithSection(sectionId, sectionContent);

      // Call the evaluation node
      const result = await evaluateProblemStatement(state);

      // Verify the extractor was called with the correct state and section ID
      expect(mocks.extractSectionContent).toHaveBeenCalledWith(
        state,
        sectionId
      );

      // Verify the content was correctly extracted
      expect(mocks.extractSectionContent).toHaveReturnedWith(sectionContent);

      // Verify section state was updated correctly
      expect(result.sections.problem_statement.status).toBe("awaiting_review");
      expect(result.sections.problem_statement.evaluation).toBeDefined();
      expect(result.sections.problem_statement.evaluation?.passed).toBe(true);
    });

    it("should handle deeply nested fields in the state", async () => {
      // Create a test state with deeply nested structure
      const complexState = createTestState({
        nestedData: {
          level1: {
            level2: {
              level3: "Deep nested content",
            },
          },
        },
      });

      // Create a custom extractor for the nested data
      const nestedExtractor = vi.fn((state: any) => {
        return state.nestedData?.level1?.level2?.level3 || null;
      });

      // Create an evaluation node using the custom extractor
      const evaluateNested = factory.createNode("nested", {
        contentExtractor: nestedExtractor,
        resultField: "nestedEvaluation",
        statusField: "nestedStatus",
      });

      // Call the evaluation node
      const result = await evaluateNested(complexState);

      // Verify the extractor was called and accessed the deep structure
      expect(nestedExtractor).toHaveBeenCalledWith(complexState);
      expect(nestedExtractor).toHaveReturnedWith("Deep nested content");

      // Verify state was updated correctly
      expect(result.nestedStatus).toBe("awaiting_review");
      expect(result.nestedEvaluation).toBeDefined();
    });
  });

  describe("State updates and transitions", () => {
    it("should correctly update status fields", async () => {
      // Create an evaluation node
      const evaluateResearch = factory.createResearchEvaluationNode();

      // Create a test state
      const state = createStateWithResearch();
      state.researchStatus = "queued";

      // Call the evaluation node
      const result = await evaluateResearch(state);

      // Verify status was updated correctly
      expect(result.researchStatus).toBe("awaiting_review");
    });

    it("should add error messages to state.errors", async () => {
      // Force the content extractor to return null to trigger an error
      mocks.extractResearchContent.mockReturnValueOnce(null);

      // Create an evaluation node
      const evaluateResearch = factory.createResearchEvaluationNode();

      // Create a test state
      const state = createStateWithResearch();
      state.errors = ["previous error"];

      // Call the evaluation node
      const result = await evaluateResearch(state);

      // Verify error status
      expect(result.researchStatus).toBe("error");

      // Verify error was added to errors array
      expect(result.errors).toHaveLength(2);
      expect(result.errors[1]).toContain("research evaluation failed");
      expect(result.errors).toContain("previous error");
    });

    it("should add messages to state.messages", async () => {
      // Create an evaluation node
      const evaluateResearch = factory.createResearchEvaluationNode();

      // Create a test state with existing messages
      const state = createStateWithResearch();
      state.messages = [new HumanMessage({ content: "Previous message" })];

      // Call the evaluation node
      const result = await evaluateResearch(state);

      // Verify messages were updated
      expect(result.messages).toHaveLength(2);
      expect(result.messages[1].content).toContain(
        "research has been evaluated"
      );
    });

    it("should set interrupt flag correctly", async () => {
      // Create an evaluation node
      const evaluateResearch = factory.createResearchEvaluationNode();

      // Create a test state
      const state = createStateWithResearch();
      state.isInterrupted = false;

      // Call the evaluation node
      const result = await evaluateResearch(state);

      // Verify interrupt flag was set
      expect(result.isInterrupted).toBe(true);
      expect(result.interruptMetadata).toBeDefined();
      expect(result.interruptMetadata?.type).toBe("evaluation_review");
      expect(result.interruptMetadata?.contentType).toBe("research");
      expect(result.interruptMetadata?.actions).toContain("approve");
    });
  });

  describe("Error handling with state", () => {
    it("should handle missing content fields gracefully", async () => {
      // Create a state without research results
      const state = createTestState();

      // Create an evaluation node
      const evaluateResearch = factory.createResearchEvaluationNode();

      // Call the evaluation node
      const result = await evaluateResearch(state);

      // Verify error handling
      expect(result.researchStatus).toBe("error");
      expect(result.errors[0]).toContain("Content is missing or empty");
    });

    it("should handle missing sections gracefully", async () => {
      // Create a state without sections
      const state = createTestState();

      // Create a section evaluation node
      const evaluateProblemStatement = factory.createNode("problem_statement", {
        contentExtractor: createSectionExtractor("problem_statement"),
        resultField: "sections.problem_statement.evaluation",
        statusField: "sections.problem_statement.status",
      });

      // Call the evaluation node
      const result = await evaluateProblemStatement(state);

      // Verify error handling
      expect(result.errors[0]).toContain("problem_statement evaluation failed");
    });
  });
});
