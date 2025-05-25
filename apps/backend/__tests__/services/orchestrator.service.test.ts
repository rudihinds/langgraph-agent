import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OrchestratorService } from "../orchestrator.service";
import {
  OverallProposalState,
  InterruptStatus,
} from "../../state/modules/types";

// Mock the checkpointer
const mockCheckpointer = {
  get: vi.fn(),
  put: vi.fn(),
  list: vi.fn(),
  delete: vi.fn(),
};

// Mock the graph
const mockGraphRun = vi.fn();
const mockGraph = {
  runFromState: mockGraphRun,
};

// Mock the logger
vi.mock("../../lib/logger.js", () => ({
  Logger: {
    getInstance: () => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    }),
  },
  LogLevel: {
    INFO: "info",
  },
}));

// Helper to create a basic proposal state
function createBasicProposalState(): OverallProposalState {
  return {
    rfpDocument: {
      id: "test-rfp",
      status: "loaded",
    },
    researchResults: undefined,
    researchStatus: "queued",
    researchEvaluation: null,
    solutionResults: undefined,
    solutionStatus: "queued",
    solutionEvaluation: null,
    connections: undefined,
    connectionsStatus: "queued",
    connectionsEvaluation: null,
    sections: new Map(),
    requiredSections: [],
    interruptStatus: {
      isInterrupted: false,
      interruptionPoint: null,
      feedback: null,
      processingStatus: null,
    },
    userFeedback: undefined,
    interruptMetadata: undefined,
    currentStep: null,
    activeThreadId: "test-thread-id",
    messages: [],
    errors: [],
    createdAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    status: "queued",
  };
}

