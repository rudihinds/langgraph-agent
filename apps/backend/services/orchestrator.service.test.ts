/**
 * Tests for the OrchestratorService
 *
 * Focuses on testing HITL interrupt detection and handling functionality
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrchestratorService } from "./[dep]orchestrator.service.js";
import { OverallProposalState, SectionType } from "../state/modules/types.js";

// Mock logger
vi.mock("../lib/logger.js", () => {
  return {
    Logger: {
      getInstance: vi.fn().mockReturnValue({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        setLogLevel: vi.fn(),
      }),
    },
    LogLevel: {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3,
    },
  };
});

describe("OrchestratorService - Interrupt Detection", () => {
  let mockGraph: any;
  let mockCheckpointer: any;
  let orchestrator: OrchestratorService;

  beforeEach(() => {
    // Create a mock StateGraph
    mockGraph = {
      resume: vi.fn(),
    };

    // Create a mock Checkpointer
    mockCheckpointer = {
      get: vi.fn(),
      put: vi.fn(),
    };

    // Create a new OrchestratorService instance with mocks
    orchestrator = new OrchestratorService(mockGraph, mockCheckpointer);
  });

  it("should detect an interrupt when state has isInterrupted=true", async () => {
    // Setup test state with interrupt
    mockCheckpointer.get.mockResolvedValue({
      interruptStatus: {
        isInterrupted: true,
        interruptionPoint: "evaluateResearch",
        feedback: null,
        processingStatus: "pending",
      },
      status: "awaiting_review",
    });

    const result = await orchestrator.detectInterrupt("test-thread");

    expect(result).toBe(true);
    expect(mockCheckpointer.get).toHaveBeenCalledWith("test-thread");
  });

  it("should not detect an interrupt when state has isInterrupted=false", async () => {
    // Setup test state without interrupt
    mockCheckpointer.get.mockResolvedValue({
      interruptStatus: {
        isInterrupted: false,
        interruptionPoint: null,
        feedback: null,
        processingStatus: null,
      },
      status: "running",
    });

    const result = await orchestrator.detectInterrupt("test-thread");

    expect(result).toBe(false);
  });

  it("should handle a valid interrupt successfully", async () => {
    // Setup test state with interrupt
    const mockState = {
      interruptStatus: {
        isInterrupted: true,
        interruptionPoint: "evaluateResearch",
        feedback: null,
        processingStatus: "pending",
      },
      interruptMetadata: {
        reason: "EVALUATION_NEEDED",
        nodeId: "evaluateResearchNode",
        timestamp: "2023-06-15T14:30:00Z",
        contentReference: "research",
        evaluationResult: { score: 8, passed: true },
      },
      status: "awaiting_review",
    };

    mockCheckpointer.get.mockResolvedValue(mockState);

    const result = await orchestrator.handleInterrupt("test-thread");

    expect(result).toEqual(mockState);
  });

  it("should throw error when handling non-interrupted state", async () => {
    mockCheckpointer.get.mockResolvedValue({
      interruptStatus: {
        isInterrupted: false,
        interruptionPoint: null,
        feedback: null,
        processingStatus: null,
      },
      status: "running",
    });

    await expect(orchestrator.handleInterrupt("test-thread")).rejects.toThrow(
      "No interrupt detected"
    );
  });

  it("should get interrupt details for interrupted state", async () => {
    // Setup mock state with interrupt metadata
    const mockState = {
      interruptStatus: {
        isInterrupted: true,
        interruptionPoint: "evaluateResearch",
        feedback: null,
        processingStatus: "pending",
      },
      interruptMetadata: {
        nodeId: "evaluateResearchNode",
        reason: "EVALUATION_NEEDED",
        contentReference: "research",
        timestamp: "2023-06-15T14:30:00Z",
        evaluationResult: { score: 8, passed: true },
      },
      status: "awaiting_review",
    };

    mockCheckpointer.get.mockResolvedValue(mockState);

    const details = await orchestrator.getInterruptDetails("test-thread");

    expect(details).toEqual({
      nodeId: "evaluateResearchNode",
      reason: "EVALUATION_NEEDED",
      contentReference: "research",
      timestamp: "2023-06-15T14:30:00Z",
      evaluationResult: { score: 8, passed: true },
    });
  });

  it("should return null for getInterruptDetails when no interrupt exists", async () => {
    mockCheckpointer.get.mockResolvedValue({
      interruptStatus: {
        isInterrupted: false,
        interruptionPoint: null,
        feedback: null,
        processingStatus: null,
      },
      status: "running",
    });

    const details = await orchestrator.getInterruptDetails("test-thread");

    expect(details).toBeNull();
  });

  it("should get research content for a research interrupt", async () => {
    // Setup mock state with research interrupt
    mockCheckpointer.get.mockResolvedValue({
      interruptStatus: {
        isInterrupted: true,
        interruptionPoint: "evaluateResearch",
        feedback: null,
        processingStatus: "pending",
      },
      interruptMetadata: {
        nodeId: "evaluateResearchNode",
        reason: "EVALUATION_NEEDED",
        contentReference: "research",
        timestamp: "2023-06-15T14:30:00Z",
        evaluationResult: { score: 8, passed: true },
      },
      researchResults: {
        summary: "Research summary",
        findings: ["Finding 1", "Finding 2"],
      },
      status: "awaiting_review",
    });

    const content = await orchestrator.getInterruptContent("test-thread");

    expect(content).toEqual({
      reference: "research",
      content: {
        summary: "Research summary",
        findings: ["Finding 1", "Finding 2"],
      },
    });
  });

  it("should get section content for a section interrupt", async () => {
    // Create a mock sections Map with a test section
    const sectionsMap = new Map();
    sectionsMap.set(SectionType.PROBLEM_STATEMENT, {
      id: SectionType.PROBLEM_STATEMENT,
      content: "Problem statement content",
      status: "awaiting_review",
      lastUpdated: "2023-06-15T14:30:00Z",
    });

    // Setup mock state with section interrupt
    mockCheckpointer.get.mockResolvedValue({
      interruptStatus: {
        isInterrupted: true,
        interruptionPoint: "evaluateSection:problem_statement",
        feedback: null,
        processingStatus: "pending",
      },
      interruptMetadata: {
        nodeId: "evaluateSectionNode",
        reason: "EVALUATION_NEEDED",
        contentReference: SectionType.PROBLEM_STATEMENT,
        timestamp: "2023-06-15T14:30:00Z",
        evaluationResult: { score: 7, passed: true },
      },
      sections: sectionsMap,
      status: "awaiting_review",
    });

    const content = await orchestrator.getInterruptContent("test-thread");

    expect(content).toEqual({
      reference: SectionType.PROBLEM_STATEMENT,
      content: {
        id: SectionType.PROBLEM_STATEMENT,
        content: "Problem statement content",
        status: "awaiting_review",
        lastUpdated: "2023-06-15T14:30:00Z",
      },
    });
  });

  it("should return null when content reference is invalid", async () => {
    // Setup mock state with an invalid content reference
    mockCheckpointer.get.mockResolvedValue({
      interruptStatus: {
        isInterrupted: true,
        interruptionPoint: "evaluateSection",
        feedback: null,
        processingStatus: "pending",
      },
      interruptMetadata: {
        nodeId: "evaluateSectionNode",
        reason: "EVALUATION_NEEDED",
        contentReference: "invalid_section_type",
        timestamp: "2023-06-15T14:30:00Z",
        evaluationResult: { score: 7, passed: true },
      },
      sections: new Map(),
      status: "awaiting_review",
    });

    const content = await orchestrator.getInterruptContent("test-thread");

    expect(content).toBeNull();
  });
});
