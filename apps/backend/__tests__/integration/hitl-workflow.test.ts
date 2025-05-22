import { vi } from "vitest";

// Import the real LogLevel for correct reference
import { LogLevel } from "../../lib/logger.js";

// Mock the logger to return an object with all required methods
vi.mock("../../lib/logger.js", () => ({
  Logger: {
    getInstance: () => ({
      info: vi.fn((...args) => console.log(...args)),
      error: vi.fn((...args) => console.error(...args)),
      warn: vi.fn((...args) => console.warn(...args)),
      debug: vi.fn(),
      trace: vi.fn(),
      setLogLevel: vi.fn(),
    }),
  },
  LogLevel: {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    TRACE: 4,
  },
}));

// Create mock objects
const mockGraph = {
  runAsync: vi.fn(),
  resume: vi.fn(),
  checkpointer: null,
};

const mockCheckpointer = {
  get: vi.fn(),
  put: vi.fn(),
};

// Mock the createProposalGenerationGraph function
vi.mock("../../agents/proposal-agent/graph.js", () => {
  return {
    createProposalGenerationGraph: vi.fn(() => mockGraph),
    createProposalAgentWithCheckpointer: vi.fn(() => mockGraph),
  };
});

// Mock the checkpointer library
vi.mock("@langgraph/checkpoint-postgres", () => {
  return {
    BaseCheckpointSaver: vi.fn(() => mockCheckpointer),
  };
});

// Now import everything else
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { OrchestratorService } from "../../services/[dep]orchestrator.service.js";
import { FeedbackType } from "../../lib/types/feedback.js";
import { OverallProposalState } from "../../state/modules/types.js";

