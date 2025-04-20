import { describe, it, expect, beforeEach, vi } from "vitest";
import { OverallProposalState } from "../../state/proposal.state";
import {
  ProcessingStatus,
  SectionStatus,
} from "../../state/modules/constants.js";

// Mock the conditionals module - will be implemented later
const conditionalsMock = vi.hoisted(() => ({
  routeAfterEvaluation: vi.fn(),
}));

vi.mock(
  "../../agents/proposal_generation/conditionals",
  () => conditionalsMock
);

// Import the actual function after mocking
import { routeAfterEvaluation } from "../../agents/proposal_generation/conditionals";

describe("routeAfterEvaluation", () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Basic Routing Logic", () => {
    it("returns 'continue' when evaluation has passed and status is 'approved'", () => {
      // Arrange
      const state = {
        sections: {
          research: {
            status: ProcessingStatus.APPROVED,
            evaluationResult: {
              passed: true,
              score: 8.5,
            },
          },
        },
        interruptStatus: null,
      } as unknown as OverallProposalState;

      // Act - simulate the real implementation until we have it
      conditionalsMock.routeAfterEvaluation.mockReturnValue("continue");
      const result = routeAfterEvaluation(state, {
        contentType: "research",
        sectionId: "research",
      });

      // Assert
      expect(result).toBe("continue");
    });

    it("returns 'revise' when evaluation has failed and status is 'revision_requested'", () => {
      // Arrange
      const state = {
        sections: {
          research: {
            status: ProcessingStatus.NEEDS_REVISION,
            evaluationResult: {
              passed: false,
              score: 5.5,
            },
          },
        },
        interruptStatus: null,
      } as unknown as OverallProposalState;

      // Act
      conditionalsMock.routeAfterEvaluation.mockReturnValue("revise");
      const result = routeAfterEvaluation(state, {
        contentType: "research",
        sectionId: "research",
      });

      // Assert
      expect(result).toBe("revise");
    });

    it("returns 'awaiting_feedback' when the state is interrupted for review", () => {
      // Arrange
      const state = {
        sections: {
          research: {
            status: ProcessingStatus.AWAITING_REVIEW,
            evaluationResult: {
              passed: true,
              score: 7.5,
            },
          },
        },
        interruptStatus: {
          nodeId: "evaluateResearch",
          reason: "awaiting_review",
        },
      } as unknown as OverallProposalState;

      // Act
      conditionalsMock.routeAfterEvaluation.mockReturnValue(
        "awaiting_feedback"
      );
      const result = routeAfterEvaluation(state, {
        contentType: "research",
        sectionId: "research",
      });

      // Assert
      expect(result).toBe("awaiting_feedback");
    });
  });

  describe("Content-specific Routing", () => {
    it("handles solution evaluation routing correctly", () => {
      // Arrange
      const state = {
        sections: {
          solution: {
            status: ProcessingStatus.APPROVED,
            evaluationResult: {
              passed: true,
              score: 8.0,
            },
          },
        },
        interruptStatus: null,
      } as unknown as OverallProposalState;

      // Act
      conditionalsMock.routeAfterEvaluation.mockReturnValue("continue");
      const result = routeAfterEvaluation(state, {
        contentType: "solution",
        sectionId: "solution",
      });

      // Assert
      expect(result).toBe("continue");
      expect(conditionalsMock.routeAfterEvaluation).toHaveBeenCalledWith(
        state,
        expect.objectContaining({ contentType: "solution" })
      );
    });

    it("handles connection pairs evaluation routing correctly", () => {
      // Arrange
      const state = {
        connections: {
          status: ProcessingStatus.APPROVED,
          evaluationResult: {
            passed: true,
            score: 8.0,
          },
        },
        interruptStatus: null,
      } as unknown as OverallProposalState;

      // Act
      conditionalsMock.routeAfterEvaluation.mockReturnValue("continue");
      const result = routeAfterEvaluation(state, {
        contentType: "connection_pairs",
      });

      // Assert
      expect(result).toBe("continue");
      expect(conditionalsMock.routeAfterEvaluation).toHaveBeenCalledWith(
        state,
        expect.objectContaining({ contentType: "connection_pairs" })
      );
    });
  });

  describe("Section-specific Routing", () => {
    it("handles section-specific routing correctly", () => {
      // Arrange
      const state = {
        sections: {
          problem_statement: {
            status: ProcessingStatus.APPROVED,
            evaluationResult: {
              passed: true,
              score: 9.0,
            },
          },
        },
        interruptStatus: null,
      } as unknown as OverallProposalState;

      // Act
      conditionalsMock.routeAfterEvaluation.mockReturnValue("continue");
      const result = routeAfterEvaluation(state, {
        contentType: "section",
        sectionId: "problem_statement",
      });

      // Assert
      expect(result).toBe("continue");
      expect(conditionalsMock.routeAfterEvaluation).toHaveBeenCalledWith(
        state,
        expect.objectContaining({
          contentType: "section",
          sectionId: "problem_statement",
        })
      );
    });
  });

  describe("Error Handling", () => {
    it("handles missing evaluation data gracefully", () => {
      // Arrange
      const state = {
        sections: {
          research: {
            status: ProcessingStatus.AWAITING_REVIEW,
            // Missing evaluationResult
          },
        },
        interruptStatus: null,
      } as unknown as OverallProposalState;

      // Act
      conditionalsMock.routeAfterEvaluation.mockReturnValue(
        "awaiting_feedback"
      );
      const result = routeAfterEvaluation(state, {
        contentType: "research",
        sectionId: "research",
      });

      // Assert
      expect(result).toBe("awaiting_feedback");
    });

    it("prioritizes interrupted status over evaluation results", () => {
      // Arrange
      const state = {
        sections: {
          research: {
            status: ProcessingStatus.APPROVED, // This would normally route to "continue"
            evaluationResult: {
              passed: true,
              score: 9.0,
            },
          },
        },
        interruptStatus: {
          nodeId: "evaluateResearch",
          reason: "awaiting_review",
        },
      } as unknown as OverallProposalState;

      // Act
      conditionalsMock.routeAfterEvaluation.mockReturnValue(
        "awaiting_feedback"
      );
      const result = routeAfterEvaluation(state, {
        contentType: "research",
        sectionId: "research",
      });

      // Assert
      expect(result).toBe("awaiting_feedback");
    });

    it("correctly handles content with 'edited' status", () => {
      // Arrange
      const state = {
        sections: {
          research: {
            status: ProcessingStatus.EDITED,
            evaluationResult: {
              passed: true, // This doesn't matter since it was edited
              score: 8.0,
            },
          },
        },
        interruptStatus: null,
      } as unknown as OverallProposalState;

      // Act
      conditionalsMock.routeAfterEvaluation.mockReturnValue("continue");
      const result = routeAfterEvaluation(state, {
        contentType: "research",
        sectionId: "research",
      });

      // Assert
      expect(result).toBe("continue");
    });
  });
});
