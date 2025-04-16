import { describe, it, expect } from "vitest";
import { routeAfterResearchEvaluation } from "../conditionals";
import type {
  ProposalState,
  EvaluationResult,
  ProcessingStatus,
} from "../../../state/proposal.state"; // Adjust path as needed
import { BaseMessage } from "@langchain/core/messages";

// Helper function to create a mock state, simplifying test cases
const createMockState = (
  researchStatus: ProcessingStatus,
  evaluation: EvaluationResult | null | undefined
): ProposalState => ({
  // Provide minimal valid structure for ProposalState, focusing on relevant fields
  rfpDocument: { id: "doc1", status: "loaded" },
  researchResults: {}, // Mock data or empty
  researchStatus: researchStatus,
  researchEvaluation: evaluation,
  solutionSoughtStatus: "queued", // Default irrelevant fields
  connectionsStatus: "queued",
  sections: new Map(),
  requiredSections: [],
  currentStep: null,
  activeThreadId: "thread-123",
  messages: [] as BaseMessage[],
  errors: [],
  createdAt: new Date().toISOString(),
  lastUpdatedAt: new Date().toISOString(),
  status: "running", // Overall status can be generic
});

describe("routeAfterResearchEvaluation", () => {
  it("should route to handle_error if researchStatus is error", () => {
    const state = createMockState("error", {
      passed: false,
      feedback: "failed",
    });
    expect(routeAfterResearchEvaluation(state)).toBe("handle_error");
  });

  it("should route to handle_error if researchEvaluation is null", () => {
    const state = createMockState("awaiting_review", null);
    expect(routeAfterResearchEvaluation(state)).toBe("handle_error");
  });

  it("should route to handle_error if researchEvaluation is undefined", () => {
    const state = createMockState("awaiting_review", undefined);
    expect(routeAfterResearchEvaluation(state)).toBe("handle_error");
  });

  it("should route to solutionSought if evaluation passed is true", () => {
    const state = createMockState("awaiting_review", {
      passed: true,
      feedback: "Looks good",
    });
    expect(routeAfterResearchEvaluation(state)).toBe("solutionSought");
  });

  it("should route to await_research_review if evaluation passed is false", () => {
    const state = createMockState("awaiting_review", {
      passed: false,
      feedback: "Needs more detail",
    });
    expect(routeAfterResearchEvaluation(state)).toBe("await_research_review");
  });

  // Optional: Test edge case where status is approved but evaluation failed (should still go to review)
  it("should route to await_research_review even if status is approved but evaluation passed is false", () => {
    const state = createMockState("approved", {
      passed: false,
      feedback: "Contradiction found",
    });
    expect(routeAfterResearchEvaluation(state)).toBe("await_research_review");
  });
});
