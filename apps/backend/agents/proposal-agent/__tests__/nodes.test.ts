import { describe, it, expect } from "vitest";
import {
  evaluateResearchNode,
  evaluateSolutionNode,
  evaluateSectionNode,
  evaluateConnectionsNode,
  processFeedbackNode,
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

describe("processFeedbackNode", () => {
  it("should handle research approval correctly", async () => {
    // Set up initial state with feedback for research approval
    const initialState: Partial<OverallProposalState> = {
      errors: [],
      messages: [],
      sections: new Map(),
      status: "running",
      userFeedback: {
        type: "approve",
        comments: "Research looks good",
        timestamp: new Date().toISOString(),
      },
      interruptStatus: {
        isInterrupted: true,
        interruptionPoint: "evaluateResearch",
        feedback: null,
        processingStatus: "pending",
      },
      interruptMetadata: {
        reason: "EVALUATION_NEEDED",
        nodeId: "evaluateResearchNode",
        timestamp: new Date().toISOString(),
        contentReference: "research",
        evaluationResult: {
          passed: true,
          score: 8,
          feedback: "Good research",
        },
      },
    };

    // Call the node
    const result = await processFeedbackNode(
      initialState as OverallProposalState
    );

    // Verify research status is updated
    expect(result.researchStatus).toBe("approved");

    // Verify interrupt status is cleared
    expect(result.interruptStatus).toBeDefined();
    expect(result.interruptStatus?.isInterrupted).toBe(false);
    expect(result.interruptStatus?.interruptionPoint).toBeNull();
    expect(result.interruptStatus?.feedback).toBeNull();
    expect(result.interruptStatus?.processingStatus).toBeNull();

    // Verify interrupt metadata is cleared
    expect(result.interruptMetadata).toBeUndefined();
  });

  it("should handle solution revision correctly", async () => {
    // Set up initial state with feedback for solution revision
    const initialState: Partial<OverallProposalState> = {
      errors: [],
      messages: [],
      sections: new Map(),
      status: "running",
      userFeedback: {
        type: "revise",
        comments: "Solution needs to be more specific",
        timestamp: new Date().toISOString(),
      },
      interruptStatus: {
        isInterrupted: true,
        interruptionPoint: "evaluateSolution",
        feedback: null,
        processingStatus: "pending",
      },
      interruptMetadata: {
        reason: "EVALUATION_NEEDED",
        nodeId: "evaluateSolutionNode",
        timestamp: new Date().toISOString(),
        contentReference: "solution",
        evaluationResult: {
          passed: true,
          score: 6,
          feedback: "Solution needs improvement",
        },
      },
    };

    // Call the node
    const result = await processFeedbackNode(
      initialState as OverallProposalState
    );

    // Verify solution status is updated
    expect(result.solutionStatus).toBe("edited");

    // Verify revision instructions are set
    expect(result.revisionInstructions).toBe(
      "Solution needs to be more specific"
    );

    // Verify interrupt status is cleared
    expect(result.interruptStatus).toBeDefined();
    expect(result.interruptStatus?.isInterrupted).toBe(false);
    expect(result.interruptStatus?.interruptionPoint).toBeNull();
    expect(result.interruptStatus?.feedback).toBeNull();
    expect(result.interruptStatus?.processingStatus).toBeNull();

    // Verify interrupt metadata is cleared
    expect(result.interruptMetadata).toBeUndefined();
  });

  it("should handle section regeneration correctly", async () => {
    const sectionType = SectionType.PROBLEM_STATEMENT;

    // Create a map with the section
    const sectionsMap = new Map();
    sectionsMap.set(sectionType, {
      id: sectionType,
      content: "Original problem statement content",
      status: "awaiting_review",
      lastUpdated: new Date().toISOString(),
    });

    // Set up initial state with feedback for section regeneration
    const initialState: Partial<OverallProposalState> = {
      errors: [],
      messages: [],
      sections: sectionsMap,
      status: "running",
      userFeedback: {
        type: "regenerate",
        comments: "Please rewrite this section completely",
        timestamp: new Date().toISOString(),
      },
      interruptStatus: {
        isInterrupted: true,
        interruptionPoint: `evaluateSection:${sectionType}`,
        feedback: null,
        processingStatus: "pending",
      },
      interruptMetadata: {
        reason: "EVALUATION_NEEDED",
        nodeId: "evaluateSectionNode",
        timestamp: new Date().toISOString(),
        contentReference: sectionType,
        evaluationResult: {
          passed: false,
          score: 3,
          feedback: "Section needs to be rewritten",
        },
      },
    };

    // Call the node
    const result = await processFeedbackNode(
      initialState as OverallProposalState
    );

    // Verify section status is updated in the sections map
    expect(result.sections).toBeDefined();
    const updatedSectionMap = result.sections as Map<SectionType, any>;
    const updatedSection = updatedSectionMap.get(sectionType);
    expect(updatedSection).toBeDefined();
    expect(updatedSection.status).toBe("stale");
    expect(updatedSection.regenerationInstructions).toBe(
      "Please rewrite this section completely"
    );

    // Verify messages are updated with user feedback
    expect(result.messages).toBeDefined();
    expect(result.messages?.length).toBeGreaterThan(0);

    // Verify interrupt status is cleared
    expect(result.interruptStatus).toBeDefined();
    expect(result.interruptStatus?.isInterrupted).toBe(false);
    expect(result.interruptStatus?.interruptionPoint).toBeNull();
    expect(result.interruptStatus?.feedback).toBeNull();
    expect(result.interruptStatus?.processingStatus).toBeNull();

    // Verify interrupt metadata is cleared
    expect(result.interruptMetadata).toBeUndefined();
  });

  it("should handle missing user feedback", async () => {
    // Set up initial state without user feedback
    const initialState: Partial<OverallProposalState> = {
      errors: [],
      messages: [],
      sections: new Map(),
      status: "running",
      // No userFeedback
      interruptStatus: {
        isInterrupted: true,
        interruptionPoint: "evaluateResearch",
        feedback: null,
        processingStatus: "pending",
      },
    };

    // Call the node
    const result = await processFeedbackNode(
      initialState as OverallProposalState
    );

    // Verify error is added
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBe(1);
    expect(result.errors?.[0].nodeId).toBe("processFeedbackNode");
    expect(result.errors?.[0].message).toContain("No user feedback found");

    // Verify state is not updated otherwise
    expect(result.interruptStatus).toBeUndefined();
    expect(result.researchStatus).toBeUndefined();
    expect(result.solutionStatus).toBeUndefined();
  });

  it("should handle unknown content reference", async () => {
    // Set up initial state with feedback for unknown content
    const initialState: Partial<OverallProposalState> = {
      errors: [],
      messages: [],
      sections: new Map(),
      status: "running",
      userFeedback: {
        type: "approve",
        comments: "Looks good",
        timestamp: new Date().toISOString(),
      },
      interruptStatus: {
        isInterrupted: true,
        interruptionPoint: "evaluateUnknown",
        feedback: null,
        processingStatus: "pending",
      },
      interruptMetadata: {
        reason: "EVALUATION_NEEDED",
        nodeId: "evaluateUnknownNode",
        timestamp: new Date().toISOString(),
        contentReference: "unknown",
        evaluationResult: {
          passed: true,
          score: 8,
          feedback: "Good content",
        },
      },
    };

    // Call the node
    const result = await processFeedbackNode(
      initialState as OverallProposalState
    );

    // Verify error is added
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBe(1);
    expect(result.errors?.[0].nodeId).toBe("processFeedbackNode");
    expect(result.errors?.[0].message).toContain("Unknown content reference");

    // Verify interrupt status is updated to error
    expect(result.interruptStatus).toBeDefined();
    expect(result.interruptStatus?.isInterrupted).toBe(false);
  });
});
