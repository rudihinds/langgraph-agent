import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { solutionSoughtNode } from "../agents/research/nodes.js";
// Use .js extension for type import
import type { OverallProposalState } from "@/state/proposal.state.js";
import { HumanMessage } from "@langchain/core/messages"; // For potential agent response mocking

// --- Mock Dependencies ---

// Mock pdf-parse directly to prevent it trying to load files
vi.mock("pdf-parse", () => ({
  default: vi.fn().mockResolvedValue({ text: "mock pdf text" }), // Mock the default export function
}));

// Mock the parser to prevent indirect loading issues from pdf-parse
vi.mock("../../lib/parsers/rfp.js", () => ({
  parseRfpFromBuffer: vi
    .fn()
    .mockResolvedValue({ text: "mock parsed text", metadata: {} }),
}));

// Mock Logger
vi.mock("@/lib/logger.js", () => ({
  Logger: {
    getInstance: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

// Mock Prompts
// Define the mock value directly inside the factory to avoid hoisting issues
vi.mock("../agents/research/prompts/index.js", () => ({
  solutionSoughtPrompt: "Analyze this: {rfpText} with research: {research}",
}));

// Mock Agent Creation
const mockAgentInvoke = vi.fn();
vi.mock("../agents/research/agents.js", () => ({
  createSolutionSoughtAgent: vi.fn(() => ({
    invoke: mockAgentInvoke, // Mock the invoke method of the created agent
  })),
  // Add other agent creators if needed
}));

// --- Test Suite ---

describe("solutionSoughtNode Tests", () => {
  // Helper to create a minimal valid state for testing
  const createInitialState = (
    overrides: Partial<OverallProposalState> = {}
  ): OverallProposalState => ({
    rfpDocument: {
      id: "test-doc-id",
      text: "Valid RFP text.",
      metadata: {},
      status: "loaded",
    },
    researchResults: { someKey: "Some research data" }, // Use non-empty research results
    researchStatus: "approved", // Assume previous step approved
    solutionResults: undefined, // Use undefined as per state type
    solutionStatus: "queued", // Use correct property name
    connections: [], // Use correct property name
    connectionsStatus: "queued", // Assign a valid ProcessingStatus
    sections: new Map(), // Use Map for sections as per state definition
    requiredSections: [],
    currentStep: null,
    activeThreadId: "test-thread-solution",
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
    userId: "test-user",
    createdAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    ...overrides, // Apply specific overrides for test cases
  });

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    mockAgentInvoke.mockClear(); // Clear specific mock history too
  });

  afterEach(() => {
    // Ensure mocks are cleared after each test
    vi.clearAllMocks();
  });

  // --- Test Cases ---

  it("should successfully process valid inputs and return structured results", async () => {
    // Arrange
    const initialState = createInitialState();
    const mockLLMResponse = {
      solution_sought: "A specific cloud-based platform.",
      solution_approach: {
        primary_approaches: ["Build using serverless architecture"],
        secondary_approaches: ["Containerization as fallback"],
        evidence: [],
      },
      explicitly_unwanted: [],
      turn_off_approaches: ["On-premise solutions"],
    };
    mockAgentInvoke.mockResolvedValue({
      /* Simulate agent output structure */
      // Assuming the agent's final output is a message containing the JSON string
      messages: [new HumanMessage(JSON.stringify(mockLLMResponse))],
    });

    // Act
    const result = await solutionSoughtNode(initialState);

    // Assert
    expect(mockAgentInvoke).toHaveBeenCalledTimes(1);
    // TODO: Add assertion for prompt formatting if needed
    expect(result.solutionStatus).toBe("awaiting_review");
    expect(result.solutionResults).toEqual(mockLLMResponse);
    expect(result.errors).toEqual([]); // Expect no new errors
  });

  it("should return error status if rfpDocument text is missing", async () => {
    // Arrange
    const initialState = createInitialState({
      rfpDocument: {
        id: "test-doc-id",
        text: "",
        metadata: {},
        status: "loaded",
      }, // Empty text
    });

    // Act
    const result = await solutionSoughtNode(initialState);

    // Assert
    expect(mockAgentInvoke).not.toHaveBeenCalled();
    expect(result.solutionStatus).toBe("error");
    expect(result.errors).toContain("RFP document text is missing or empty.");
  });

  it("should return error status if deepResearchResults are missing", async () => {
    // Arrange
    const initialState = createInitialState({
      researchResults: undefined, // Use undefined as per state type
    });

    // Act
    const result = await solutionSoughtNode(initialState);

    // Assert
    expect(mockAgentInvoke).not.toHaveBeenCalled();
    expect(result.solutionStatus).toBe("error");
    expect(result.errors).toContain("Deep research results are missing.");
  });

  it("should return error status if LLM agent invocation fails", async () => {
    // Arrange
    const initialState = createInitialState();
    const expectedError = new Error("LLM API Error");
    mockAgentInvoke.mockRejectedValue(expectedError);

    // Act
    const result = await solutionSoughtNode(initialState);

    // Assert
    expect(mockAgentInvoke).toHaveBeenCalledTimes(1);
    expect(result.solutionStatus).toBe("error");
    console.log("Actual errors in test:", result.errors);
    expect(result.errors).toContain(
      `[solutionSoughtNode] ${expectedError.message}`
    );
    expect(result.solutionResults).toBeUndefined();
  });

  it("should return error status if LLM response is not valid JSON", async () => {
    // Arrange
    const initialState = createInitialState();
    mockAgentInvoke.mockResolvedValue({
      messages: [new HumanMessage("This is not JSON")], // Invalid response content
    });

    // Act
    const result = await solutionSoughtNode(initialState);

    // Assert
    expect(mockAgentInvoke).toHaveBeenCalledTimes(1);
    expect(result.solutionStatus).toBe("error");
    expect(result.errors).toContain(
      "[solutionSoughtNode] Failed to parse JSON response from agent."
    );
    expect(result.solutionResults).toBeUndefined(); // Use correct property name and check for undefined
  });

  // TODO: Add test case for Zod validation failure (if implementing)
});