describe("HITL Integration Workflow", () => {
  let orchestratorService: OrchestratorService;
  const mockThreadId = "test-thread-123";
  let mockState: OverallProposalState;

  beforeEach(() => {
    // Set up the mock implementations
    mockGraph.runAsync.mockImplementation(async ({ resuming, input }) => {
      if (!resuming) {
        return {
          exits: ["interrupted"],
          values: {
            interruptStatus: {
              isInterrupted: true,
              interruptionPoint: "evaluateResearchNode",
            },
          },
        };
      } else {
        return {
          exits: ["complete"],
          values: { processingStatus: "completed" },
        };
      }
    });

    mockGraph.resume.mockResolvedValue({});

    // Reset all mocks
    vi.clearAllMocks();

    // Initialize mock state for each test
    mockState = {
      // Basic info
      userId: "user123",
      activeThreadId: mockThreadId,
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      currentStep: "evaluateResearch",
      status: "awaiting_review",

      // Document handling
      rfpDocument: {
        id: "test-rfp-1",
        text: "Test RFP Document",
        status: "loaded",
      },

      // Research phase
      researchResults: { content: "This is the research content" },
      researchStatus: "awaiting_review",

      // Solution phase
      solutionStatus: "not_started",

      // Connections phase
      connectionsStatus: "not_started",

      // Sections
      sections: new Map(),
      requiredSections: [],

      // HITL handling
      interruptStatus: {
        isInterrupted: true,
        interruptionPoint: "evaluateResearchNode",
        processingStatus: "awaiting_review",
        feedback: null,
      },
      interruptMetadata: {
        nodeId: "evaluateResearchNode",
        reason: "EVALUATION_NEEDED",
        timestamp: new Date().toISOString(),
        contentReference: "research",
      },

      // Messages and errors
      messages: [],
      errors: [],
    };

    // Set up the checkpointer in the mock graph
    mockGraph.checkpointer = mockCheckpointer;

    // Setup checkpointer mock behavior
    mockCheckpointer.get.mockImplementation(async () => {
      // Return a deep clone of the current state
      const stateClone = structuredClone({
        ...mockState,
        // Convert Map to object for cloning
        sections: Object.fromEntries(mockState.sections.entries()),
      });

      // Convert back to Map
      stateClone.sections = new Map(Object.entries(stateClone.sections));
      return stateClone;
    });

    mockCheckpointer.put.mockImplementation(async (id, state) => {
      // Clone and store state
      mockState = state;
      return undefined;
    });

    // Create orchestrator service with mock graph and checkpointer
    orchestratorService = new OrchestratorService(mockGraph, mockCheckpointer);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should complete the full HITL workflow from interrupt to approval", async () => {
    // 1. Detect the interrupt
    const isInterrupted =
      await orchestratorService.detectInterrupt(mockThreadId);
    expect(isInterrupted).toBe(true);

    // 2. Get interrupt details
    const interruptDetails =
      await orchestratorService.getInterruptDetails(mockThreadId);
    expect(interruptDetails).toEqual(
      expect.objectContaining({
        reason: "EVALUATION_NEEDED",
        nodeId: "evaluateResearchNode",
        contentReference: "research",
      })
    );

    // 3. Submit approval feedback
    const feedbackResult = await orchestratorService.submitFeedback(
      mockThreadId,
      {
        type: FeedbackType.APPROVE,
        comments: "Research looks good!",
        timestamp: new Date().toISOString(),
        contentReference: "research",
      }
    );

    // 4. Verify feedback result
    expect(feedbackResult).toEqual(
      expect.objectContaining({
        success: true,
        message: expect.stringContaining(
          "Feedback (approve) processed successfully"
        ),
      })
    );

    // Get the updated state to verify changes
    const updatedState = await orchestratorService.getState(mockThreadId);

    // Verify research status is updated
    expect(updatedState.researchStatus).toBe("approved");

    // 5. Resume graph execution
    const resumeResult =
      await orchestratorService.resumeAfterFeedback(mockThreadId);

    // 6. Verify the graph was resumed
    expect(mockGraph.resume).toHaveBeenCalledWith(mockThreadId);
    expect(resumeResult).toEqual(
      expect.objectContaining({
        success: true,
        message: expect.stringContaining(
          "Graph execution resumed successfully"
        ),
      })
    );
  });

  it("should handle revision feedback correctly", async () => {
    // 1. Submit revision feedback
    const feedbackResult = await orchestratorService.submitFeedback(
      mockThreadId,
      {
        type: FeedbackType.REVISE,
        comments: "Research needs more depth",
        timestamp: new Date().toISOString(),
        contentReference: "research",
      }
    );

    // 2. Verify feedback result
    expect(feedbackResult).toEqual(
      expect.objectContaining({
        success: true,
        message: expect.stringContaining(
          "Feedback (revise) processed successfully"
        ),
      })
    );

    // Get the updated state to verify changes
    const updatedState = await orchestratorService.getState(mockThreadId);

    // Verify research status is updated
    expect(updatedState.researchStatus).toBe("edited");

    // 3. Resume graph execution
    const resumeResult =
      await orchestratorService.resumeAfterFeedback(mockThreadId);

    // 4. Verify the graph was resumed
    expect(mockGraph.resume).toHaveBeenCalledWith(mockThreadId);
    expect(resumeResult).toEqual(
      expect.objectContaining({
        success: true,
        message: expect.stringContaining(
          "Graph execution resumed successfully"
        ),
      })
    );
  });

  it("should handle regeneration feedback correctly", async () => {
    // 1. Submit regeneration feedback
    const feedbackResult = await orchestratorService.submitFeedback(
      mockThreadId,
      {
        type: FeedbackType.REGENERATE,
        comments: "Research is totally off-track, please regenerate",
        timestamp: new Date().toISOString(),
        contentReference: "research",
      }
    );

    // 2. Verify feedback result
    expect(feedbackResult).toEqual(
      expect.objectContaining({
        success: true,
        message: expect.stringContaining(
          "Feedback (regenerate) processed successfully"
        ),
      })
    );

    // Get the updated state to verify changes
    const updatedState = await orchestratorService.getState(mockThreadId);

    // Verify research status is updated
    expect(updatedState.researchStatus).toBe("stale");

    // 3. Resume graph execution
    const resumeResult =
      await orchestratorService.resumeAfterFeedback(mockThreadId);

    // 4. Verify the graph was resumed
    expect(mockGraph.resume).toHaveBeenCalledWith(mockThreadId);
    expect(resumeResult).toEqual(
      expect.objectContaining({
        success: true,
        message: expect.stringContaining(
          "Graph execution resumed successfully"
        ),
      })
    );
  });
});
