import { describe, it, expect } from "vitest";
import {
  evaluateResearchNode,
  evaluateSolutionNode,
  evaluateSectionNode,
  evaluateConnectionsNode,
} from "../nodes";
import { SectionType } from "../../../state/modules/types";
import { OverallProposalState } from "../../../state/modules/types";

describe("evaluateResearchNode", () => {
  it("should set interrupt metadata and status correctly", async () => {
    // Set up initial state with research results
    const initialState: Partial<OverallProposalState> = {
      researchResults: {
        funderAnalysis: "Sample funder analysis",
        priorities: ["Priority 1", "Priority 2"],
        evaluationCriteria: ["Criteria 1", "Criteria 2"],
        requirements: "Sample requirements",
      },
      researchStatus: "completed",
      errors: [],
      messages: [],
      sections: new Map(),
      status: "running",
    };

    // Call the node
    const result = await evaluateResearchNode(
      initialState as OverallProposalState
    );

    // Verify interrupt status
    expect(result.interruptStatus).toBeDefined();
    expect(result.interruptStatus?.isInterrupted).toBe(true);
    expect(result.interruptStatus?.interruptionPoint).toBe("evaluateResearch");
    expect(result.interruptStatus?.feedback).toBeNull();
    expect(result.interruptStatus?.processingStatus).toBe("pending");

    // Verify interrupt metadata
    expect(result.interruptMetadata).toBeDefined();
    expect(result.interruptMetadata?.reason).toBe("EVALUATION_NEEDED");
    expect(result.interruptMetadata?.nodeId).toBe("evaluateResearchNode");
    expect(result.interruptMetadata?.contentReference).toBe("research");
    expect(result.interruptMetadata?.timestamp).toBeDefined();
    expect(typeof result.interruptMetadata?.timestamp).toBe("string");

    // Verify evaluation result is included in metadata
    expect(result.interruptMetadata?.evaluationResult).toBeDefined();
    expect(result.interruptMetadata?.evaluationResult.passed).toBeDefined();

    // Verify research status is set properly
    expect(result.researchStatus).toBe("awaiting_review");
  });

  it("should handle missing research results", async () => {
    // Set up initial state without research results
    const initialState: Partial<OverallProposalState> = {
      researchStatus: "error",
      errors: [],
      messages: [],
      sections: new Map(),
      status: "running",
    };

    // Call the node
    const result = await evaluateResearchNode(
      initialState as OverallProposalState
    );

    // Verify error is added and no interrupt is set
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBe(1);
    expect(result.researchStatus).toBe("error");
    expect(result.interruptStatus).toBeUndefined();
    expect(result.interruptMetadata).toBeUndefined();
  });
});

describe("evaluateSolutionNode", () => {
  it("should set interrupt metadata and status correctly", async () => {
    // Set up initial state
    const initialState: Partial<OverallProposalState> = {
      solutionResults: {
        approachSummary: "Sample solution approach",
        targetUsers: ["User type 1", "User type 2"],
        keyBenefits: ["Benefit 1", "Benefit 2"],
      },
      researchResults: {
        funderAnalysis: "Sample funder analysis",
      },
      solutionStatus: "completed",
      errors: [],
      messages: [],
      sections: new Map(),
      status: "running",
    };

    // Call the node
    const result = await evaluateSolutionNode(
      initialState as OverallProposalState
    );

    // Verify interrupt status
    expect(result.interruptStatus).toBeDefined();
    expect(result.interruptStatus?.isInterrupted).toBe(true);
    expect(result.interruptStatus?.interruptionPoint).toBe("evaluateSolution");
    expect(result.interruptStatus?.feedback).toBeNull();
    expect(result.interruptStatus?.processingStatus).toBe("pending");

    // Verify interrupt metadata
    expect(result.interruptMetadata).toBeDefined();
    expect(result.interruptMetadata?.reason).toBe("EVALUATION_NEEDED");
    expect(result.interruptMetadata?.nodeId).toBe("evaluateSolutionNode");
    expect(result.interruptMetadata?.contentReference).toBe("solution");
    expect(result.interruptMetadata?.timestamp).toBeDefined();

    // Verify evaluation result is included in metadata
    expect(result.interruptMetadata?.evaluationResult).toBeDefined();
    expect(result.interruptMetadata?.evaluationResult.passed).toBeDefined();

    // Verify solution status is set properly
    expect(result.solutionStatus).toBe("awaiting_review");
    expect(result.status).toBe("awaiting_review");
  });
});

