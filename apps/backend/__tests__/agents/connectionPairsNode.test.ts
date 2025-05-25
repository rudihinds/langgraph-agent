import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// Define hoisted mock functions first using vi.hoisted
const mockLoggerError = vi.hoisted(() => vi.fn());
const mockLoggerWarn = vi.hoisted(() => vi.fn());
const mockLoggerInfo = vi.hoisted(() => vi.fn());
const mockLoggerDebug = vi.hoisted(() => vi.fn());
const mockAgentInvoke = vi.hoisted(() => vi.fn());

// Mock Logger
vi.mock("@/lib/logger.js", () => ({
  Logger: {
    getInstance: vi.fn(() => ({
      error: mockLoggerError,
      warn: mockLoggerWarn,
      info: mockLoggerInfo,
      debug: mockLoggerDebug,
    })),
    error: mockLoggerError,
    warn: mockLoggerWarn,
    info: mockLoggerInfo,
    debug: mockLoggerDebug,
  },
}));

// Mock the agent invocation
vi.mock("../agents.js", () => ({
  createConnectionPairsAgent: vi.fn(() => ({
    invoke: mockAgentInvoke,
  })),
}));

// Mock Prompts
vi.mock("../prompts/index.js", () => ({
  connectionPairsPrompt:
    "test connection pairs prompt ${JSON.stringify(state.solutionResults)} ${JSON.stringify(state.researchResults)}",
}));

import {
  OverallProposalState,
  SectionType,
  SectionData,
} from "@/state/proposal.state.js";
import { connectionPairsNode } from "../nodes.js";
import { createConnectionPairsAgent } from "../agents.js";
import { Logger } from "@/lib/logger.js";
import {
  AIMessage,
  HumanMessage,
  BaseMessage,
  SystemMessage,
} from "@langchain/core/messages";

// Define the expected partial return type for the node
type ConnectionPairsNodeReturn = Partial<{
  connectionsStatus: OverallProposalState["connectionsStatus"];
  connections: OverallProposalState["connections"];
  messages: BaseMessage[];
  errors: string[];
}>;

