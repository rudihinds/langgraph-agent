import { vi } from "vitest";

// Define hoisted mock functions first using vi.hoisted
const mockLoggerError = vi.hoisted(() => vi.fn());
const mockLoggerWarn = vi.hoisted(() => vi.fn());
const mockLoggerInfo = vi.hoisted(() => vi.fn());
const mockLoggerDebug = vi.hoisted(() => vi.fn());
const mockAgentInvoke = vi.hoisted(() => vi.fn());

// Mock pdf-parse before any imports to prevent file loading errors
vi.mock("pdf-parse", () => ({
  default: vi
    .fn()
    .mockResolvedValue({ text: "mocked pdf content", numpages: 5 }),
}));

// Mock all the dependencies in nodes.ts with the EXACT paths it uses
vi.mock("../../lib/parsers/rfp.js", () => ({
  parseRfpFromBuffer: vi.fn().mockResolvedValue({
    text: "mock parsed text",
    metadata: { pages: 5, type: "application/pdf" },
  }),
  detectFileType: vi.fn().mockReturnValue("application/pdf"),
  parseRfp: vi.fn().mockResolvedValue({
    text: "mock parsed text",
    metadata: { pages: 5, type: "application/pdf" },
  }),
}));

vi.mock("@/lib/logger.js", () => ({
  Logger: {
    getInstance: vi.fn(() => ({
      error: mockLoggerError,
      warn: mockLoggerWarn,
      info: mockLoggerInfo,
      debug: mockLoggerDebug,
    })),
  },
}));

