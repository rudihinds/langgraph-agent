/**
 * Tests for proposal agent conditionals
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  routeAfterResearchEvaluation,
  routeAfterSolutionEvaluation,
  determineNextSection,
  routeAfterSectionEvaluation,
  routeAfterSectionFeedback,
  routeFinalizeProposal,
  routeAfterResearchReview,
  routeAfterSolutionReview,
  routeAfterStaleChoice,
  handleError,
} from "../conditionals";
import {
  ProposalState,
  SectionType,
  SectionProcessingStatus,
} from "../../../state/proposal.state";

// Mock console for tests
beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// Helper to create a basic proposal state for testing
function createBasicProposalState(): ProposalState {
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
    requiredSections: [
      SectionType.PROBLEM_STATEMENT,
      SectionType.METHODOLOGY,
      SectionType.BUDGET,
    ],
    currentStep: null,
    activeThreadId: "test-thread-id",
    messages: [],
    errors: [],
    createdAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    status: "queued",
  };
}

describe("Proposal Agent Conditionals", () => {
  describe("routeAfterResearchEvaluation", () => {
    it("should route to handleError if research status is error", () => {
      const state = createBasicProposalState();
      state.researchStatus = "error";

      expect(routeAfterResearchEvaluation(state)).toBe("handleError");
    });

    it("should route to handleError if research evaluation is missing", () => {
      const state = createBasicProposalState();
      state.researchEvaluation = undefined;

      expect(routeAfterResearchEvaluation(state)).toBe("handleError");
    });

    it("should route to solutionSought if evaluation passed", () => {
      const state = createBasicProposalState();
      state.researchEvaluation = {
        score: 8,
        passed: true,
        feedback: "Good research",
      };

      expect(routeAfterResearchEvaluation(state)).toBe("solutionSought");
    });

    it("should route to awaitResearchReview if evaluation did not pass", () => {
      const state = createBasicProposalState();
      state.researchEvaluation = {
        score: 4,
        passed: false,
        feedback: "Needs improvements",
      };

      expect(routeAfterResearchEvaluation(state)).toBe("awaitResearchReview");
    });
  });

  describe("routeAfterSolutionEvaluation", () => {
    it("should route to handleError if solution status is error", () => {
      const state = createBasicProposalState();
      state.solutionStatus = "error";

      expect(routeAfterSolutionEvaluation(state)).toBe("handleError");
    });

    it("should route to handleError if solution evaluation is missing", () => {
      const state = createBasicProposalState();
      state.solutionEvaluation = undefined;

      expect(routeAfterSolutionEvaluation(state)).toBe("handleError");
    });

    it("should route to planSections if evaluation passed", () => {
      const state = createBasicProposalState();
      state.solutionEvaluation = {
        score: 8,
        passed: true,
        feedback: "Good solution",
      };

      expect(routeAfterSolutionEvaluation(state)).toBe("planSections");
    });

    it("should route to awaitSolutionReview if evaluation did not pass", () => {
      const state = createBasicProposalState();
      state.solutionEvaluation = {
        score: 4,
        passed: false,
        feedback: "Needs improvements",
      };

      expect(routeAfterSolutionEvaluation(state)).toBe("awaitSolutionReview");
    });
  });

  describe("determineNextSection", () => {
    it("should route to handleError if required sections are not defined", () => {
      const state = createBasicProposalState();
      state.requiredSections = [];

      expect(determineNextSection(state)).toBe("handleError");
    });

    it("should route to generateSection if there are pending sections", () => {
      const state = createBasicProposalState();
      // Sections map is empty by default, so all required sections are pending

      expect(determineNextSection(state)).toBe("generateSection");
    });

    it("should route to awaitSectionReview if sections are awaiting review", () => {
      const state = createBasicProposalState();

      // Add a section that is awaiting review
      state.sections.set(SectionType.PROBLEM_STATEMENT, {
        id: SectionType.PROBLEM_STATEMENT,
        content: "Problem statement content",
        status: "awaiting_review",
        lastUpdated: new Date().toISOString(),
      });

      // Add other sections that are approved
      state.sections.set(SectionType.METHODOLOGY, {
        id: SectionType.METHODOLOGY,
        content: "Methodology content",
        status: "approved",
        lastUpdated: new Date().toISOString(),
      });

      state.sections.set(SectionType.BUDGET, {
        id: SectionType.BUDGET,
        content: "Budget content",
        status: "approved",
        lastUpdated: new Date().toISOString(),
      });

      expect(determineNextSection(state)).toBe("awaitSectionReview");
    });

    it("should route to finalizeProposal if all sections are complete", () => {
      const state = createBasicProposalState();

      // Add all sections as approved
      state.sections.set(SectionType.PROBLEM_STATEMENT, {
        id: SectionType.PROBLEM_STATEMENT,
        content: "Problem statement content",
        status: "approved",
        lastUpdated: new Date().toISOString(),
      });

      state.sections.set(SectionType.METHODOLOGY, {
        id: SectionType.METHODOLOGY,
        content: "Methodology content",
        status: "approved",
        lastUpdated: new Date().toISOString(),
      });

      state.sections.set(SectionType.BUDGET, {
        id: SectionType.BUDGET,
        content: "Budget content",
        status: "approved",
        lastUpdated: new Date().toISOString(),
      });

      expect(determineNextSection(state)).toBe("finalizeProposal");
    });
  });

  describe("routeAfterSectionEvaluation", () => {
    it("should route to handleError if no current section is identified", () => {
      const state = createBasicProposalState();
      state.currentStep = null;

      expect(routeAfterSectionEvaluation(state)).toBe("handleError");
    });

    it("should route to handleError if the current section is not found", () => {
      const state = createBasicProposalState();
      state.currentStep = "section:INVALID_SECTION";

      expect(routeAfterSectionEvaluation(state)).toBe("handleError");
    });

    it("should route to improveSection if section needs revision", () => {
      const state = createBasicProposalState();
      state.currentStep = `section:${SectionType.PROBLEM_STATEMENT}`;

      state.sections.set(SectionType.PROBLEM_STATEMENT, {
        id: SectionType.PROBLEM_STATEMENT,
        content: "Problem statement content",
        status: "needs_revision",
        lastUpdated: new Date().toISOString(),
      });

      expect(routeAfterSectionEvaluation(state)).toBe("improveSection");
    });

    it("should route to submitSectionForReview if section is queued or not started", () => {
      const state = createBasicProposalState();
      state.currentStep = `section:${SectionType.PROBLEM_STATEMENT}`;

      state.sections.set(SectionType.PROBLEM_STATEMENT, {
        id: SectionType.PROBLEM_STATEMENT,
        content: "Problem statement content",
        status: "queued",
        lastUpdated: new Date().toISOString(),
      });

      expect(routeAfterSectionEvaluation(state)).toBe("submitSectionForReview");
    });

    it("should route to submitSectionForReview if section is generating (default case)", () => {
      const state = createBasicProposalState();
      state.currentStep = `section:${SectionType.PROBLEM_STATEMENT}`;

      state.sections.set(SectionType.PROBLEM_STATEMENT, {
        id: SectionType.PROBLEM_STATEMENT,
        content: "Problem statement content",
        status: "generating",
        lastUpdated: new Date().toISOString(),
      });

      expect(routeAfterSectionEvaluation(state)).toBe("submitSectionForReview");
    });
  });

  describe("routeAfterSectionFeedback", () => {
    it("should route to handleError if no current section step", () => {
      const state = createBasicProposalState();
      state.currentStep = null;

      expect(routeAfterSectionFeedback(state)).toBe("handleError");
    });

    it("should route to handleError if current step is not a section", () => {
      const state = createBasicProposalState();
      state.currentStep = "not_a_section_step";

      expect(routeAfterSectionFeedback(state)).toBe("handleError");
    });

    it("should route to handleError if section is not found", () => {
      const state = createBasicProposalState();
      state.currentStep = `section:${SectionType.PROBLEM_STATEMENT}`;
      // No section in the map

      expect(routeAfterSectionFeedback(state)).toBe("handleError");
    });

    it("should route to determineNextSection if section is approved", () => {
      const state = createBasicProposalState();
      state.currentStep = `section:${SectionType.PROBLEM_STATEMENT}`;

      state.sections.set(SectionType.PROBLEM_STATEMENT, {
        id: SectionType.PROBLEM_STATEMENT,
        content: "Problem statement content",
        status: "approved",
        lastUpdated: new Date().toISOString(),
      });

      expect(routeAfterSectionFeedback(state)).toBe("determineNextSection");
    });

    it("should route to generateSection if section needs revision", () => {
      const state = createBasicProposalState();
      state.currentStep = `section:${SectionType.PROBLEM_STATEMENT}`;

      state.sections.set(SectionType.PROBLEM_STATEMENT, {
        id: SectionType.PROBLEM_STATEMENT,
        content: "Problem statement content",
        status: "needs_revision",
        lastUpdated: new Date().toISOString(),
      });

      expect(routeAfterSectionFeedback(state)).toBe("generateSection");
    });

    it("should route to handleError if section has error status", () => {
      const state = createBasicProposalState();
      state.currentStep = `section:${SectionType.PROBLEM_STATEMENT}`;

      state.sections.set(SectionType.PROBLEM_STATEMENT, {
        id: SectionType.PROBLEM_STATEMENT,
        content: "Problem statement content",
        status: "error",
        lastUpdated: new Date().toISOString(),
      });

      expect(routeAfterSectionFeedback(state)).toBe("handleError");
    });

    it("should route to handleError if section has unknown status", () => {
      const state = createBasicProposalState();
      state.currentStep = `section:${SectionType.PROBLEM_STATEMENT}`;

      state.sections.set(SectionType.PROBLEM_STATEMENT, {
        id: SectionType.PROBLEM_STATEMENT,
        content: "Problem statement content",
        status: "generating" as SectionProcessingStatus, // Not handled in the switch
        lastUpdated: new Date().toISOString(),
      });

      expect(routeAfterSectionFeedback(state)).toBe("handleError");
    });
  });

  describe("routeFinalizeProposal", () => {
    it("should route to determineNextSection if any sections are incomplete", () => {
      const state = createBasicProposalState();

      // Add one approved section
      state.sections.set(SectionType.PROBLEM_STATEMENT, {
        id: SectionType.PROBLEM_STATEMENT,
        content: "Problem statement content",
        status: "approved",
        lastUpdated: new Date().toISOString(),
      });

      // Add one section that is not approved
      state.sections.set(SectionType.METHODOLOGY, {
        id: SectionType.METHODOLOGY,
        content: "Methodology content",
        status: "generating",
        lastUpdated: new Date().toISOString(),
      });

      expect(routeFinalizeProposal(state)).toBe("determineNextSection");
    });

    it("should route to completeProposal if all sections are approved", () => {
      const state = createBasicProposalState();

      // Add all sections as approved
      state.sections.set(SectionType.PROBLEM_STATEMENT, {
        id: SectionType.PROBLEM_STATEMENT,
        content: "Problem statement content",
        status: "approved",
        lastUpdated: new Date().toISOString(),
      });

      state.sections.set(SectionType.METHODOLOGY, {
        id: SectionType.METHODOLOGY,
        content: "Methodology content",
        status: "approved",
        lastUpdated: new Date().toISOString(),
      });

      state.sections.set(SectionType.BUDGET, {
        id: SectionType.BUDGET,
        content: "Budget content",
        status: "approved",
        lastUpdated: new Date().toISOString(),
      });

      expect(routeFinalizeProposal(state)).toBe("completeProposal");
    });
  });

  describe("routeAfterResearchReview", () => {
    it("should route to solutionSought if research is approved", () => {
      const state = createBasicProposalState();
      state.researchStatus = "approved";

      expect(routeAfterResearchReview(state)).toBe("solutionSought");
    });

    it("should route to research if research needs revision", () => {
      const state = createBasicProposalState();
      state.researchStatus = "needs_revision";

      expect(routeAfterResearchReview(state)).toBe("research");
    });

    it("should route to handleError for any other research status", () => {
      const state = createBasicProposalState();
      state.researchStatus = "error";

      expect(routeAfterResearchReview(state)).toBe("handleError");
    });
  });

  describe("routeAfterSolutionReview", () => {
    it("should route to planSections if solution is approved", () => {
      const state = createBasicProposalState();
      state.solutionStatus = "approved";

      expect(routeAfterSolutionReview(state)).toBe("planSections");
    });

    it("should route to solutionSought if solution needs revision", () => {
      const state = createBasicProposalState();
      state.solutionStatus = "needs_revision";

      expect(routeAfterSolutionReview(state)).toBe("solutionSought");
    });

    it("should route to handleError for any other solution status", () => {
      const state = createBasicProposalState();
      state.solutionStatus = "error";

      expect(routeAfterSolutionReview(state)).toBe("handleError");
    });
  });

  describe("routeAfterStaleChoice", () => {
    it("should route to generateSection if current section is stale", () => {
      const state = createBasicProposalState();
      state.currentStep = `section:${SectionType.PROBLEM_STATEMENT}`;

      state.sections.set(SectionType.PROBLEM_STATEMENT, {
        id: SectionType.PROBLEM_STATEMENT,
        content: "Problem statement content",
        status: "stale",
        lastUpdated: new Date().toISOString(),
      });

      expect(routeAfterStaleChoice(state)).toBe("generateSection");
    });

    it("should route to research if research is stale", () => {
      const state = createBasicProposalState();
      state.researchStatus = "stale";

      expect(routeAfterStaleChoice(state)).toBe("research");
    });

    it("should route to solutionSought if solution is stale", () => {
      const state = createBasicProposalState();
      state.solutionStatus = "stale";

      expect(routeAfterStaleChoice(state)).toBe("solutionSought");
    });

    it("should route to handleError if no stale content is identified", () => {
      const state = createBasicProposalState();
      // No stale content

      expect(routeAfterStaleChoice(state)).toBe("handleError");
    });
  });

  describe("handleError", () => {
    it("should route to awaitUserInput for all errors", () => {
      const state = createBasicProposalState();
      state.errors.push("Test error");

      expect(handleError(state)).toBe("awaitUserInput");
    });

    it("should log the current step when an error occurs", () => {
      const logSpy = vi.spyOn(console, "log");
      const state = createBasicProposalState();
      state.currentStep = "test-step";
      state.errors.push("Test error");

      handleError(state);

      expect(logSpy).toHaveBeenCalledWith(
        "Error occurred during step: test-step"
      );
    });
  });
});