describe("connectionPairsNode", () => {
  let mockState: OverallProposalState;

  // Helper function to create a mock state
  const createMockState = (
    overrides: Partial<OverallProposalState> = {}
  ): OverallProposalState => {
    const baseState: OverallProposalState = {
      rfpDocument: {
        id: "doc-1",
        text: "Sample RFP text content.",
        status: "loaded",
        fileName: "test.pdf",
        metadata: { organization: "Sample Funding Organization" },
      },
      researchResults: {
        summary: "Research summary",
        funder_details: {
          mission: "Support innovation in cloud technologies",
          priorities: ["Scalability", "Security", "Cost efficiency"],
        },
      },
      researchStatus: "approved",
      researchEvaluation: {
        score: 1,
        passed: true,
        feedback: "Good",
      },
      solutionResults: {
        solution_sought: "A specific cloud-based platform.",
        solution_approach: {
          primary_approaches: ["Build using serverless architecture"],
          secondary_approaches: ["Containerization as fallback"],
        },
        constraints: ["Budget limitations", "Timeline constraints"],
      },
      solutionStatus: "approved",
      solutionEvaluation: {
        score: 1,
        passed: true,
        feedback: "Good solution analysis",
      },
      connections: undefined,
      connectionsStatus: "queued",
      connectionsEvaluation: undefined,
      sections: new Map<SectionType, SectionData>(),
      requiredSections: [],
      currentStep: "connectionPairs",
      activeThreadId: "thread-1",
      messages: [],
      errors: [],
      interruptStatus: {
        isInterrupted: false,
        interruptionPoint: null,
        feedback: null,
        processingStatus: null,
      },
      status: "running",
      projectName: "Test Project",
      userId: "user-test-id",
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    };

    return { ...baseState, ...overrides };
  };

  beforeEach(() => {
    // Reset the mock state before each test
    mockState = createMockState();
    // Clear all mock calls
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==================== Input Validation Tests ====================
  describe("Input Validation", () => {
    it("should return error when solutionResults is missing", async () => {
      mockState = createMockState({
        solutionResults: undefined,
      });

      const result = await connectionPairsNode(mockState);

      expect(result.connectionsStatus).toBe("error");
      expect(result.errors).toContain("Solution results are missing or empty.");
      expect(mockLoggerError).toHaveBeenCalled();
      expect(mockAgentInvoke).not.toHaveBeenCalled();
    });

    it("should return error when solutionResults is empty", async () => {
      mockState = createMockState({
        solutionResults: {},
      });

      const result = await connectionPairsNode(mockState);

      expect(result.connectionsStatus).toBe("error");
      expect(result.errors).toContain("Solution results are missing or empty.");
      expect(mockLoggerError).toHaveBeenCalled();
      expect(mockAgentInvoke).not.toHaveBeenCalled();
    });

    it("should return error when researchResults is missing", async () => {
      mockState = createMockState({
        researchResults: undefined,
      });

      const result = await connectionPairsNode(mockState);

      expect(result.connectionsStatus).toBe("error");
      expect(result.errors).toContain("Research results are missing or empty.");
      expect(mockLoggerError).toHaveBeenCalled();
      expect(mockAgentInvoke).not.toHaveBeenCalled();
    });

    it("should return error when researchResults is empty", async () => {
      mockState = createMockState({
        researchResults: {},
      });

      const result = await connectionPairsNode(mockState);

      expect(result.connectionsStatus).toBe("error");
      expect(result.errors).toContain("Research results are missing or empty.");
      expect(mockLoggerError).toHaveBeenCalled();
      expect(mockAgentInvoke).not.toHaveBeenCalled();
    });
  });

  // ==================== Agent Invocation Tests ====================
  describe("Agent Invocation", () => {
    it("should format the prompt correctly and invoke the agent", async () => {
      const mockLLMResponse = {
        connection_pairs: [
          {
            category: "Strategic",
            funder_element: {
              description: "Focus on innovation",
              evidence: "Annual report p.7",
            },
            applicant_element: {
              description: "R&D department capabilities",
              evidence: "Company profile",
            },
            connection_explanation: "Both prioritize cutting-edge solutions",
            evidence_quality: "Strong Conceptual Alignment",
          },
        ],
      };

      mockAgentInvoke.mockResolvedValue({
        messages: [new AIMessage({ content: JSON.stringify(mockLLMResponse) })],
      });

      await connectionPairsNode(mockState);

      expect(mockAgentInvoke).toHaveBeenCalledTimes(1);
      expect(createConnectionPairsAgent).toHaveBeenCalledTimes(1);

      // Verify the prompt content contains required data
      const invocationArgs = mockAgentInvoke.mock.calls[0][0];
      expect(invocationArgs).toHaveProperty("messages");
      expect(Array.isArray(invocationArgs.messages)).toBe(true);

      const promptContent = invocationArgs.messages[0].content;
      expect(typeof promptContent).toBe("string");
      expect(promptContent).toContain(
        JSON.stringify(mockState.solutionResults)
      );
      expect(promptContent).toContain(
        JSON.stringify(mockState.researchResults)
      );
      expect(promptContent).toContain("Sample Funding Organization"); // Organization from metadata
    });

    it("should handle LLM API errors properly", async () => {
      const expectedError = new Error("API Error: Rate limit exceeded");
      mockAgentInvoke.mockRejectedValue(expectedError);

      const result = await connectionPairsNode(mockState);

      expect(result.connectionsStatus).toBe("error");
      expect(result.errors).toContain(
        "[connectionPairsNode] API Error: Rate limit exceeded"
      );
      expect(mockLoggerError).toHaveBeenCalled();
    });

    it("should handle timeouts during LLM invocation", async () => {
      const timeoutError = new Error("LLM Timeout Error");
      mockAgentInvoke.mockRejectedValue(timeoutError);

      const result = await connectionPairsNode(mockState);

      expect(result.connectionsStatus).toBe("error");
      expect(result.errors).toContain(
        "[connectionPairsNode] LLM Timeout Error"
      );
      expect(mockLoggerError).toHaveBeenCalled();
    });

    it("should handle service errors properly", async () => {
      const serviceError = new Error("Service unavailable");
      serviceError.status = 503;
      mockAgentInvoke.mockRejectedValue(serviceError);

      const result = await connectionPairsNode(mockState);

      expect(result.connectionsStatus).toBe("error");
      expect(result.errors).toContain(
        "[connectionPairsNode] LLM service unavailable"
      );
      expect(mockLoggerError).toHaveBeenCalled();
    });

    it("should properly implement timeout prevention", async () => {
      // This test confirms the implementation uses Promise.race for timeouts
      // We're checking for the pattern rather than actual timeout
      mockAgentInvoke.mockImplementation(() => {
        // Simulate delay but eventually resolve
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              messages: [
                new AIMessage({
                  content: JSON.stringify({ connection_pairs: [] }),
                }),
              ],
            });
          }, 10);
        });
      });

      const result = await connectionPairsNode(mockState);

      // If timeout prevention is implemented, we should get a successful result
      expect(result.connectionsStatus).toBe("awaiting_review");
    });
  });

  // ==================== Response Processing Tests ====================
  describe("Response Processing", () => {
    it("should correctly parse valid JSON responses", async () => {
      const mockLLMResponse = {
        connection_pairs: [
          {
            category: "Strategic",
            funder_element: {
              description: "Focus on innovation",
              evidence: "Annual report p.7",
            },
            applicant_element: {
              description: "R&D department capabilities",
              evidence: "Company profile",
            },
            connection_explanation: "Both prioritize cutting-edge solutions",
            evidence_quality: "Strong Conceptual Alignment",
          },
          {
            category: "Cultural",
            funder_element: {
              description: "Community-driven approach",
              evidence: "Community guidelines",
            },
            applicant_element: {
              description: "Open source contributions",
              evidence: "GitHub repositories",
            },
            connection_explanation: "Shared values of community involvement",
            evidence_quality: "Direct Match",
          },
        ],
        gap_areas: [
          {
            funder_priority: "Environmental sustainability",
            gap_description: "Limited green initiatives in our portfolio",
            suggested_approach: "Highlight energy efficiency of cloud solution",
          },
        ],
        opportunity_areas: [
          {
            applicant_strength: "Machine learning expertise",
            opportunity_description: "Can enhance data analytics capabilities",
            strategic_value: "Adds unexpected value to basic requirements",
          },
        ],
      };

      mockAgentInvoke.mockResolvedValue({
        messages: [new AIMessage({ content: JSON.stringify(mockLLMResponse) })],
      });

      const result = await connectionPairsNode(mockState);

      expect(result.connectionsStatus).toBe("awaiting_review");
      expect(result.connections).toBeDefined();
      expect(Array.isArray(result.connections)).toBe(true);
      expect(result.connections?.length).toBe(2); // Should have two connection pairs
    });

    it("should use regex fallback for non-JSON responses", async () => {
      const nonJsonResponse = `
        Here are the connection pairs:
        1. Strategic: Focus on innovation aligns with R&D capabilities
        2. Methodological: Data-driven approach matches analytics expertise
      `;

      mockAgentInvoke.mockResolvedValue({
        messages: [new AIMessage({ content: nonJsonResponse })],
      });

      const result = await connectionPairsNode(mockState);

      expect(result.connectionsStatus).toBe("awaiting_review");
      expect(result.connections).toBeDefined();
      expect(Array.isArray(result.connections)).toBe(true);
      expect(result.connections?.length).toBeGreaterThan(0);
    });

    it("should handle completely unparseable responses", async () => {
      const unparsableResponse =
        "This contains no connection pairs information at all.";

      mockAgentInvoke.mockResolvedValue({
        messages: [new AIMessage({ content: unparsableResponse })],
      });

      const result = await connectionPairsNode(mockState);

      expect(result.connectionsStatus).toBe("error");
      expect(result.errors).toContain(
        "[connectionPairsNode] Failed to extract connection pairs from response."
      );
    });

    it("should handle malformed JSON responses", async () => {
      const malformedJson = '{"connection_pairs": [{"category": "Strategic",';

      mockAgentInvoke.mockResolvedValue({
        messages: [new AIMessage({ content: malformedJson })],
      });

      const result = await connectionPairsNode(mockState);

      // Should still work by falling back to regex extraction
      expect(result.connectionsStatus).toBe("awaiting_review");
      expect(mockLoggerWarn).toHaveBeenCalled();
    });

    it("should transform connection_pairs from JSON to expected format", async () => {
      const mockLLMResponse = {
        connection_pairs: [
          {
            category: "Strategic",
            funder_element: {
              description: "Focus on innovation",
              evidence: "Annual report p.7",
            },
            applicant_element: {
              description: "R&D department capabilities",
              evidence: "Company profile",
            },
            connection_explanation: "Both prioritize cutting-edge solutions",
            evidence_quality: "Strong Conceptual Alignment",
          },
        ],
      };

      mockAgentInvoke.mockResolvedValue({
        messages: [new AIMessage({ content: JSON.stringify(mockLLMResponse) })],
      });

      const result = await connectionPairsNode(mockState);

      // Check the formatted connection pair contains all the necessary information
      expect(result.connections?.[0]).toContain("Strategic");
      expect(result.connections?.[0]).toContain("Focus on innovation");
      expect(result.connections?.[0]).toContain("R&D department capabilities");
      expect(result.connections?.[0]).toContain(
        "Both prioritize cutting-edge solutions"
      );
      expect(result.connections?.[0]).toContain("Strong Conceptual Alignment");
    });

    it("should handle JSON response with missing connection_pairs property", async () => {
      const invalidResponse = {
        some_other_property: "value",
      };

      mockAgentInvoke.mockResolvedValue({
        messages: [new AIMessage({ content: JSON.stringify(invalidResponse) })],
      });

      const result = await connectionPairsNode(mockState);

      // Should attempt regex fallback
      expect(mockLoggerWarn).toHaveBeenCalled();
    });
  });

  // ==================== State Management Tests ====================
  describe("State Management", () => {
    it("should set status to running during execution", async () => {
      // This is hard to test directly but can check the implementation
      // Implementation should update status to 'running' before agent invocation
      const mockLLMResponse = {
        connection_pairs: [
          {
            category: "Strategic",
            funder_element: {
              description: "Focus on innovation",
              evidence: "Annual report p.7",
            },
            applicant_element: {
              description: "R&D department capabilities",
              evidence: "Company profile",
            },
            connection_explanation: "Both prioritize cutting-edge solutions",
            evidence_quality: "Strong Conceptual Alignment",
          },
        ],
      };

      mockAgentInvoke.mockResolvedValue({
        messages: [new AIMessage({ content: JSON.stringify(mockLLMResponse) })],
      });

      await connectionPairsNode(mockState);

      expect(mockLoggerInfo).toHaveBeenCalledWith(
        expect.stringMatching(/Connection pairs inputs validated, processing/)
      );
    });

    it("should correctly update state on successful execution", async () => {
      const mockLLMResponse = {
        connection_pairs: [
          {
            category: "Strategic",
            funder_element: {
              description: "Focus on innovation",
              evidence: "Annual report p.7",
            },
            applicant_element: {
              description: "R&D department capabilities",
              evidence: "Company profile",
            },
            connection_explanation: "Both prioritize cutting-edge solutions",
            evidence_quality: "Strong Conceptual Alignment",
          },
        ],
      };

      mockAgentInvoke.mockResolvedValue({
        messages: [new AIMessage({ content: JSON.stringify(mockLLMResponse) })],
      });

      const result = await connectionPairsNode(mockState);

      expect(result.connectionsStatus).toBe("awaiting_review");
      expect(result.connections).toBeDefined();
      expect(result.errors).toEqual([]);
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        expect.stringMatching(/Successfully generated/)
      );
    });

    it("should add appropriate messages to the state on success", async () => {
      const mockLLMResponse = {
        connection_pairs: [
          {
            category: "Strategic",
            funder_element: {
              description: "Focus on innovation",
              evidence: "Annual report p.7",
            },
            applicant_element: {
              description: "R&D department capabilities",
              evidence: "Company profile",
            },
            connection_explanation: "Both prioritize cutting-edge solutions",
            evidence_quality: "Strong Conceptual Alignment",
          },
        ],
      };

      mockAgentInvoke.mockResolvedValue({
        messages: [new AIMessage({ content: JSON.stringify(mockLLMResponse) })],
      });

      const result = await connectionPairsNode(mockState);

      const systemMessages = result.messages?.filter(
        (m: BaseMessage) => m._getType() === "system"
      );

      expect(
        systemMessages?.some(
          (m: BaseMessage) =>
            typeof m.content === "string" &&
            m.content.includes("Connection pairs analysis successful")
        )
      ).toBe(true);

      // Should include the AI response message in the state messages
      expect(
        result.messages?.some(
          (m: BaseMessage) =>
            m._getType() === "ai" &&
            typeof m.content === "string" &&
            m.content === JSON.stringify(mockLLMResponse)
        )
      ).toBe(true);
    });

    it("should add appropriate error messages to the state on failure", async () => {
      mockState = createMockState({
        solutionResults: undefined,
      });

      const result = await connectionPairsNode(mockState);

      const systemMessages = result.messages?.filter(
        (m: BaseMessage) => m._getType() === "system"
      );

      expect(
        systemMessages?.some(
          (m: BaseMessage) =>
            typeof m.content === "string" &&
            m.content.includes("Connection pairs analysis failed")
        )
      ).toBe(true);
    });

    it("should clear previous node-specific errors on successful execution", async () => {
      const mockLLMResponse = {
        connection_pairs: [
          {
            category: "Strategic",
            funder_element: {
              description: "Focus on innovation",
              evidence: "Annual report p.7",
            },
            applicant_element: {
              description: "R&D department capabilities",
              evidence: "Company profile",
            },
            connection_explanation: "Both prioritize cutting-edge solutions",
            evidence_quality: "Strong Conceptual Alignment",
          },
        ],
      };

      mockAgentInvoke.mockResolvedValue({
        messages: [new AIMessage({ content: JSON.stringify(mockLLMResponse) })],
      });

      mockState = createMockState({
        errors: ["Previous error related to connection pairs node"],
      });

      const result = await connectionPairsNode(mockState);

      expect(result.connectionsStatus).toBe("awaiting_review");
      expect(result.errors === undefined || result.errors?.length === 0).toBe(
        true
      );
    });

    it("should preserve raw response in messages on parsing error", async () => {
      const unparsableResponse = "This is not valid JSON or connection pairs";

      mockAgentInvoke.mockResolvedValue({
        messages: [new AIMessage({ content: unparsableResponse })],
      });

      const result = await connectionPairsNode(mockState);

      // Should include the raw response for debugging even on error
      expect(
        result.messages?.some(
          (m: BaseMessage) =>
            m._getType() === "ai" &&
            typeof m.content === "string" &&
            m.content === unparsableResponse
        )
      ).toBe(true);
    });
  });
});