vi.mock("../../lib/db/documents.js", () => ({
  DocumentService: {
    create: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock("../../lib/supabase/client.js", () => ({
  serverSupabase: {
    storage: {
      from: vi.fn().mockReturnValue({
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        download: vi
          .fn()
          .mockResolvedValue({ data: new ArrayBuffer(10), error: null }),
      }),
    },
  },
}));

vi.mock("../../lib/utils/backoff.js", () => ({
  withRetry: vi.fn(async (fn) => await fn()),
}));

vi.mock("../../lib/utils/files.js", () => ({
  getFileExtension: vi.fn().mockReturnValue("pdf"),
}));

vi.mock("./prompts/index.js", () => ({
  solutionSoughtPrompt:
    "test solution prompt ${state.rfpDocument.text} ${JSON.stringify(state.deepResearchResults)}",
  deepResearchPrompt: "test research prompt",
}));

vi.mock("../agents.js", () => ({
  createSolutionSoughtAgent: vi.fn(() => ({
    invoke: mockAgentInvoke,
  })),
  createDeepResearchAgent: vi.fn(),
}));

import { describe, it, expect, beforeEach } from "vitest";
// Reverting to @ alias WITHOUT .js extension
import { OverallProposalState, SectionData } from "@/state/proposal.state.js";
import { solutionSoughtNode } from "../nodes.js"; // Keep .js for direct relative paths
import { createSolutionSoughtAgent } from "../agents.js"; // Keep .js for direct relative paths
import { Logger } from "@/lib/logger.js"; // Reverting to @ alias
import {
  AIMessage,
  HumanMessage,
  BaseMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { SectionType } from "@/state/proposal.state.js"; // Import SectionType if used in state

// Define the expected partial return type for the node
// Ensure this accurately reflects what the node function *actually* returns
// It might only return a subset of OverallProposalState
type SolutionNodeReturn = Partial<{
  solutionStatus: OverallProposalState["solutionStatus"]; // Corrected name
  solutionResults: OverallProposalState["solutionResults"]; // Corrected name
  messages: BaseMessage[];
  errors: string[];
  // Include other fields if the node might return them
}>;

// --- Test Suite ---

describe("solutionSoughtNode", () => {
  let mockState: OverallProposalState;

  // Helper function - Ensure baseState matches the LATEST OverallProposalState definition
  const createMockState = (
    overrides: Partial<OverallProposalState> = {}
  ): OverallProposalState => {
    // Make sure this matches your ACTUAL state definition accurately
    const baseState: OverallProposalState = {
      rfpDocument: {
        id: "doc-1",
        text: "Sample RFP text content.",
        status: "loaded",
        fileName: "test.pdf",
        metadata: {},
      },
      researchResults: { summary: "Research summary" },
      researchStatus: "approved", // Assuming this is ProcessingStatus
      researchEvaluation: {
        // Ensure EvaluationResult structure matches state
        score: 1,
        passed: true,
        feedback: "Good",
        // categories: {}, // Add if part of your EvaluationResult type
      },
      solutionResults: undefined, // Corrected name, initialized as undefined or null
      solutionStatus: "queued", // Corrected name, use ProcessingStatus type
      solutionEvaluation: undefined, // Initialize as undefined or null
      connections: undefined, // Corrected name, use any[] or specific type
      connectionsStatus: "queued", // Corrected name, use ProcessingStatus
      connectionsEvaluation: undefined, // Initialize as undefined or null
      sections: new Map<SectionType, SectionData>(), // Use Map<SectionType, SectionData>
      requiredSections: [], // Use SectionType[]
      currentStep: "solutionSought", // Node name or step identifier
      activeThreadId: "thread-1",
      messages: [],
      errors: [],
      projectName: "Test Project",
      userId: "user-test-id",
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      interruptStatus: {
        // Ensure InterruptStatus structure matches state
        isInterrupted: false,
        interruptionPoint: null,
        feedback: null, // Ensure Feedback structure matches state
        processingStatus: null, // Use correct status type if defined
      },
      interruptMetadata: undefined, // Ensure InterruptMetadata structure matches state
      userFeedback: undefined, // Ensure UserFeedback structure matches state
      status: "running", // Overall status, use ProcessingStatus
    };

    // Deep merge nested objects if necessary
    const mergedState = {
      ...baseState,
      ...overrides,
      rfpDocument: overrides.rfpDocument
        ? { ...baseState.rfpDocument, ...overrides.rfpDocument }
        : baseState.rfpDocument,
      researchEvaluation: overrides.researchEvaluation
        ? { ...baseState.researchEvaluation, ...overrides.researchEvaluation }
        : baseState.researchEvaluation,
      interruptStatus: overrides.interruptStatus
        ? { ...baseState.interruptStatus, ...overrides.interruptStatus }
        : baseState.interruptStatus,
      // Add deep merges for solutionEvaluation, connectionsEvaluation, sections, interruptMetadata, userFeedback if overrides are possible
    };

    // Explicitly cast to OverallProposalState AFTER merging
    return mergedState as OverallProposalState;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockState = createMockState();
  });

  // --- Test Cases ---

  describe("Happy Path", () => {
    it("should successfully analyze valid RFP text and research results", async () => {
      const mockLLMResponse = {
        solution_sought: "AI-powered analysis",
        primary_approaches: ["NLP", "ML"],
        secondary_approaches: ["Rule-based system"],
        evidence: [],
      };
      mockAgentInvoke.mockResolvedValue({
        messages: [new AIMessage({ content: JSON.stringify(mockLLMResponse) })],
      });

      // Node functions in LangGraph return Partial<State>
      const result = await solutionSoughtNode(mockState);

      // Assert on the fields potentially returned by the node
      expect(result.solutionStatus).toBe("awaiting_review"); // Corrected name
      expect(result.solutionResults).toEqual(mockLLMResponse); // Corrected name
      // Check if errors array exists and is empty, or if errors field is not returned (both valid)
      expect(result.errors === undefined || result.errors?.length === 0).toBe(
        true
      );
      expect(mockLoggerError).not.toHaveBeenCalled();
      expect(
        result.messages?.some(
          (m: BaseMessage) =>
            typeof m.content === "string" &&
            m.content.includes("Solution analysis successful")
        )
      ).toBe(true);
    });
  });

  describe("Input Validation", () => {
    it("should handle missing rfpDocument text", async () => {
      mockState = createMockState({
        rfpDocument: { ...mockState.rfpDocument, text: undefined },
      });
      const result = await solutionSoughtNode(mockState);

      expect(result.solutionStatus).toBe("error");
      expect(result.errors?.length).toBeGreaterThan(0);
      expect(result.errors?.[0]).toContain("Missing RFP text");
      expect(mockAgentInvoke).not.toHaveBeenCalled();
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining("Missing RFP text"),
        expect.any(Object)
      );
    });

    it("should handle missing researchResults", async () => {
      mockState = createMockState({ researchResults: undefined });
      const result = await solutionSoughtNode(mockState);

      expect(result.solutionStatus).toBe("error"); // Corrected name
      expect(result.errors?.length).toBeGreaterThan(0);
      expect(result.errors?.[0]).toContain("Missing research results");
      expect(mockAgentInvoke).not.toHaveBeenCalled();
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining("Missing research results")
      );
    });
  });

  describe("LLM/Agent Interaction", () => {
    it("should correctly format the prompt using state data", async () => {
      mockAgentInvoke.mockResolvedValue({
        messages: [new AIMessage({ content: "{}" })],
      });
      await solutionSoughtNode(mockState);

      expect(createSolutionSoughtAgent).toHaveBeenCalled();
      expect(mockAgentInvoke).toHaveBeenCalledTimes(1);
      const invocationArgs = mockAgentInvoke.mock.calls[0][0];
      expect(invocationArgs).toHaveProperty("messages");
      expect(Array.isArray(invocationArgs.messages)).toBe(true);
      expect(invocationArgs.messages.length).toBeGreaterThan(0);

      const promptContent = invocationArgs.messages[0].content;
      expect(typeof promptContent).toBe("string");

      if (typeof promptContent === "string") {
        expect(promptContent).toContain(mockState.rfpDocument.text);
        expect(promptContent).toContain(
          JSON.stringify(mockState.researchResults)
        );
      }
    });

    it("should handle LLM API errors gracefully", async () => {
      const apiError = new Error("LLM API Error: Service Unavailable");
      mockAgentInvoke.mockRejectedValue(apiError);

      const result = await solutionSoughtNode(mockState);

      expect(result.solutionStatus).toBe("error"); // Corrected name
      expect(result.errors?.length).toBeGreaterThan(0);
      // Check for the new, more specific error message
      expect(result.errors?.[0]).toContain("LLM service unavailable");
      // Check the original error message might be appended or included
      expect(result.errors?.[0]).toContain("Service Unavailable");
      // Update logger check to account for the object parameter
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining("LLM service unavailable"),
        expect.objectContaining({
          threadId: expect.any(String),
        }),
        apiError
      );
    });

    it("should handle LLM timeouts gracefully (if applicable)", async () => {
      const timeoutError = new Error("LLM Timeout Error");
      mockAgentInvoke.mockRejectedValue(timeoutError);

      const result = await solutionSoughtNode(mockState);

      expect(result.solutionStatus).toBe("error"); // Corrected name
      expect(result.errors?.length).toBeGreaterThan(0);
      // Check for the more specific error handling message
      expect(result.errors?.[0]).toContain("LLM request timed out");
      expect(result.errors?.[0]).toContain("Timeout"); // Check specific error message
      // Update logger check to account for the object parameter
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining("LLM request timed out"),
        expect.objectContaining({
          threadId: expect.any(String),
        }),
        timeoutError
      );
    });
  });

  describe("Response Processing", () => {
    it("should handle non-JSON response from LLM", async () => {
      const plainTextResponse = "This is just plain text, not JSON.";
      mockAgentInvoke.mockResolvedValue({
        messages: [new AIMessage({ content: plainTextResponse })],
      });

      const result = await solutionSoughtNode(mockState);

      expect(result.solutionStatus).toBe("error"); // Corrected name
      // Check results is null or undefined if error occurred
      expect(
        result.solutionResults === null || result.solutionResults === undefined
      ).toBe(true);
      expect(result.errors?.length).toBeGreaterThan(0);
      expect(result.errors?.[0]).toContain("Failed to parse JSON response");
      // Check for our new error message about not being JSON
      expect(result.errors?.[0]).toContain(
        "Response doesn't appear to be JSON"
      );

      // Check that we preserve the original response in the messages
      expect(
        result.messages?.some(
          (m: BaseMessage) =>
            m._getType() === "ai" &&
            typeof m.content === "string" &&
            m.content === plainTextResponse
        )
      ).toBe(true);

      // Update logger check to account for new object parameter format
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining("Failed to parse JSON response"),
        expect.objectContaining({
          threadId: expect.any(String),
          content: expect.stringContaining("This is just plain text"),
        }),
        expect.any(Error)
      );
    });

    it("should handle malformed JSON response from LLM", async () => {
      const malformedJson = '{"key": "value", }';
      mockAgentInvoke.mockResolvedValue({
        messages: [new AIMessage({ content: malformedJson })],
      });

      const result = await solutionSoughtNode(mockState);

      expect(result.solutionStatus).toBe("error"); // Corrected name
      expect(
        result.solutionResults === null || result.solutionResults === undefined
      ).toBe(true);
      expect(result.errors?.length).toBeGreaterThan(0);
      expect(result.errors?.[0]).toContain("Failed to parse JSON response");

      // Check that we preserve the original response in the messages
      expect(
        result.messages?.some(
          (m: BaseMessage) =>
            m._getType() === "ai" &&
            typeof m.content === "string" &&
            m.content === malformedJson
        )
      ).toBe(true);

      // Update logger check to account for new object parameter format
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining("Failed to parse JSON response"),
        expect.objectContaining({
          threadId: expect.any(String),
          content: expect.stringContaining('{"key": "value", }'),
        }),
        expect.any(Error)
      );
    });

    it.skip("should handle JSON response not matching expected schema (if Zod validation implemented)", async () => {
      // ...
    });
  });

  describe("State Management", () => {
    it.skip('should update solutionSoughtStatus to "running" during execution', async () => {
      // ...
    });

    it("should correctly store parsed results in solutionSoughtResults on success", async () => {
      const mockLLMResponse = { goal: "Test Goal" };
      mockAgentInvoke.mockResolvedValue({
        messages: [new AIMessage({ content: JSON.stringify(mockLLMResponse) })],
      });

      const result = await solutionSoughtNode(mockState);

      expect(result.solutionResults).toEqual(mockLLMResponse);
    });

    it("should add appropriate messages to the state on success", async () => {
      const mockLLMResponse = { goal: "Test Goal" };
      mockAgentInvoke.mockResolvedValue({
        messages: [new AIMessage({ content: JSON.stringify(mockLLMResponse) })],
      });

      const result = await solutionSoughtNode(mockState);

      const systemMessages = result.messages?.filter(
        (m: BaseMessage) => m._getType() === "system"
      );
      expect(
        systemMessages?.some(
          (m: BaseMessage) =>
            typeof m.content === "string" &&
            m.content.includes("Solution analysis successful")
        )
      ).toBe(true);

      expect(
        result.messages?.some(
          (m: BaseMessage) =>
            m._getType() === "ai" &&
            typeof m.content === "string" &&
            m.content === JSON.stringify(mockLLMResponse)
        )
      ).toBe(true);
    });

    it("should add appropriate messages to the state on failure", async () => {
      mockState = createMockState({
        rfpDocument: { ...mockState.rfpDocument, text: undefined },
      });
      const result = await solutionSoughtNode(mockState);

      const systemMessages = result.messages?.filter(
        (m: BaseMessage) => m._getType() === "system"
      );
      expect(
        systemMessages?.some(
          (m: BaseMessage) =>
            typeof m.content === "string" &&
            m.content.includes("Solution analysis failed")
        )
      ).toBe(true);
    });

    it("should clear previous node-specific errors on successful execution", async () => {
      const mockLLMResponse = {
        /* ... valid response ... */
      };
      mockAgentInvoke.mockResolvedValue({
        messages: [new AIMessage({ content: JSON.stringify(mockLLMResponse) })],
      });
      mockState = createMockState({
        errors: ["Previous error related to solution node"],
      }); // Add a pre-existing error

      const result = await solutionSoughtNode(mockState);

      expect(result.solutionStatus).toBe("awaiting_review"); // Corrected name
      // Assert that the errors array is either undefined or empty after successful run
      expect(result.errors === undefined || result.errors?.length === 0).toBe(
        true
      );
    });
  });
});
