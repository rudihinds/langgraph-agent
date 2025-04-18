import { describe, it, expect, vi, beforeEach } from "vitest";
import { processFeedbackNode } from "../nodes.js";
import { OverallProposalState } from "../../../state/modules/types.js";
import { FeedbackType } from "../../../lib/types/feedback.js";

describe("processFeedbackNode", () => {
  let mockState: OverallProposalState;
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Set up a basic state with an interrupt and user feedback
    mockState = {
      userId: "test-user",
      rfpId: "test-rfp",
      rfp: {
        text: "Test RFP",
        title: "Test Title",
        metadata: {},
      },
      research: {
        status: "awaiting_review",
        content: "Test research content",
      },
      solution: {
        status: "not_started",
      },
      sections: new Map(),
      systemMessages: [],
      connections: {
        status: "not_started",
      },
      messages: [],
      interruptStatus: {
        isInterrupted: true,
        interruptionPoint: "evaluateResearch",
        processingStatus: "awaiting_input",
      },
      interruptMetadata: {
        reason: "EVALUATION_NEEDED",
        nodeId: "evaluateResearch",
        timestamp: new Date().toISOString(),
        contentReference: "research",
      },
      userFeedback: {
        type: "approve",
        comments: "Looks good!",
        timestamp: new Date().toISOString(),
      },
      errors: [],
    };

    // @ts-ignore - Mock the logger
    global.logger = mockLogger;
  });

  it("should process approval feedback correctly", async () => {
    // Arrange
    mockState.userFeedback!.type = FeedbackType.APPROVE;
    mockState.research.status = "awaiting_review";

    // Act
    const result = await processFeedbackNode(mockState);

    // Assert
    expect(result.interruptStatus.isInterrupted).toBe(false);
    expect(result.interruptStatus.interruptionPoint).toBeNull();
    expect(result.interruptStatus.processingStatus).toBeNull();
    expect(result.research.status).toBe("approved");
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Processing user feedback: approve")
    );
  });

  it("should process revision feedback correctly", async () => {
    // Arrange
    mockState.userFeedback!.type = FeedbackType.REVISE;
    mockState.userFeedback!.comments = "Please make the following revisions";
    mockState.research.status = "awaiting_review";

    // Act
    const result = await processFeedbackNode(mockState);

    // Assert
    expect(result.interruptStatus.isInterrupted).toBe(false);
    expect(result.research.status).toBe("edited");
    expect(result.research.revisionInstructions).toBe(
      "Please make the following revisions"
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Processing user feedback: revise")
    );
  });

  it("should process regeneration feedback correctly", async () => {
    // Arrange
    mockState.userFeedback!.type = FeedbackType.REGENERATE;
    mockState.userFeedback!.comments =
      "Please regenerate with these instructions";
    mockState.research.status = "awaiting_review";

    // Act
    const result = await processFeedbackNode(mockState);

    // Assert
    expect(result.interruptStatus.isInterrupted).toBe(false);
    expect(result.research.status).toBe("stale");
    expect(result.research.regenerationInstructions).toBe(
      "Please regenerate with these instructions"
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Processing user feedback: regenerate")
    );
  });

  it("should handle section feedback correctly", async () => {
    // Arrange
    mockState.interruptMetadata!.contentReference = "section-123";
    mockState.interruptMetadata!.nodeId = "evaluateSection";
    mockState.sections = new Map();
    mockState.sections.set("section-123", {
      id: "section-123",
      title: "Test Section",
      content: "Test content",
      status: "awaiting_review",
    });
    mockState.userFeedback!.type = FeedbackType.APPROVE;

    // Act
    const result = await processFeedbackNode(mockState);

    // Assert
    expect(result.interruptStatus.isInterrupted).toBe(false);
    expect(result.sections.get("section-123")!.status).toBe("approved");
  });

  it("should handle solution feedback correctly", async () => {
    // Arrange
    mockState.interruptMetadata!.contentReference = "solution";
    mockState.interruptMetadata!.nodeId = "evaluateSolution";
    mockState.solution.status = "awaiting_review";
    mockState.solution.content = "Test solution content";
    mockState.userFeedback!.type = FeedbackType.REVISE;
    mockState.userFeedback!.comments = "Revise the solution";

    // Act
    const result = await processFeedbackNode(mockState);

    // Assert
    expect(result.interruptStatus.isInterrupted).toBe(false);
    expect(result.solution.status).toBe("edited");
    expect(result.solution.revisionInstructions).toBe("Revise the solution");
  });

  it("should handle connections feedback correctly", async () => {
    // Arrange
    mockState.interruptMetadata!.contentReference = "connections";
    mockState.interruptMetadata!.nodeId = "evaluateConnections";
    mockState.connections.status = "awaiting_review";
    mockState.connections.content = "Test connections content";
    mockState.userFeedback!.type = FeedbackType.REGENERATE;
    mockState.userFeedback!.comments = "Regenerate the connections";

    // Act
    const result = await processFeedbackNode(mockState);

    // Assert
    expect(result.interruptStatus.isInterrupted).toBe(false);
    expect(result.connections.status).toBe("stale");
    expect(result.connections.regenerationInstructions).toBe(
      "Regenerate the connections"
    );
  });

  it("should handle missing user feedback", async () => {
    // Arrange
    mockState.userFeedback = undefined;

    // Act
    const result = await processFeedbackNode(mockState);

    // Assert
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain("No user feedback found");
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("No user feedback found")
    );
  });

  it("should handle missing interrupt metadata", async () => {
    // Arrange
    mockState.interruptMetadata = undefined;

    // Act
    const result = await processFeedbackNode(mockState);

    // Assert
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain("No interrupt metadata found");
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("No interrupt metadata found")
    );
  });

  it("should handle unknown content reference", async () => {
    // Arrange
    mockState.interruptMetadata!.contentReference = "unknown";

    // Act
    const result = await processFeedbackNode(mockState);

    // Assert
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain("Unknown content reference");
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Unknown content reference")
    );
  });

  it("should handle unknown feedback type", async () => {
    // Arrange
    mockState.userFeedback!.type = "unknown" as any;

    // Act
    const result = await processFeedbackNode(mockState);

    // Assert
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain("Unknown feedback type");
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Unknown feedback type")
    );
  });
});
