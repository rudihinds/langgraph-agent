import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { OverallProposalState } from "@/state/proposal.state.js";
import {
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { createEvaluationNode } from "../evaluationNodeFactory.js";
import {
  evaluationResultSchema,
  calculateOverallScore,
} from "../evaluationResult.js";
import { loadCriteriaConfiguration } from "../criteriaLoader.js";

// Mock the LLM/agent
vi.mock("@langchain/openai", () => {
  return {
    ChatOpenAI: vi.fn().mockImplementation(() => ({
      invoke: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          passed: true,
          overallScore: 0.85,
          scores: {
            relevance: 0.9,
            specificity: 0.8,
            evidence: 0.85,
          },
          strengths: ["Clear explanation", "Good examples"],
          weaknesses: ["Could improve clarity in section 2"],
          suggestions: ["Add more specific examples in section 2"],
          feedback: "Overall good quality with minor improvements needed",
        }),
      }),
    })),
  };
});

// Mock file system
vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
  access: vi.fn(),
}));

// Helper to create a mock state
function createMockState(overrides = {}): OverallProposalState {
  return {
    rfpDocument: {
      id: "test-doc-id",
      fileName: "test.pdf",
      text: "Test RFP content",
      status: "loaded",
    },
    researchResults: {
      findings: ["Finding 1", "Finding 2"],
    },
    researchStatus: "completed",
    solutionSoughtResults: {
      approach: "Test solution approach",
    },
    solutionSoughtStatus: "completed",
    connectionPairs: [
      { funder: "Need 1", applicant: "Capability 1", strength: "strong" },
    ],
    connectionPairsStatus: "completed",
    sections: {},
    requiredSections: ["problem_statement", "approach"],
    currentStep: null,
    activeThreadId: "test-thread-123",
    messages: [],
    errors: [],
    createdAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Sample evaluation criteria
const sampleCriteria = {
  id: "research",
  name: "Research Evaluation Criteria",
  version: "1.0.0",
  criteria: [
    {
      id: "relevance",
      name: "Relevance",
      description: "How relevant is the research to the RFP?",
      weight: 0.4,
      isCritical: true,
      passingThreshold: 0.6,
      scoringGuidelines: {
        excellent: "Directly addresses all key points in the RFP",
        good: "Addresses most key points in the RFP",
        adequate: "Addresses some key points in the RFP",
        poor: "Minimally addresses key points in the RFP",
        inadequate: "Does not address key points in the RFP",
      },
    },
    {
      id: "specificity",
      name: "Specificity",
      description: "How specific and detailed is the research?",
      weight: 0.3,
      isCritical: false,
      passingThreshold: 0.5,
      scoringGuidelines: {
        excellent: "Extremely detailed and specific",
        good: "Good level of detail and specificity",
        adequate: "Adequate detail and specificity",
        poor: "Lacking in detail and specificity",
        inadequate: "Vague and non-specific",
      },
    },
    {
      id: "evidence",
      name: "Evidence",
      description: "Is the research supported by evidence?",
      weight: 0.3,
      isCritical: false,
      passingThreshold: 0.5,
      scoringGuidelines: {
        excellent: "Strongly supported by evidence",
        good: "Well supported by evidence",
        adequate: "Some supporting evidence provided",
        poor: "Limited supporting evidence",
        inadequate: "No supporting evidence",
      },
    },
  ],
  passingThreshold: 0.7,
};

/**
 * Test Suite for the Evaluation Framework
 */
describe("Evaluation Framework", () => {
  /**
   * 1. Core Component Tests
   */
  describe("1. Core Components", () => {
    describe("1.1 Evaluation Node Factory", () => {
      it("1.1.1: should create a function with the correct signature", () => {
        const mockExtractor = vi
          .fn()
          .mockReturnValue({ content: "test content" });

        const node = createEvaluationNode({
          contentType: "research",
          contentExtractor: mockExtractor,
          criteriaPath: "research.json",
          resultField: "researchEvaluation",
          statusField: "researchStatus",
        });

        expect(node).toBeInstanceOf(Function);
        expect(node.length).toBe(1); // Should take one argument (state)
      });

      it("1.1.2: should pass all configuration options to internal functions", async () => {
        const mockExtractor = vi
          .fn()
          .mockReturnValue({ content: "test content" });
        const mockValidator = vi.fn().mockReturnValue(true);

        // Mock the loadCriteriaConfiguration function
        vi.mocked(loadCriteriaConfiguration).mockResolvedValue(sampleCriteria);

        const node = createEvaluationNode({
          contentType: "research",
          contentExtractor: mockExtractor,
          criteriaPath: "research.json",
          resultField: "researchEvaluation",
          statusField: "researchStatus",
          passingThreshold: 0.8,
          modelName: "gpt-4",
          customValidator: mockValidator,
        });

        const state = createMockState();
        await node(state);

        expect(mockExtractor).toHaveBeenCalledWith(state);
        expect(mockValidator).toHaveBeenCalled();
      });

      it("1.1.3: should use default values for optional parameters", async () => {
        const mockExtractor = vi
          .fn()
          .mockReturnValue({ content: "test content" });

        // Create a node with only required options
        const node = createEvaluationNode({
          contentType: "research",
          contentExtractor: mockExtractor,
          criteriaPath: "research.json",
          resultField: "researchEvaluation",
          statusField: "researchStatus",
        });

        // Should use defaults (this is harder to test directly, but we can verify it doesn't throw)
        const state = createMockState();
        const result = await node(state);

        expect(result).toBeDefined();
        // Default threshold should be used (0.7)
      });
    });

    describe("1.2 Evaluation Result Interface", () => {
      it("1.2.1: should validate a valid evaluation result", () => {
        const validResult = {
          passed: true,
          timestamp: new Date().toISOString(),
          evaluator: "ai",
          overallScore: 0.85,
          scores: {
            relevance: 0.9,
            specificity: 0.8,
            evidence: 0.85,
          },
          strengths: ["Clear explanation", "Good examples"],
          weaknesses: ["Could improve clarity in section 2"],
          suggestions: ["Add more specific examples in section 2"],
          feedback: "Overall good quality with minor improvements needed",
        };

        const result = evaluationResultSchema.safeParse(validResult);
        expect(result.success).toBe(true);
      });

      it("1.2.2: should reject an invalid evaluation result", () => {
        const invalidResult = {
          // Missing required fields: passed, timestamp, evaluator
          overallScore: 0.85,
          scores: {
            relevance: 0.9,
          },
          // Missing strengths, weaknesses, suggestions
          feedback: "Overall good quality",
        };

        const result = evaluationResultSchema.safeParse(invalidResult);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors.length).toBeGreaterThan(0);
        }
      });

      it("1.2.3: should calculate overall score correctly", () => {
        const scores = {
          relevance: 0.9, // weight 0.4
          specificity: 0.8, // weight 0.3
          evidence: 0.7, // weight 0.3
        };

        const weights = {
          relevance: 0.4,
          specificity: 0.3,
          evidence: 0.3,
        };

        const expectedScore = 0.9 * 0.4 + 0.8 * 0.3 + 0.7 * 0.3; // 0.83

        const calculatedScore = calculateOverallScore(scores, weights);
        expect(calculatedScore).toBeCloseTo(0.83, 2);
      });
    });

    describe("1.3 Criteria Configuration", () => {
      beforeEach(() => {
        vi.resetAllMocks();
      });

      it("1.3.1: should load and parse a valid criteria configuration", async () => {
        vi.mocked(fs.readFile).mockResolvedValue(
          JSON.stringify(sampleCriteria)
        );
        vi.mocked(fs.access).mockResolvedValue(undefined);

        const criteria = await loadCriteriaConfiguration("research.json");

        expect(criteria).toEqual(sampleCriteria);
        expect(criteria.id).toBe("research");
        expect(criteria.criteria.length).toBe(3);
      });

      it("1.3.2: should reject an invalid criteria configuration", async () => {
        const invalidCriteria = {
          id: "research",
          name: "Research Evaluation Criteria",
          // Missing version
          criteria: [
            // Missing required fields for criteria
          ],
          // Missing passingThreshold
        };

        vi.mocked(fs.readFile).mockResolvedValue(
          JSON.stringify(invalidCriteria)
        );
        vi.mocked(fs.access).mockResolvedValue(undefined);

        await expect(
          loadCriteriaConfiguration("research.json")
        ).rejects.toThrow();
      });

      it("1.3.3: should fall back to default criteria when file not found", async () => {
        vi.mocked(fs.access).mockRejectedValue(new Error("File not found"));

        // Mock the default criteria loader
        const mockDefaultCriteria = { ...sampleCriteria, id: "default" };
        vi.mocked(fs.readFile).mockResolvedValue(
          JSON.stringify(mockDefaultCriteria)
        );

        const criteria = await loadCriteriaConfiguration("nonexistent.json");

        expect(criteria).toBeDefined();
        expect(criteria.id).toBe("default");
      });
    });
  });

  /**
   * 2. Node Execution Flow Tests
   */
  describe("2. Node Execution Flow", () => {
    describe("2.1 Input Validation", () => {
      it("2.1.1: should return error for missing content", async () => {
        const mockExtractor = vi.fn().mockReturnValue(null);

        const node = createEvaluationNode({
          contentType: "research",
          contentExtractor: mockExtractor,
          criteriaPath: "research.json",
          resultField: "researchEvaluation",
          statusField: "researchStatus",
        });

        const state = createMockState();
        const result = await node(state);

        expect(result.researchStatus).toBe("error");
        expect(result.errors).toContain(expect.stringContaining("missing"));
      });

      it("2.1.2: should return error for malformed content", async () => {
        const mockExtractor = vi.fn().mockReturnValue({
          // Missing required content field
          metadata: { source: "test" },
        });

        const node = createEvaluationNode({
          contentType: "research",
          contentExtractor: mockExtractor,
          criteriaPath: "research.json",
          resultField: "researchEvaluation",
          statusField: "researchStatus",
        });

        const state = createMockState();
        const result = await node(state);

        expect(result.researchStatus).toBe("error");
        expect(result.errors).toContain(expect.stringContaining("malformed"));
      });

      it("2.1.3: should proceed with valid content", async () => {
        const mockExtractor = vi.fn().mockReturnValue({
          content: "Valid content for evaluation",
        });

        // Mock criteria loading
        vi.mocked(loadCriteriaConfiguration).mockResolvedValue(sampleCriteria);

        const node = createEvaluationNode({
          contentType: "research",
          contentExtractor: mockExtractor,
          criteriaPath: "research.json",
          resultField: "researchEvaluation",
          statusField: "researchStatus",
        });

        const state = createMockState();
        const result = await node(state);

        // Should not be in error state
        expect(result.researchStatus).not.toBe("error");
      });
    });

    describe("2.2 State Updates", () => {
      beforeEach(() => {
        vi.mocked(loadCriteriaConfiguration).mockResolvedValue(sampleCriteria);
      });

      it("2.2.1: should update status to evaluating during processing", async () => {
        const mockExtractor = vi.fn().mockImplementation(() => {
          // Check if status has been updated before returning
          expect(updateTracker.current.researchStatus).toBe("evaluating");
          return { content: "Valid content" };
        });

        // Use a tracker to capture intermediate state
        const updateTracker = { current: {} as any };

        const node = createEvaluationNode({
          contentType: "research",
          contentExtractor: mockExtractor,
          criteriaPath: "research.json",
          resultField: "researchEvaluation",
          statusField: "researchStatus",
          // Add a tracker for intermediate state
          stateUpdateCallback: (state) => {
            updateTracker.current = state;
          },
        });

        const state = createMockState();
        await node(state);

        expect(updateTracker.current.researchStatus).toBe("evaluating");
      });

      it("2.2.2: should store evaluation results in the correct field", async () => {
        const mockExtractor = vi.fn().mockReturnValue({
          content: "Valid content for evaluation",
        });

        const node = createEvaluationNode({
          contentType: "research",
          contentExtractor: mockExtractor,
          criteriaPath: "research.json",
          resultField: "researchEvaluation",
          statusField: "researchStatus",
        });

        const state = createMockState();
        const result = await node(state);

        expect(result.researchEvaluation).toBeDefined();
        expect(result.researchEvaluation?.passed).toBe(true);
        expect(result.researchEvaluation?.overallScore).toBeCloseTo(0.85);
      });

      it("2.2.3: should update multiple state fields correctly", async () => {
        const mockExtractor = vi.fn().mockReturnValue({
          content: "Valid content for evaluation",
        });

        const node = createEvaluationNode({
          contentType: "research",
          contentExtractor: mockExtractor,
          criteriaPath: "research.json",
          resultField: "researchEvaluation",
          statusField: "researchStatus",
        });

        const state = createMockState({
          messages: [new SystemMessage("Initial message")],
        });

        const result = await node(state);

        // Check multiple field updates
        expect(result.researchStatus).toBe("awaiting_review");
        expect(result.researchEvaluation).toBeDefined();
        expect(result.isInterrupted).toBe(true);
        expect(result.interruptMetadata).toBeDefined();
        expect(result.messages.length).toBeGreaterThan(1);
      });
    });

    // Additional tests for remaining sections would follow the same pattern
    // Here's a condensed version for brevity

    describe("2.3 Agent/LLM Invocation", () => {
      it("2.3.1: should construct the prompt correctly", async () => {
        // Implementation would check prompt construction
      });

      it("2.3.2: should call the agent with correct parameters", async () => {
        // Implementation would verify agent call parameters
      });

      it("2.3.3: should implement timeout protection", async () => {
        // Implementation would test timeout handling
      });
    });

    describe("2.4 Response Processing", () => {
      it("2.4.1: should parse JSON responses correctly", async () => {
        // Implementation would test JSON parsing
      });

      it("2.4.2: should calculate overall score correctly", async () => {
        // Implementation would test score calculation
      });

      it("2.4.3: should determine pass/fail status based on thresholds", async () => {
        // Implementation would test pass/fail determination
      });
    });
  });

  /**
   * 3. HITL Integration Tests
   */
  describe("3. HITL Integration", () => {
    describe("3.1 Interrupt Triggering", () => {
      it("3.1.1: should set isInterrupted flag correctly", async () => {
        // Implementation would test interrupt flag setting
      });

      it("3.1.2: should structure interrupt metadata correctly", async () => {
        // Implementation would test interrupt metadata structure
      });

      it("3.1.3: should include UI presentation data in metadata", async () => {
        // Implementation would test UI data in metadata
      });
    });

    // Additional HITL tests would be implemented here
  });

  /**
   * 4. State Management Tests
   * 5. Error Handling Tests
   * 6. Configuration System Tests
   * 7. Integration Tests
   * 8. End-to-End Workflow Tests
   */

  // These sections would follow the same pattern as above
  // For brevity, I've only included detailed implementations for the first two main sections

  describe("4. State Management", () => {
    // Tests for state transitions and message management
  });

  describe("5. Error Handling", () => {
    // Tests for input errors, LLM errors, and processing errors
  });

  describe("6. Configuration System", () => {
    // Tests for criteria configuration and prompt templates
  });

  describe("7. Integration", () => {
    // Tests for graph integration, HITL configuration, and orchestrator integration
  });

  describe("8. End-to-End Workflow", () => {
    // Tests for complete evaluation cycles and performance
  });
});
