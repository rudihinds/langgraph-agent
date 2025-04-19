import { describe, it, expect, beforeEach, vi } from "vitest";
import { OverallProposalState } from "../../state/proposal.state";

// Mock the Checkpointer
const checkpointerMock = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
}));

// Mock the Graph execution
const graphExecutorMock = vi.hoisted(() => ({
  resume: vi.fn(),
}));

// Mock dependency map for stale content tracking
const dependencyMapMock = {
  solution: ["research"],
  problem_statement: [],
  approach: ["problem_statement", "solution"],
  implementation: ["approach", "solution"],
  impact: ["implementation", "problem_statement"],
};

// Mock the dependencies module
vi.mock("../../config/dependencies", () => ({
  default: dependencyMapMock,
  getDependencyMap: vi.fn().mockReturnValue(dependencyMapMock),
}));

// Import the Orchestrator service after mocking
import { OrchestratorService } from "../../services/orchestrator.service";

describe("Orchestrator Integration with Evaluation", () => {
  let orchestratorService: OrchestratorService;
  let testState: Partial<OverallProposalState>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup fresh mock state
    testState = {
      userId: "test-user-123",
      sections: {
        research: {
          status: "awaiting_review",
          content: "This is the research content",
          evaluationResult: {
            passed: true,
            score: 8.5,
            feedback: "Good research with comprehensive coverage.",
            strengths: ["Thorough analysis", "Good sources"],
            weaknesses: ["Could use more recent sources"],
            suggestions: ["Add more recent studies from 2023"],
          },
        },
        problem_statement: {
          status: "approved",
          content: "This is a problem statement",
        },
        solution: {
          status: "awaiting_review",
          content: "This is the solution content",
          evaluationResult: {
            passed: false,
            score: 5.8,
            feedback: "The solution needs more detail on implementation.",
            strengths: ["Creative approach", "Addresses key issues"],
            weaknesses: [
              "Lacks implementation details",
              "Budget considerations missing",
            ],
            suggestions: [
              "Add specific implementation steps",
              "Include cost analysis",
            ],
          },
        },
      },
      interruptStatus: {
        nodeId: "evaluateResearch",
        reason: "awaiting_review",
      },
      interruptMetadata: {
        contentType: "research",
        sectionId: "research",
        evaluationResult: {
          passed: true,
          score: 8.5,
        },
      },
      messages: [],
      errors: [],
    };

    // Setup checkpointer mock
    checkpointerMock.get.mockResolvedValue(testState);
    checkpointerMock.put.mockResolvedValue(undefined);

    // Setup graph executor mock
    graphExecutorMock.resume.mockResolvedValue({ status: "running" });

    // Create the Orchestrator service with mocked dependencies
    orchestratorService = new OrchestratorService(
      checkpointerMock as any,
      graphExecutorMock as any
    );
  });

  describe("Evaluation Feedback Handling", () => {
    it("handles approval feedback by setting status to 'approved'", async () => {
      // Arrange
      const threadId = "test-thread-123";
      const feedback = {
        action: "approve",
        contentType: "research",
        sectionId: "research",
      };

      // Act
      await orchestratorService.handleEvaluationFeedback(threadId, feedback);

      // Assert
      expect(checkpointerMock.put).toHaveBeenCalled();

      // Extract the state that was passed to checkpointer.put
      const updatedState = checkpointerMock.put.mock.calls[0][1];

      // Verify the updated state has correct status
      const researchSection = updatedState.sections.get("research");
      expect(researchSection?.status).toBe("approved");

      // Verify interruptStatus was cleared
      expect(updatedState.interruptStatus).toBeNull();

      // Verify graph was resumed
      expect(graphExecutorMock.resume).toHaveBeenCalledWith(threadId);
    });

    it("handles revision feedback by setting status to 'revision_requested'", async () => {
      // Arrange
      const threadId = "test-thread-123";
      const feedback = {
        action: "revise",
        contentType: "solution",
        sectionId: "solution",
        revisionGuidance:
          "Please add more implementation details and cost estimates.",
      };

      // Act
      await orchestratorService.handleEvaluationFeedback(threadId, feedback);

      // Assert
      expect(checkpointerMock.put).toHaveBeenCalled();

      // Extract the state that was passed to checkpointer.put
      const updatedState = checkpointerMock.put.mock.calls[0][1];

      // Verify the updated state has correct status
      const solutionSection = updatedState.sections.get("solution");
      expect(solutionSection?.status).toBe("revision_requested");

      // Verify messages were added to state
      expect(updatedState.messages).toContainEqual(
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining(
            "Please add more implementation details"
          ),
          metadata: expect.objectContaining({
            contentType: "solution",
            sectionId: "solution",
            action: "revise",
          }),
        })
      );

      // Verify interruptStatus was cleared
      expect(updatedState.interruptStatus).toBeNull();

      // Verify graph was resumed
      expect(graphExecutorMock.resume).toHaveBeenCalledWith(threadId);
    });

    it("adds appropriate messages to state when handling feedback", async () => {
      // Arrange
      const threadId = "test-thread-123";
      const feedback = {
        action: "approve",
        contentType: "research",
        sectionId: "research",
        comments: "Excellent research, very thorough!",
      };

      // Act
      await orchestratorService.handleEvaluationFeedback(threadId, feedback);

      // Assert
      const updatedState = checkpointerMock.put.mock.calls[0][1];

      // Verify messages were added to state
      expect(updatedState.messages).toContainEqual(
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("Excellent research"),
          metadata: expect.objectContaining({
            contentType: "research",
            sectionId: "research",
            action: "approve",
          }),
        })
      );
    });
  });

  describe("Content Editing & Stale Marking", () => {
    it("marks dependent sections as stale after content edit", async () => {
      // Arrange
      const threadId = "test-thread-123";
      const editedSection = "research";
      const editData = {
        contentType: "research",
        sectionId: "research",
        content: "This is updated research content with new findings.",
      };

      // Update test state to have solution depend on research (already setup in dependency map)
      testState.sections.solution.status = "approved"; // Should become stale

      // Act
      await orchestratorService.handleContentEdit(threadId, editData);

      // Assert
      const updatedState = checkpointerMock.put.mock.calls[0][1];

      // Verify edited section has "edited" status
      const editedSectionData = updatedState.sections.get(editedSection);
      expect(editedSectionData?.status).toBe("edited");
      expect(editedSectionData?.content).toBe(editData.content);

      // Verify dependent section (solution) is marked as stale
      const solutionSection = updatedState.sections.get("solution");
      expect(solutionSection?.status).toBe("stale");
    });

    it("applies dependency map correctly when marking stale content", async () => {
      // Arrange
      const threadId = "test-thread-123";
      const editedSection = "problem_statement";
      const editData = {
        contentType: "section",
        sectionId: "problem_statement",
        content: "This is an updated problem statement.",
      };

      // Setup test state with approved sections that depend on problem_statement
      testState.sections.problem_statement = {
        status: "approved",
        content: "Original problem statement",
      };

      testState.sections.approach = {
        status: "approved", // Should become stale (depends on problem_statement)
        content: "Approach content",
      };

      testState.sections.impact = {
        status: "approved", // Should become stale (depends indirectly via implementation)
        content: "Impact content",
      };

      testState.sections.implementation = {
        status: "approved", // Should become stale (depends on approach)
        content: "Implementation content",
      };

      // Act
      await orchestratorService.handleContentEdit(threadId, editData);

      // Assert
      const updatedState = checkpointerMock.put.mock.calls[0][1];

      // Verify sections are marked as stale
      const approachSection = updatedState.sections.get("approach");
      const impactSection = updatedState.sections.get("impact");
      const implementationSection = updatedState.sections.get("implementation");
      expect(approachSection?.status).toBe("stale");
      expect(impactSection?.status).toBe("stale");
      expect(implementationSection?.status).toBe("stale");
    });
  });

  describe("Stale Content Handling", () => {
    it("handles 'regenerate' choice for stale content by setting status to 'queued'", async () => {
      // Arrange
      const threadId = "test-thread-123";
      const staleDecision = {
        action: "regenerate",
        contentType: "section",
        sectionId: "solution",
        regenerationGuidance:
          "Update the solution to match the new research findings.",
      };

      // Setup state with stale solution section
      testState.sections.solution.status = "stale";

      // Act
      await orchestratorService.handleStaleDecision(threadId, staleDecision);

      // Assert
      const updatedState = checkpointerMock.put.mock.calls[0][1];

      // Verify status is set to queued
      const solutionSection = updatedState.sections.get("solution");
      expect(solutionSection?.status).toBe("queued");

      // Verify regeneration guidance is added to messages
      expect(updatedState.messages).toContainEqual(
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("Update the solution to match"),
          metadata: expect.objectContaining({
            contentType: "section",
            sectionId: "solution",
            action: "regenerate",
          }),
        })
      );

      // Verify graph was resumed
      expect(graphExecutorMock.resume).toHaveBeenCalledWith(threadId);
    });

    it("handles 'keep' choice for stale content by setting status to 'approved'", async () => {
      // Arrange
      const threadId = "test-thread-123";
      const staleDecision = {
        action: "keep",
        contentType: "section",
        sectionId: "solution",
        comments: "The solution is still valid despite the research changes.",
      };

      // Setup state with stale solution section
      testState.sections.solution.status = "stale";

      // Act
      await orchestratorService.handleStaleDecision(threadId, staleDecision);

      // Assert
      const updatedState = checkpointerMock.put.mock.calls[0][1];

      // Verify status is set to approved
      const solutionSection = updatedState.sections.get("solution");
      expect(solutionSection?.status).toBe("approved");

      // Verify message is added
      expect(updatedState.messages).toContainEqual(
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("The solution is still valid"),
          metadata: expect.objectContaining({
            contentType: "section",
            sectionId: "solution",
            action: "keep",
          }),
        })
      );

      // Verify graph was resumed
      expect(graphExecutorMock.resume).toHaveBeenCalledWith(threadId);
    });
  });

  describe("End-to-End Flow", () => {
    it("handles complete flow from evaluation to feedback to continuation", async () => {
      // Arrange
      const threadId = "test-thread-123";

      // Setup state with section awaiting review
      testState.sections.research.status = "awaiting_review";
      testState.interruptStatus = {
        nodeId: "evaluateResearch",
        reason: "awaiting_review",
      };
      testState.interruptMetadata = {
        contentType: "research",
        sectionId: "research",
        evaluationResult: {
          passed: true,
          score: 8.5,
        },
      };

      // Act - Handle approval feedback
      await orchestratorService.handleEvaluationFeedback(threadId, {
        action: "approve",
        contentType: "research",
        sectionId: "research",
      });

      // Assert
      const updatedState = checkpointerMock.put.mock.calls[0][1];

      // Verify status changed to approved
      const researchSection = updatedState.sections.get("research");
      expect(researchSection?.status).toBe("approved");

      // Verify interrupt state was cleared
      expect(updatedState.interruptStatus).toBeNull();
      expect(updatedState.interruptMetadata).toBeNull();

      // Verify graph was resumed
      expect(graphExecutorMock.resume).toHaveBeenCalledWith(threadId);
    });

    it("handles flow with revision feedback, regeneration, and stale content handling", async () => {
      // This test would be more complex and detailed in real implementation
      // For now, we'll structure it without full implementation

      const threadId = "test-thread-123";

      // We could structure multi-step tests like:
      // 1. Set up initial state
      // 2. Apply revision feedback
      // 3. Verify appropriate updates
      // 4. Update checkpointer mock for next state
      // 5. Apply regeneration choice
      // 6. Verify state updates
      // etc.

      // For now, just add a pending reminder
      it.todo("implement full multi-step flow test");
    });
  });

  describe("Error Handling", () => {
    it("handles errors during evaluation feedback processing", async () => {
      // Arrange
      const threadId = "test-thread-123";
      const feedback = {
        action: "approve",
        contentType: "research",
        sectionId: "research",
      };

      // Setup error in checkpointer
      checkpointerMock.put.mockRejectedValueOnce(
        new Error("Checkpointer failure")
      );

      // Act & Assert
      await expect(
        orchestratorService.handleEvaluationFeedback(threadId, feedback)
      ).rejects.toThrow("Checkpointer failure");

      // Verify graph resume was not called after error
      expect(graphExecutorMock.resume).not.toHaveBeenCalled();
    });

    it("handles errors during stale content decision processing", async () => {
      // Arrange
      const threadId = "test-thread-123";
      const staleDecision = {
        action: "regenerate",
        contentType: "section",
        sectionId: "solution",
      };

      // Setup error in checkpointer
      checkpointerMock.put.mockRejectedValueOnce(
        new Error("Checkpointer failure")
      );

      // Act & Assert
      await expect(
        orchestratorService.handleStaleDecision(threadId, staleDecision)
      ).rejects.toThrow("Checkpointer failure");

      // Verify graph resume was not called after error
      expect(graphExecutorMock.resume).not.toHaveBeenCalled();
    });
  });
});