describe("evaluateSectionNode", () => {
  it("should set interrupt metadata and status correctly for a section", async () => {
    // Set up section to evaluate
    const sectionType = SectionType.PROBLEM_STATEMENT;
    const sectionContent =
      "This is sample content for the problem statement section.";

    // Create a map with the section
    const sectionsMap = new Map();
    sectionsMap.set(sectionType, {
      id: sectionType,
      content: sectionContent,
      status: "generating",
      lastUpdated: new Date().toISOString(),
    });

    // Set up initial state
    const initialState: Partial<OverallProposalState> = {
      currentStep: `section:${sectionType}`,
      sections: sectionsMap,
      errors: [],
      messages: [],
      status: "running",
    };

    // Call the node
    const result = await evaluateSectionNode(
      initialState as OverallProposalState
    );

    // Verify interrupt status
    expect(result.interruptStatus).toBeDefined();
    expect(result.interruptStatus?.isInterrupted).toBe(true);
    expect(result.interruptStatus?.interruptionPoint).toBe(
      `evaluateSection:${sectionType}`
    );
    expect(result.interruptStatus?.feedback).toBeNull();
    expect(result.interruptStatus?.processingStatus).toBe("pending");

    // Verify interrupt metadata
    expect(result.interruptMetadata).toBeDefined();
    expect(result.interruptMetadata?.reason).toBe("EVALUATION_NEEDED");
    expect(result.interruptMetadata?.nodeId).toBe("evaluateSectionNode");
    expect(result.interruptMetadata?.contentReference).toBe(sectionType);
    expect(result.interruptMetadata?.timestamp).toBeDefined();

    // Verify evaluation result is included in metadata
    expect(result.interruptMetadata?.evaluationResult).toBeDefined();
    expect(result.interruptMetadata?.evaluationResult.passed).toBeDefined();

    // Verify section status is updated in the sections map
    expect(result.sections).toBeDefined();
    const updatedSection = result.sections?.get(sectionType);
    expect(updatedSection?.status).toBe("awaiting_review");
    expect(updatedSection?.evaluation).toBeDefined();

    // Verify overall status is set properly
    expect(result.status).toBe("awaiting_review");
  });

  it("should handle missing section in state", async () => {
    // Set up initial state with invalid currentStep
    const initialState: Partial<OverallProposalState> = {
      currentStep: "section:NONEXISTENT_SECTION",
      sections: new Map(),
      errors: [],
      status: "running",
    };

    // Call the node
    const result = await evaluateSectionNode(
      initialState as OverallProposalState
    );

    // Verify error is added and no interrupt is set
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBe(1);
    expect(result.interruptStatus).toBeUndefined();
    expect(result.interruptMetadata).toBeUndefined();
  });

  it("should handle missing currentStep", async () => {
    // Set up initial state without currentStep
    const initialState: Partial<OverallProposalState> = {
      sections: new Map(),
      errors: [],
      status: "running",
    };

    // Call the node
    const result = await evaluateSectionNode(
      initialState as OverallProposalState
    );

    // Verify error is added and no interrupt is set
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBe(1);
    expect(result.interruptStatus).toBeUndefined();
    expect(result.interruptMetadata).toBeUndefined();
  });
});

describe("evaluateConnectionsNode", () => {
  it("should set interrupt metadata and status correctly", async () => {
    // Set up initial state with connections
    const initialState: Partial<OverallProposalState> = {
      connections: [
        "Funder prioritizes education access, applicant has expertise in digital learning platforms",
        "Funder seeks climate solutions, applicant has developed sustainable energy technologies",
        "Funder values community impact, applicant has strong local partnerships",
      ],
      connectionsStatus: "completed",
      errors: [],
      messages: [],
      sections: new Map(),
      status: "running",
    };

    // Call the node
    const result = await evaluateConnectionsNode(
      initialState as OverallProposalState
    );

    // Verify interrupt status
    expect(result.interruptStatus).toBeDefined();
    expect(result.interruptStatus?.isInterrupted).toBe(true);
    expect(result.interruptStatus?.interruptionPoint).toBe(
      "evaluateConnections"
    );
    expect(result.interruptStatus?.feedback).toBeNull();
    expect(result.interruptStatus?.processingStatus).toBe("pending");

    // Verify interrupt metadata
    expect(result.interruptMetadata).toBeDefined();
    expect(result.interruptMetadata?.reason).toBe("EVALUATION_NEEDED");
    expect(result.interruptMetadata?.nodeId).toBe("evaluateConnectionsNode");
    expect(result.interruptMetadata?.contentReference).toBe("connections");
    expect(result.interruptMetadata?.timestamp).toBeDefined();

    // Verify evaluation result is included in metadata
    expect(result.interruptMetadata?.evaluationResult).toBeDefined();
    expect(result.interruptMetadata?.evaluationResult.passed).toBeDefined();

    // Verify connections status is set properly
    expect(result.connectionsStatus).toBe("awaiting_review");
    expect(result.status).toBe("awaiting_review");
  });

  it("should handle missing connections", async () => {
    // Set up initial state without connections
    const initialState: Partial<OverallProposalState> = {
      connectionsStatus: "error",
      errors: [],
      messages: [],
      sections: new Map(),
      status: "running",
    };

    // Call the node
    const result = await evaluateConnectionsNode(
      initialState as OverallProposalState
    );

    // Verify error is added and no interrupt is set
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBe(1);
    expect(result.connectionsStatus).toBe("error");
    expect(result.interruptStatus).toBeUndefined();
    expect(result.interruptMetadata).toBeUndefined();
  });
});