describe("OrchestratorService HITL methods", () => {
  let orchestratorService: OrchestratorService;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Initialize the service with mocks
    orchestratorService = new OrchestratorService(
      mockGraph as any,
      mockCheckpointer as any
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("detectInterrupt", () => {
    it("should return true if state has an active interrupt", async () => {
      // Set up state with active interrupt
      const state = createBasicProposalState();
      state.interruptStatus = {
        isInterrupted: true,
        interruptionPoint: "evaluateResearch",
        feedback: null,
        processingStatus: "pending",
      };
      mockCheckpointer.get.mockResolvedValue(state);

      const result =
        await orchestratorService.detectInterrupt("test-thread-id");

      expect(mockCheckpointer.get).toHaveBeenCalledWith("test-thread-id");
      expect(result).toBe(true);
    });

    it("should return false if state has no interrupt", async () => {
      // Set up state without interrupt
      const state = createBasicProposalState();
      mockCheckpointer.get.mockResolvedValue(state);

      const result =
        await orchestratorService.detectInterrupt("test-thread-id");

      expect(mockCheckpointer.get).toHaveBeenCalledWith("test-thread-id");
      expect(result).toBe(false);
    });

    it("should handle errors gracefully", async () => {
      mockCheckpointer.get.mockRejectedValue(new Error("Checkpointer error"));

      await expect(
        orchestratorService.detectInterrupt("test-thread-id")
      ).rejects.toThrow("Checkpointer error");
    });
  });

  describe("getInterruptDetails", () => {
    it("should return interrupt metadata if available", async () => {
      // Set up state with interrupt metadata
      const state = createBasicProposalState();
      state.interruptStatus = {
        isInterrupted: true,
        interruptionPoint: "evaluateResearch",
        feedback: null,
        processingStatus: "pending",
      };
      state.interruptMetadata = {
        reason: "EVALUATION_NEEDED",
        nodeId: "evaluateResearchNode",
        timestamp: new Date().toISOString(),
        contentReference: "research",
        evaluationResult: {
          passed: true,
          score: 8,
          feedback: "Good research",
        },
      };
      mockCheckpointer.get.mockResolvedValue(state);

      const result =
        await orchestratorService.getInterruptDetails("test-thread-id");

      expect(mockCheckpointer.get).toHaveBeenCalledWith("test-thread-id");
      expect(result).toEqual(state.interruptMetadata);
    });

    it("should return null if no interrupt metadata exists", async () => {
      // Set up state without interrupt metadata
      const state = createBasicProposalState();
      mockCheckpointer.get.mockResolvedValue(state);

      const result =
        await orchestratorService.getInterruptDetails("test-thread-id");

      expect(mockCheckpointer.get).toHaveBeenCalledWith("test-thread-id");
      expect(result).toBeNull();
    });

    it("should handle errors gracefully", async () => {
      mockCheckpointer.get.mockRejectedValue(new Error("Checkpointer error"));

      await expect(
        orchestratorService.getInterruptDetails("test-thread-id")
      ).rejects.toThrow("Checkpointer error");
    });
  });

  describe("submitFeedback", () => {
    it("should successfully process approval feedback", async () => {
      // Setup state with interruption for research
      const state = createBasicProposalState();
      state.interruptStatus = {
        isInterrupted: true,
        interruptionPoint: "evaluateResearch",
        feedback: null,
        processingStatus: "pending",
      };
      state.interruptMetadata = {
        reason: "EVALUATION_NEEDED",
        nodeId: "evaluateResearchNode",
        timestamp: new Date().toISOString(),
        contentReference: "research",
        evaluationResult: {
          passed: true,
          score: 8,
          feedback: "Good research",
        },
      };
      mockCheckpointer.get.mockResolvedValue(state);
      mockCheckpointer.put.mockResolvedValue(undefined);

      // Create feedback
      const feedback = {
        type: "approve",
        comments: "Looks good!",
        timestamp: new Date().toISOString(),
      };

      // Submit feedback
      const updatedState = await orchestratorService.submitFeedback(
        "test-thread-id",
        feedback
      );

      // Verify checkpointer was called correctly
      expect(mockCheckpointer.get).toHaveBeenCalledWith("test-thread-id");
      expect(mockCheckpointer.put).toHaveBeenCalledWith(
        "test-thread-id",
        expect.objectContaining({
          userFeedback: feedback,
          interruptStatus: expect.objectContaining({
            processingStatus: "processing",
          }),
        })
      );

      // Verify state was updated correctly
      expect(updatedState.userFeedback).toEqual(feedback);
      expect(updatedState.interruptStatus.processingStatus).toBe("processing");
    });

    it("should successfully process revision feedback", async () => {
      // Setup state with interruption for solution
      const state = createBasicProposalState();
      state.interruptStatus = {
        isInterrupted: true,
        interruptionPoint: "evaluateSolution",
        feedback: null,
        processingStatus: "pending",
      };
      state.interruptMetadata = {
        reason: "EVALUATION_NEEDED",
        nodeId: "evaluateSolutionNode",
        timestamp: new Date().toISOString(),
        contentReference: "solution",
        evaluationResult: {
          passed: true,
          score: 6,
          feedback: "Solution needs improvement",
        },
      };
      mockCheckpointer.get.mockResolvedValue(state);
      mockCheckpointer.put.mockResolvedValue(undefined);

      // Create feedback
      const feedback = {
        type: "revise",
        comments: "Please make these changes...",
        specificEdits: {
          target: "paragraph 2",
          suggestion: "Rewrite to include more details",
        },
        timestamp: new Date().toISOString(),
      };

      // Submit feedback
      const updatedState = await orchestratorService.submitFeedback(
        "test-thread-id",
        feedback
      );

      // Verify checkpointer was called correctly
      expect(mockCheckpointer.get).toHaveBeenCalledWith("test-thread-id");
      expect(mockCheckpointer.put).toHaveBeenCalledWith(
        "test-thread-id",
        expect.objectContaining({
          userFeedback: feedback,
          interruptStatus: expect.objectContaining({
            processingStatus: "processing",
          }),
        })
      );

      // Verify state was updated correctly
      expect(updatedState.userFeedback).toEqual(feedback);
      expect(updatedState.interruptStatus.processingStatus).toBe("processing");
    });

    it("should reject feedback if no interrupt is active", async () => {
      // Setup state without interruption
      const state = createBasicProposalState();
      mockCheckpointer.get.mockResolvedValue(state);

      // Create feedback
      const feedback = {
        type: "approve",
        timestamp: new Date().toISOString(),
      };

      // Should throw error
      await expect(
        orchestratorService.submitFeedback("test-thread-id", feedback)
      ).rejects.toThrow("No active interrupt found for thread");
    });

    it("should reject invalid feedback type", async () => {
      // Setup state with interruption
      const state = createBasicProposalState();
      state.interruptStatus = {
        isInterrupted: true,
        interruptionPoint: "evaluateResearch",
        feedback: null,
        processingStatus: "pending",
      };
      mockCheckpointer.get.mockResolvedValue(state);

      // Create invalid feedback
      const feedback = {
        type: "invalid" as any, // Type that doesn't match allowed types
        timestamp: new Date().toISOString(),
      };

      // Should throw error
      await expect(
        orchestratorService.submitFeedback("test-thread-id", feedback)
      ).rejects.toThrow("Invalid feedback type");
    });
  });

  describe("resumeAfterFeedback", () => {
    it("should resume graph execution with updated state", async () => {
      // Setup state with feedback ready to process
      const state = createBasicProposalState();
      state.interruptStatus = {
        isInterrupted: true,
        interruptionPoint: "evaluateResearch",
        feedback: {
          type: "approve",
          content: "Looks good!",
          timestamp: new Date().toISOString(),
        },
        processingStatus: "processing",
      };
      state.userFeedback = {
        type: "approve",
        comments: "Looks good!",
        timestamp: new Date().toISOString(),
      };
      mockCheckpointer.get.mockResolvedValue(state);
      mockCheckpointer.put.mockResolvedValue(undefined);
      mockGraphRun.mockResolvedValue({});

      // Resume after feedback
      await orchestratorService.resumeAfterFeedback("test-thread-id");

      // Verify checkpointer was called correctly
      expect(mockCheckpointer.get).toHaveBeenCalledWith("test-thread-id");
      expect(mockCheckpointer.put).toHaveBeenCalledWith(
        "test-thread-id",
        expect.objectContaining({
          status: "running",
        })
      );

      // Verify graph was resumed
      expect(mockGraphRun).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "running",
        })
      );
    });

    it("should throw error if no user feedback exists", async () => {
      // Setup state without feedback
      const state = createBasicProposalState();
      state.interruptStatus = {
        isInterrupted: true,
        interruptionPoint: "evaluateResearch",
        feedback: null,
        processingStatus: "pending",
      };
      // No userFeedback field
      mockCheckpointer.get.mockResolvedValue(state);

      // Should throw error
      await expect(
        orchestratorService.resumeAfterFeedback("test-thread-id")
      ).rejects.toThrow("No user feedback found");
    });

    it("should warn but continue if processingStatus is unexpected", async () => {
      // Setup state with feedback but wrong processing status
      const state = createBasicProposalState();
      state.interruptStatus = {
        isInterrupted: true,
        interruptionPoint: "evaluateResearch",
        feedback: {
          type: "approve",
          content: "Looks good!",
          timestamp: new Date().toISOString(),
        },
        processingStatus: "unexpected_status", // Not 'processing'
      };
      state.userFeedback = {
        type: "approve",
        comments: "Looks good!",
        timestamp: new Date().toISOString(),
      };
      mockCheckpointer.get.mockResolvedValue(state);
      mockCheckpointer.put.mockResolvedValue(undefined);
      mockGraphRun.mockResolvedValue({});

      // Resume after feedback (should not throw)
      await orchestratorService.resumeAfterFeedback("test-thread-id");

      // Verify graph was still resumed
      expect(mockGraphRun).toHaveBeenCalled();
    });

    it("should handle errors from checkpointer", async () => {
      mockCheckpointer.get.mockRejectedValue(new Error("Checkpointer error"));

      // Should throw error
      await expect(
        orchestratorService.resumeAfterFeedback("test-thread-id")
      ).rejects.toThrow("Checkpointer error");
    });

    it("should handle errors from graph.run", async () => {
      // Setup state with valid feedback
      const state = createBasicProposalState();
      state.interruptStatus = {
        isInterrupted: true,
        interruptionPoint: "evaluateResearch",
        feedback: {
          type: "approve",
          content: "Looks good!",
          timestamp: new Date().toISOString(),
        },
        processingStatus: "processing",
      };
      state.userFeedback = {
        type: "approve",
        comments: "Looks good!",
        timestamp: new Date().toISOString(),
      };
      mockCheckpointer.get.mockResolvedValue(state);
      mockCheckpointer.put.mockResolvedValue(undefined);
      mockGraphRun.mockRejectedValue(new Error("Graph error"));

      // Should throw error
      await expect(
        orchestratorService.resumeAfterFeedback("test-thread-id")
      ).rejects.toThrow("Graph error");
    });
  });

  describe("updateContentStatus", () => {
    it("should update research status based on feedback type", async () => {
      // Access the private method using type assertion
      const updateContentStatus = (orchestratorService as any)
        .updateContentStatus;

      // Create test state
      const state = createBasicProposalState();

      // Test approve feedback
      let result = updateContentStatus(state, "research", "approve");
      expect(result.researchStatus).toBe("approved");

      // Test revise feedback
      result = updateContentStatus(state, "research", "revise");
      expect(result.researchStatus).toBe("edited");

      // Test regenerate feedback
      result = updateContentStatus(state, "research", "regenerate");
      expect(result.researchStatus).toBe("stale");
    });

    it("should update solution status based on feedback type", async () => {
      // Access the private method using type assertion
      const updateContentStatus = (orchestratorService as any)
        .updateContentStatus;

      // Create test state
      const state = createBasicProposalState();

      // Test approve feedback
      let result = updateContentStatus(state, "solution", "approve");
      expect(result.solutionStatus).toBe("approved");

      // Test revise feedback
      result = updateContentStatus(state, "solution", "revise");
      expect(result.solutionStatus).toBe("edited");

      // Test regenerate feedback
      result = updateContentStatus(state, "solution", "regenerate");
      expect(result.solutionStatus).toBe("stale");
    });

    it("should update connections status based on feedback type", async () => {
      // Access the private method using type assertion
      const updateContentStatus = (orchestratorService as any)
        .updateContentStatus;

      // Create test state
      const state = createBasicProposalState();

      // Test approve feedback
      let result = updateContentStatus(state, "connections", "approve");
      expect(result.connectionsStatus).toBe("approved");

      // Test revise feedback
      result = updateContentStatus(state, "connections", "revise");
      expect(result.connectionsStatus).toBe("edited");

      // Test regenerate feedback
      result = updateContentStatus(state, "connections", "regenerate");
      expect(result.connectionsStatus).toBe("stale");
    });

    it("should update section status based on feedback type", async () => {
      // Access the private method using type assertion
      const updateContentStatus = (orchestratorService as any)
        .updateContentStatus;

      // Create test state with a section
      const state = createBasicProposalState();
      const sectionType = "PROBLEM_STATEMENT";
      const sectionData = {
        id: sectionType,
        content: "Problem statement content",
        status: "awaiting_review",
        lastUpdated: new Date().toISOString(),
      };
      state.sections.set(sectionType, sectionData);

      // Test approve feedback
      let result = updateContentStatus(state, sectionType, "approve");
      expect(result.sections.get(sectionType).status).toBe("approved");

      // Test revise feedback
      result = updateContentStatus(state, sectionType, "revise");
      expect(result.sections.get(sectionType).status).toBe("edited");

      // Test regenerate feedback
      result = updateContentStatus(state, sectionType, "regenerate");
      expect(result.sections.get(sectionType).status).toBe("stale");
    });

    it("should return unmodified state for unknown content reference", async () => {
      // Access the private method using type assertion
      const updateContentStatus = (orchestratorService as any)
        .updateContentStatus;

      // Create test state
      const state = createBasicProposalState();

      // Test with unknown content reference
      const result = updateContentStatus(state, "unknown", "approve");

      // Should return the original state unchanged
      expect(result).toBe(state);
    });
  });
});
