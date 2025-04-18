import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  OverallProposalState,
  SectionType,
  SectionData,
} from "@/state/proposal.state.js";
import { evaluateConnectionsNode } from "../nodes.js";
import { createConnectionEvaluationAgent } from "../agents.js";
import { Logger } from "@/lib/logger.js";
import {
  AIMessage,
  HumanMessage,
  BaseMessage,
  SystemMessage,
} from "@langchain/core/messages";

// Define the expected partial return type for the node
type EvaluateConnectionsNodeReturn = Partial<{
  connectionsStatus: OverallProposalState["connectionsStatus"];
  connectionsEvaluation: OverallProposalState["connectionsEvaluation"];
  interruptStatus: OverallProposalState["interruptStatus"];
  interruptMetadata: OverallProposalState["interruptMetadata"];
  messages: BaseMessage[];
  errors: string[];
  status: OverallProposalState["status"];
}>;

// Mock the agent creation function
vi.mock("../agents.js", () => ({
  createConnectionEvaluationAgent: vi.fn(),
}));

// Mock the logger
vi.mock("@/lib/logger.js", () => ({
  Logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("evaluateConnectionsNode", () => {
  let mockState: OverallProposalState;
  let mockAgentInvoke: ReturnType<typeof vi.fn>;
  const mockLoggerInfo = vi.mocked(Logger.info);
  const mockLoggerError = vi.mocked(Logger.error);
  const mockLoggerWarn = vi.mocked(Logger.warn);

  const createMockState = (
    overrides: Partial<OverallProposalState> = {}
  ): OverallProposalState => {
    const baseState: OverallProposalState = {
      // Base required fields
      userId: "test-user-id",
      proposalId: "test-proposal-id",
      status: "running",
      errors: [],
      messages: [],
      sections: new Map<SectionType, SectionData>(),

      // Fields specific to connection evaluation
      connections: [
        "Funder prioritizes education access, applicant has expertise in digital learning platforms",
        "Funder seeks climate solutions, applicant has developed sustainable energy technologies",
        "Funder values community impact, applicant has strong local partnerships",
      ],
      connectionsStatus: "completed",
      connectionsEvaluation: undefined,

      // Other required fields with default values
      documentLoaded: true,
      documentContent: "Sample document content",
      documentStatus: "completed",
      researchStatus: "completed",
      researchResults: {
        funderAnalysis: "Sample funder analysis",
        priorities: [
          "Education access",
          "Climate solutions",
          "Community impact",
        ],
        evaluationCriteria: ["Innovation", "Reach", "Sustainability"],
        requirements: "Sample requirements",
      },
      researchEvaluation: {
        score: 8,
        passed: true,
        feedback: "Good research",
        strengths: ["Comprehensive", "Clear"],
        weaknesses: ["Could be more detailed"],
        suggestions: ["Add more specifics"],
      },
      solutionStatus: "completed",
      solutionResults: {
        problemStatement: "Sample problem statement",
        proposedSolution: "Sample proposed solution",
        impactStatement: "Sample impact statement",
        targetPopulation: "Sample target population",
        innovationFactors: ["Factor 1", "Factor 2"],
      },
      solutionEvaluation: {
        score: 7,
        passed: true,
        feedback: "Good solution",
        strengths: ["Innovative", "Clear"],
        weaknesses: ["Limited scope"],
        suggestions: ["Expand reach"],
      },
      interruptStatus: undefined,
      interruptMetadata: undefined,
    };

    return { ...baseState, ...overrides };
  };

  beforeEach(() => {
    // Reset the mock state before each test
    mockState = createMockState();

    // Setup agent mock
    mockAgentInvoke = vi.fn();
    vi.mocked(createConnectionEvaluationAgent).mockReturnValue({
      invoke: mockAgentInvoke,
    } as any);

    // Clear all mock calls
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==================== Input Validation Tests ====================
  describe("Input Validation", () => {
    it("should return error when connections is missing", async () => {
      mockState = createMockState({
        connections: undefined,
      });

      const result = await evaluateConnectionsNode(mockState);

      expect(result.connectionsStatus).toBe("error");
      expect(result.errors).toContain("No connection pairs found to evaluate.");
      expect(mockLoggerError).toHaveBeenCalled();
      expect(mockAgentInvoke).not.toHaveBeenCalled();
    });

    it("should return error when connections is empty", async () => {
      mockState = createMockState({
        connections: [],
      });

      const result = await evaluateConnectionsNode(mockState);

      expect(result.connectionsStatus).toBe("error");
      expect(result.errors).toContain("No connection pairs found to evaluate.");
      expect(mockLoggerError).toHaveBeenCalled();
      expect(mockAgentInvoke).not.toHaveBeenCalled();
    });

    it("should return error when connections are not in the expected format", async () => {
      mockState = createMockState({
        connections: [null, undefined, ""] as any,
      });

      const result = await evaluateConnectionsNode(mockState);

      expect(result.connectionsStatus).toBe("error");
      expect(result.errors).toContain("Invalid connection pairs format.");
      expect(mockLoggerError).toHaveBeenCalled();
      expect(mockAgentInvoke).not.toHaveBeenCalled();
    });
  });

  // ==================== Agent Invocation Tests ====================
  describe("Agent Invocation", () => {
    it("should invoke the evaluation agent with proper input", async () => {
      // Setup a successful response
      const mockEvaluationResponse = {
        score: 8,
        passed: true,
        feedback:
          "Connection pairs show good alignment between funder priorities and applicant capabilities.",
        strengths: [
          "Clear alignment with mission",
          "Addresses specific priorities",
        ],
        weaknesses: ["Could be more specific in some areas"],
        suggestions: [
          "Add more quantifiable impact metrics",
          "Strengthen connection to timeline",
        ],
      };

      mockAgentInvoke.mockResolvedValue({
        messages: [
          new AIMessage({ content: JSON.stringify(mockEvaluationResponse) }),
        ],
      });

      await evaluateConnectionsNode(mockState);

      // Verify the agent was created with correct parameters
      expect(createConnectionEvaluationAgent).toHaveBeenCalled();

      // Verify the agent was invoked with the correct data
      expect(mockAgentInvoke).toHaveBeenCalledWith({
        connections: mockState.connections,
        researchResults: mockState.researchResults,
        solutionResults: mockState.solutionResults,
      });
    });

    it("should handle agent invocation timeouts", async () => {
      // Simulate a timeout error
      mockAgentInvoke.mockRejectedValue(
        new Error("Request timed out after 60 seconds")
      );

      const result = await evaluateConnectionsNode(mockState);

      expect(result.connectionsStatus).toBe("error");
      expect(result.errors).toContain(expect.stringMatching(/timeout/i));
      expect(mockLoggerError).toHaveBeenCalled();
    });

    it("should handle agent rate limit errors", async () => {
      // Simulate a rate limit error
      mockAgentInvoke.mockRejectedValue(new Error("Rate limit exceeded"));

      const result = await evaluateConnectionsNode(mockState);

      expect(result.connectionsStatus).toBe("error");
      expect(result.errors).toContain(expect.stringMatching(/rate limit/i));
      expect(mockLoggerError).toHaveBeenCalled();
    });

    it("should handle generic agent errors", async () => {
      // Simulate a generic error
      mockAgentInvoke.mockRejectedValue(new Error("Unknown error occurred"));

      const result = await evaluateConnectionsNode(mockState);

      expect(result.connectionsStatus).toBe("error");
      expect(result.errors).toContain(
        expect.stringMatching(/Failed to evaluate connection pairs/)
      );
      expect(mockLoggerError).toHaveBeenCalled();
    });
  });

  // ==================== Response Processing Tests ====================
  describe("Response Processing", () => {
    it("should correctly parse valid JSON responses", async () => {
      const mockEvaluationResponse = {
        score: 8,
        passed: true,
        feedback:
          "Connection pairs show good alignment between funder priorities and applicant capabilities.",
        strengths: [
          "Clear alignment with mission",
          "Addresses specific priorities",
        ],
        weaknesses: ["Could be more specific in some areas"],
        suggestions: [
          "Add more quantifiable impact metrics",
          "Strengthen connection to timeline",
        ],
      };

      mockAgentInvoke.mockResolvedValue({
        messages: [
          new AIMessage({ content: JSON.stringify(mockEvaluationResponse) }),
        ],
      });

      const result = await evaluateConnectionsNode(mockState);

      expect(result.connectionsStatus).toBe("awaiting_review");
      expect(result.connectionsEvaluation).toBeDefined();
      expect(result.connectionsEvaluation?.score).toBe(8);
      expect(result.connectionsEvaluation?.passed).toBe(true);
      expect(result.connectionsEvaluation?.strengths).toHaveLength(2);
      expect(result.connectionsEvaluation?.weaknesses).toHaveLength(1);
      expect(result.connectionsEvaluation?.suggestions).toHaveLength(2);
    });

    it("should handle malformed JSON responses", async () => {
      const malformedJSON = `
        {
          "score": 7,
          "passed": true,
          "feedback": "Good connections but could be stronger",
          "strengths": ["Addresses key priorities"]
          "weaknesses": ["Missing specificity"],
          "suggestions": ["Be more detailed"]
        }
      `; // Note the missing comma after "strengths" array

      mockAgentInvoke.mockResolvedValue({
        messages: [new AIMessage({ content: malformedJSON })],
      });

      const result = await evaluateConnectionsNode(mockState);

      expect(result.connectionsStatus).toBe("error");
      expect(result.errors).toContain(
        expect.stringMatching(/Failed to parse evaluation response/)
      );
      expect(mockLoggerError).toHaveBeenCalled();
    });

    it("should handle responses missing required fields", async () => {
      const incompleteResponse = {
        score: 6,
        // missing 'passed' field
        feedback: "Decent connections overall",
        strengths: ["Some good matches"],
        // missing weaknesses
        suggestions: ["Improve specificity"],
      };

      mockAgentInvoke.mockResolvedValue({
        messages: [
          new AIMessage({ content: JSON.stringify(incompleteResponse) }),
        ],
      });

      const result = await evaluateConnectionsNode(mockState);

      expect(result.connectionsStatus).toBe("error");
      expect(result.errors).toContain(
        expect.stringMatching(/Evaluation response missing required fields/)
      );
      expect(mockLoggerWarn).toHaveBeenCalled();
    });

    it("should handle non-JSON text responses by attempting to extract information", async () => {
      const textResponse = `
        Evaluation Score: 7
        Passed: Yes
        
        Feedback: The connection pairs demonstrate alignment between funder priorities and applicant capabilities.
        
        Strengths:
        - Addresses education access priority
        - Matches climate solutions with technologies
        
        Weaknesses:
        - Lacks specific metrics for impact
        
        Suggestions:
        - Add quantitative measures
        - Provide more implementation details
      `;

      mockAgentInvoke.mockResolvedValue({
        messages: [new AIMessage({ content: textResponse })],
      });

      const result = await evaluateConnectionsNode(mockState);

      // Should extract a reasonable evaluation from the text
      expect(result.connectionsStatus).toBe("awaiting_review");
      expect(result.connectionsEvaluation).toBeDefined();
      expect(result.connectionsEvaluation?.passed).toBe(true);
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringMatching(/Falling back to regex extraction/)
      );
    });
  });

  // ==================== State Management Tests ====================
  describe("State Management", () => {
    it("should set appropriate interrupt status for human review", async () => {
      const mockEvaluationResponse = {
        score: 8,
        passed: true,
        feedback:
          "Connection pairs show good alignment between funder priorities and applicant capabilities.",
        strengths: [
          "Clear alignment with mission",
          "Addresses specific priorities",
        ],
        weaknesses: ["Could be more specific in some areas"],
        suggestions: [
          "Add more quantifiable impact metrics",
          "Strengthen connection to timeline",
        ],
      };

      mockAgentInvoke.mockResolvedValue({
        messages: [
          new AIMessage({ content: JSON.stringify(mockEvaluationResponse) }),
        ],
      });

      const result = await evaluateConnectionsNode(mockState);

      // Verify interrupt status
      expect(result.interruptStatus).toBeDefined();
      expect(result.interruptStatus?.isInterrupted).toBe(true);
      expect(result.interruptStatus?.interruptionPoint).toBe(
        "evaluateConnections"
      );
      expect(result.interruptStatus?.feedback).toBeNull();
      expect(result.interruptStatus?.processingStatus).toBe("pending");

      // Verify interrupt metadata
      expect(result.interruptMetadata).toBeDefined();
      expect(result.interruptMetadata?.reason).toBe("EVALUATION_NEEDED");
      expect(result.interruptMetadata?.nodeId).toBe("evaluateConnectionsNode");
      expect(result.interruptMetadata?.contentReference).toBe("connections");
      expect(result.interruptMetadata?.timestamp).toBeDefined();
      expect(result.interruptMetadata?.evaluationResult).toBeDefined();
      expect(result.interruptMetadata?.evaluationResult).toEqual(
        mockEvaluationResponse
      );

      // Verify status updates
      expect(result.connectionsStatus).toBe("awaiting_review");
      expect(result.status).toBe("awaiting_review");
    });

    it("should correctly update state on successful execution", async () => {
      const mockEvaluationResponse = {
        score: 8,
        passed: true,
        feedback:
          "Connection pairs show good alignment between funder priorities and applicant capabilities.",
        strengths: [
          "Clear alignment with mission",
          "Addresses specific priorities",
        ],
        weaknesses: ["Could be more specific in some areas"],
        suggestions: [
          "Add more quantifiable impact metrics",
          "Strengthen connection to timeline",
        ],
      };

      mockAgentInvoke.mockResolvedValue({
        messages: [
          new AIMessage({ content: JSON.stringify(mockEvaluationResponse) }),
        ],
      });

      const result = await evaluateConnectionsNode(mockState);

      expect(result.connectionsStatus).toBe("awaiting_review");
      expect(result.connectionsEvaluation).toEqual(mockEvaluationResponse);
      expect(result.errors).toEqual([]);
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        expect.stringMatching(/Successfully evaluated/)
      );
    });

    it("should add appropriate error messages to the state on failure", async () => {
      mockState = createMockState({
        connections: undefined,
      });

      const result = await evaluateConnectionsNode(mockState);

      expect(result.errors).toContain("No connection pairs found to evaluate.");

      const systemMessages = result.messages?.filter(
        (m: BaseMessage) => m._getType() === "system"
      );

      expect(
        systemMessages?.some(
          (m: BaseMessage) =>
            typeof m.content === "string" &&
            m.content.includes("Connection pairs evaluation failed")
        )
      ).toBe(true);
    });

    it("should clear previous node-specific errors on successful execution", async () => {
      const mockEvaluationResponse = {
        score: 8,
        passed: true,
        feedback:
          "Connection pairs show good alignment between funder priorities and applicant capabilities.",
        strengths: [
          "Clear alignment with mission",
          "Addresses specific priorities",
        ],
        weaknesses: ["Could be more specific in some areas"],
        suggestions: [
          "Add more quantifiable impact metrics",
          "Strengthen connection to timeline",
        ],
      };

      mockAgentInvoke.mockResolvedValue({
        messages: [
          new AIMessage({ content: JSON.stringify(mockEvaluationResponse) }),
        ],
      });

      mockState = createMockState({
        errors: ["Previous error related to connection evaluation node"],
      });

      const result = await evaluateConnectionsNode(mockState);

      expect(result.connectionsStatus).toBe("awaiting_review");
      expect(result.errors).toEqual([]);
    });
  });
});
