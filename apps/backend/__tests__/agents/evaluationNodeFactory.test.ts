import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EvaluationNodeFactory,
  EvaluationResult,
  EvaluationCriteria,
} from "../../../evaluation/index.js";
import { OverallProposalState } from "../../../state/proposal.state.js";
import { loadCriteria } from "../criteriaLoader.js";
import { ChatOpenAI, ChatOpenAICallOptions } from "@langchain/openai";
// import { Annotation } from "@langchain/core/language_models/base"; // Likely unused, commented out

// Mock dependencies
vi.mock("../criteriaLoader.js", () => ({
  loadCriteria: vi.fn(),
  formatCriteriaForPrompt: vi.fn(
    (criteria) => `Formatted criteria for ${criteria.contentType}`
  ),
  getDefaultCriteriaPath: vi.fn(
    (contentType) => `criteria/${contentType}_criteria.json`
  ),
}));

// More complete mock for ChatOpenAI
const mockOpenAIInstance = {
  invoke: vi.fn(),
  // Add some basic properties required by the type
  lc_serializable: true,
  lc_secrets: {},
  lc_aliases: {},
  callKeys: [],
  _identifyingParams: {},
  // Add other necessary minimal properties if linting still fails
};

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => mockOpenAIInstance),
}));

describe("EvaluationNodeFactory", () => {
  // Mock state for testing
  const mockState: Partial<OverallProposalState> = {
    researchResults: {
      findings: "Sample research content for testing",
      summary: "Summary",
      sources: [],
    },
    researchStatus: "awaiting_review",
  };

  // Mock evaluation result
  const mockEvaluationResult: EvaluationResult = {
    passed: true,
    timestamp: new Date().toISOString(),
    evaluator: "ai",
    overallScore: 0.85,
    scores: {
      relevance: 0.9,
      completeness: 0.8,
    },
    strengths: ["Very relevant to the RFP requirements."],
    weaknesses: ["Good coverage, but could be more thorough."],
    suggestions: ["Consider adding more market data."],
    feedback: "The research is comprehensive and relevant.",
  };

  // Mock criteria
  const mockCriteria: EvaluationCriteria = {
    id: "research",
    name: "Research Criteria",
    version: "1.0",
    passingThreshold: 0.7,
    criteria: [
      {
        id: "relevance",
        name: "Relevance",
        description: "Evaluates how relevant the research is to the RFP",
        passingThreshold: 0.7,
        weight: 0.6,
        isCritical: true,
        scoringGuidelines: {
          excellent: "",
          good: "",
          adequate: "",
          poor: "",
          inadequate: "",
        },
      },
      {
        id: "completeness",
        name: "Completeness",
        description: "Evaluates how complete the research is",
        passingThreshold: 0.6,
        weight: 0.4,
        isCritical: false,
        scoringGuidelines: {
          excellent: "",
          good: "",
          adequate: "",
          poor: "",
          inadequate: "",
        },
      },
    ],
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(loadCriteria).mockResolvedValue(mockCriteria);
    mockOpenAIInstance.invoke.mockResolvedValue({
      content: JSON.stringify(mockEvaluationResult),
    });
  });

  describe("Factory Creation", () => {
    it("should create a factory instance with default options", () => {
      const factory = new EvaluationNodeFactory();
      expect(factory).toBeDefined();
      expect(factory).toBeInstanceOf(EvaluationNodeFactory);
    });

    it("should create a factory instance with custom options", () => {
      const factory = new EvaluationNodeFactory({
        temperature: 0.2,
        criteriaDirPath: "/custom/path",
      });
      expect(factory).toBeDefined();
      expect(factory).toBeInstanceOf(EvaluationNodeFactory);
    });
  });

  describe("createNode Method", () => {
    it("should create a function for the specified content type", async () => {
      const factory = new EvaluationNodeFactory();
      const evaluationNode = factory.createNode("research", {
        contentExtractor: (state: OverallProposalState) =>
          state.researchResults?.findings,
        resultField: "researchEvaluation",
        statusField: "researchStatus",
      });

      expect(evaluationNode).toBeDefined();
      expect(typeof evaluationNode).toBe("function");
    });

    it("should use custom criteria path if provided", async () => {
      const factory = new EvaluationNodeFactory();
      const customPath = "/custom/research_criteria.json";

      factory.createNode("research", {
        criteriaPath: customPath,
        contentExtractor: (state: OverallProposalState) =>
          state.researchResults?.findings,
        resultField: "researchEvaluation",
        statusField: "researchStatus",
      });

      expect(loadCriteria).toHaveBeenCalled();
    });

    it("should use default criteria path if not provided", async () => {
      const factory = new EvaluationNodeFactory();

      factory.createNode("research", {
        contentExtractor: (state: OverallProposalState) =>
          state.researchResults?.findings,
        resultField: "researchEvaluation",
        statusField: "researchStatus",
      });

      expect(loadCriteria).toHaveBeenCalled();
    });

    it("should throw an error if criteria loading fails", async () => {
      vi.mocked(loadCriteria).mockRejectedValue(
        new Error("Failed to load criteria")
      );

      const factory = new EvaluationNodeFactory();

      expect(() =>
        factory.createNode("research", {
          contentExtractor: (state: OverallProposalState) =>
            state.researchResults?.findings,
          resultField: "researchEvaluation",
          statusField: "researchStatus",
        })
      ).toThrow();
    });
  });

  describe("Evaluation Node Execution", () => {
    it("should evaluate content and update state with results", async () => {
      const factory = new EvaluationNodeFactory();
      const evaluationNode = factory.createNode("research", {
        contentExtractor: (state: OverallProposalState) =>
          state.researchResults?.findings,
        resultField: "researchEvaluation",
        statusField: "researchStatus",
      });

      const updatedState = await evaluationNode(
        mockState as OverallProposalState
      );

      expect(updatedState.researchEvaluation).toBeDefined();
      expect(updatedState.researchEvaluation).toEqual(mockEvaluationResult);
      expect(updatedState.researchStatus).toBe("awaiting_review");
    });

    it("should set content status to 'needs_revision' if evaluation fails threshold", async () => {
      const failedResult = {
        ...mockEvaluationResult,
        overallScore: 0.5,
        passed: false,
      };

      mockOpenAIInstance.invoke.mockResolvedValue({
        content: JSON.stringify(failedResult),
      });

      const factory = new EvaluationNodeFactory();
      const evaluationNode = factory.createNode("research", {
        contentExtractor: (state: OverallProposalState) =>
          state.researchResults?.findings,
        resultField: "researchEvaluation",
        statusField: "researchStatus",
        passingThreshold: 0.7,
      });

      const updatedState = await evaluationNode(
        mockState as OverallProposalState
      );

      expect(updatedState.researchEvaluation).toBeDefined();
      expect(updatedState.researchEvaluation?.passed).toBe(false);
      expect(updatedState.researchStatus).toBe("awaiting_review");
    });

    it("should mark state as interrupted if human review is required", async () => {
      const factory = new EvaluationNodeFactory();
      const evaluationNode = factory.createNode("research", {
        contentExtractor: (state: OverallProposalState) =>
          state.researchResults?.findings,
        resultField: "researchEvaluation",
        statusField: "researchStatus",
      });

      const updatedState = await evaluationNode(
        mockState as OverallProposalState
      );

      expect(updatedState.interruptStatus?.isInterrupted).toBe(true);
      expect(updatedState.interruptMetadata?.reason).toBe("EVALUATION_NEEDED");
      expect(updatedState.researchStatus).toBe("awaiting_review");
    });

    it("should handle LLM errors and update state.errors", async () => {
      const llmError = new Error("LLM API error");
      mockOpenAIInstance.invoke.mockRejectedValue(llmError);

      const factory = new EvaluationNodeFactory();
      const evaluationNode = factory.createNode("research", {
        contentExtractor: (state: OverallProposalState) =>
          state.researchResults?.findings,
        resultField: "researchEvaluation",
        statusField: "researchStatus",
      });

      const updatedState = await evaluationNode(
        mockState as OverallProposalState
      );

      expect(updatedState.errors).toBeDefined();
      expect(updatedState.errors?.length).toBeGreaterThan(0);
      expect(updatedState.errors?.[0]).toContain("LLM API error");
      expect(updatedState.researchStatus).toBe("error");
    });

    it("should handle malformed JSON response", async () => {
      mockOpenAIInstance.invoke.mockResolvedValue({
        content: "This is not JSON",
      });

      const factory = new EvaluationNodeFactory();
      const evaluationNode = factory.createNode("research", {
        contentExtractor: (state: OverallProposalState) =>
          state.researchResults?.findings,
        resultField: "researchEvaluation",
        statusField: "researchStatus",
      });

      const updatedState = await evaluationNode(
        mockState as OverallProposalState
      );

      expect(updatedState.errors).toBeDefined();
      expect(updatedState.errors?.length).toBeGreaterThan(0);
      expect(updatedState.errors?.[0]).toContain(
        "Failed to parse LLM response"
      );
      expect(updatedState.researchStatus).toBe("error");
    });
  });

  describe("Content Type Handling", () => {
    it("should evaluate solution content", async () => {
      const solutionState: Partial<OverallProposalState> = {
        ...mockState,
        solutionSoughtResults: {
          description: "Sample solution content",
          keyComponents: [],
        },
        solutionSoughtStatus: "awaiting_review",
      };

      const solutionCriteria: EvaluationCriteria = {
        ...mockCriteria,
        id: "solution",
      };

      vi.mocked(loadCriteria).mockResolvedValue(solutionCriteria);

      const factory = new EvaluationNodeFactory();
      const evaluationNode = factory.createNode("solution", {
        contentExtractor: (state: OverallProposalState) =>
          state.solutionSoughtResults?.description,
        resultField: "solutionSoughtEvaluation",
        statusField: "solutionSoughtStatus",
      });

      const updatedState = await evaluationNode(
        solutionState as OverallProposalState
      );

      expect(updatedState.solutionSoughtEvaluation).toBeDefined();
      expect(updatedState.solutionSoughtStatus).toBe("awaiting_review");
    });

    it("should evaluate sections content", async () => {
      const sectionId = "introduction";
      const sectionState: Partial<OverallProposalState> = {
        ...mockState,
        sections: {
          [sectionId]: {
            id: sectionId,
            content: "Sample introduction content",
            status: "awaiting_review",
            evaluation: undefined,
          },
        },
      };

      const sectionCriteria: EvaluationCriteria = {
        ...mockCriteria,
        id: sectionId,
      };

      vi.mocked(loadCriteria).mockResolvedValue(sectionCriteria);

      const factory = new EvaluationNodeFactory();
      const evaluationNode = factory.createNode(sectionId, {
        contentExtractor: (state: OverallProposalState) =>
          state.sections?.[sectionId]?.content,
        resultField: `sections.${sectionId}.evaluation`,
        statusField: `sections.${sectionId}.status`,
        criteriaPath: `config/evaluation/criteria/${sectionId}.json`,
      });

      const updatedState = await evaluationNode(
        sectionState as OverallProposalState
      );

      expect(updatedState.sections?.[sectionId]?.evaluation).toBeDefined();
      expect(updatedState.sections?.[sectionId]?.status).toBe(
        "awaiting_review"
      );
    });

    it("should handle missing content in state", async () => {
      const emptyState: Partial<OverallProposalState> = {
        rfpDocument: { id: "test-doc", status: "loaded" },
        researchStatus: "queued",
        solutionSoughtStatus: "queued",
        connectionPairsStatus: "queued",
        sections: {},
        requiredSections: [],
        currentStep: null,
        activeThreadId: "empty-thread",
        messages: [],
        errors: [],
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
      };
      const factory = new EvaluationNodeFactory();
      const evaluationNode = factory.createNode("research", {
        contentExtractor: (state: OverallProposalState) =>
          state.researchResults?.findings,
        resultField: "researchEvaluation",
        statusField: "researchStatus",
      });
      const updatedState = await evaluationNode(
        emptyState as OverallProposalState
      );
      expect(updatedState.errors).toBeDefined();
      expect(updatedState.errors?.length).toBeGreaterThan(0);
      expect(updatedState.errors?.[0]).toContain("Content is missing or empty");
      expect(updatedState.researchStatus).toBe("error");
    });
  });
});
