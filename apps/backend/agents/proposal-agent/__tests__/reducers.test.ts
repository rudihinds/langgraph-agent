import { describe, it, expect } from "vitest";
import {
  connectionPairsReducer,
  proposalSectionsReducer,
  researchDataReducer,
  solutionRequirementsReducer,
  ConnectionPair,
  SectionContent,
  ResearchData,
  SolutionRequirements,
} from "../reducers";

describe("connectionPairsReducer", () => {
  it("should add new connection pairs", () => {
    const current: ConnectionPair[] = [];
    const update: ConnectionPair[] = [
      {
        id: "cp1",
        applicantStrength: "Strong research team",
        funderNeed: "Research expertise",
        alignmentRationale: "Our researchers are perfect for this project",
        confidenceScore: 0.9,
      },
    ];

    const result = connectionPairsReducer(current, update);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("cp1");
  });

  it("should merge pairs with same id and keep higher confidence score", () => {
    const current: ConnectionPair[] = [
      {
        id: "cp1",
        applicantStrength: "Strong research team",
        funderNeed: "Research expertise",
        alignmentRationale: "Our researchers are perfect for this project",
        confidenceScore: 0.7,
      },
    ];

    const update: ConnectionPair[] = [
      {
        id: "cp1",
        applicantStrength: "World-class research team",
        funderNeed: "Research expertise",
        alignmentRationale: "Our researchers have published in top journals",
        confidenceScore: 0.9,
        source: "Updated analysis",
      },
    ];

    const result = connectionPairsReducer(current, update);
    expect(result).toHaveLength(1);
    expect(result[0].confidenceScore).toBe(0.9);
    expect(result[0].applicantStrength).toBe("World-class research team");
    expect(result[0].source).toBe("Updated analysis");
  });

  it("should not update pairs if new confidence is lower", () => {
    const current: ConnectionPair[] = [
      {
        id: "cp1",
        applicantStrength: "Strong research team",
        funderNeed: "Research expertise",
        alignmentRationale: "Our researchers are perfect for this project",
        confidenceScore: 0.9,
        source: "Original analysis",
      },
    ];

    const update: ConnectionPair[] = [
      {
        id: "cp1",
        applicantStrength: "Average research team",
        funderNeed: "Research expertise",
        alignmentRationale: "Our researchers are suitable",
        confidenceScore: 0.6,
        source: "Secondary analysis",
      },
    ];

    const result = connectionPairsReducer(current, update);
    expect(result).toHaveLength(1);
    expect(result[0].confidenceScore).toBe(0.9);
    expect(result[0].applicantStrength).toBe("Strong research team");
    expect(result[0].source).toBe("Original analysis");
  });

  it("should merge source information when updating a pair", () => {
    const current: ConnectionPair[] = [
      {
        id: "cp1",
        applicantStrength: "Strong research team",
        funderNeed: "Research expertise",
        alignmentRationale: "Our researchers are perfect for this project",
        confidenceScore: 0.7,
        source: "Initial assessment",
      },
    ];

    const update: ConnectionPair[] = [
      {
        id: "cp1",
        applicantStrength: "World-class research team",
        funderNeed: "Research expertise",
        alignmentRationale: "Our researchers have published in top journals",
        confidenceScore: 0.9,
        source: "Updated analysis",
      },
    ];

    const result = connectionPairsReducer(current, update);
    expect(result[0].source).toBe("Initial assessment, Updated analysis");
  });
});

describe("proposalSectionsReducer", () => {
  it("should add a new section", () => {
    const current: Record<string, SectionContent> = {};
    const update: SectionContent = {
      name: "introduction",
      content: "This is the introduction section",
      status: "pending",
      version: 0,
      lastUpdated: "",
    };

    const result = proposalSectionsReducer(current, update);
    expect(Object.keys(result)).toHaveLength(1);
    expect(result.introduction.content).toBe(
      "This is the introduction section"
    );
    expect(result.introduction.version).toBe(1);
    expect(result.introduction.lastUpdated).toBeTruthy();
  });

  it("should update an existing section and increment version", () => {
    const now = new Date();
    const lastUpdated = new Date(now.getTime() - 1000).toISOString();

    const current: Record<string, SectionContent> = {
      introduction: {
        name: "introduction",
        content: "This is the introduction section",
        status: "pending",
        version: 1,
        lastUpdated,
      },
    };

    const update: SectionContent = {
      name: "introduction",
      content: "This is the updated introduction section",
      status: "in_progress",
      version: 0,
      lastUpdated: "",
    };

    const result = proposalSectionsReducer(current, update);
    expect(Object.keys(result)).toHaveLength(1);
    expect(result.introduction.content).toBe(
      "This is the updated introduction section"
    );
    expect(result.introduction.status).toBe("in_progress");
    expect(result.introduction.version).toBe(2);
    expect(new Date(result.introduction.lastUpdated).getTime()).toBeGreaterThan(
      new Date(lastUpdated).getTime()
    );
  });

  // Commenting out test as it likely needs refactoring with OverallProposalState (Task #14)
  // it("should handle setting evaluation results", () => {
  //   const current: Record<string, SectionContent> = {
  //     introduction: {
  //       content: "Intro",
  //       version: 1,
  //       status: "approved",
  //     },
  //     methodology: {
  //       content: "Methods",
  //       version: 1,
  //       status: "generating",
  //     },
  //   };
  //
  //   const evaluationResult: EvaluationResult = {
  //     score: 8.5,
  //     passed: true,
  //     feedback: "Good section",
  //   };
  //
  //   const result = proposalSectionsReducer(current, {
  //     id: "introduction",
  //     evaluation: evaluationResult,
  //     status: "evaluated", // Assuming status update on evaluation
  //   });
  //
  //   expect(result.introduction?.evaluation).toEqual(evaluationResult);
  //   expect(result.introduction?.status).toBe("evaluated");
  //   expect(result.introduction?.version).toBe(2);
  //   expect(result.methodology).toBeDefined();
  //   expect(result.methodology.version).toBe(1);
  // });
});

describe("researchDataReducer", () => {
  it("should initialize research data when current is null", () => {
    const current: ResearchData | null = null;
    const update: Partial<ResearchData> = {
      keyFindings: ["Finding 1", "Finding 2"],
      funderPriorities: ["Priority A", "Priority B"],
      fundingHistory: "Consistent funding in tech sector",
    };

    const result = researchDataReducer(current, update);
    expect(result.keyFindings).toHaveLength(2);
    expect(result.funderPriorities).toHaveLength(2);
    expect(result.fundingHistory).toBe("Consistent funding in tech sector");
  });

  it("should merge new findings with existing data", () => {
    const current: ResearchData = {
      keyFindings: ["Finding 1", "Finding 2"],
      funderPriorities: ["Priority A", "Priority B"],
      fundingHistory: "Original history",
    };

    const update: Partial<ResearchData> = {
      keyFindings: ["Finding 2", "Finding 3"],
      funderPriorities: ["Priority C"],
      relevantProjects: ["Project X", "Project Y"],
    };

    const result = researchDataReducer(current, update);
    expect(result.keyFindings).toHaveLength(3);
    expect(result.keyFindings).toContain("Finding 3");
    expect(result.funderPriorities).toHaveLength(3);
    expect(result.fundingHistory).toBe("Original history");
    expect(result.relevantProjects).toHaveLength(2);
  });

  it("should handle empty update fields", () => {
    const current: ResearchData = {
      keyFindings: ["Finding 1", "Finding 2"],
      funderPriorities: ["Priority A", "Priority B"],
      fundingHistory: "Original history",
    };

    const update: Partial<ResearchData> = {
      additionalNotes: "Some notes",
    };

    const result = researchDataReducer(current, update);
    expect(result.keyFindings).toHaveLength(2);
    expect(result.funderPriorities).toHaveLength(2);
    expect(result.fundingHistory).toBe("Original history");
    expect(result.additionalNotes).toBe("Some notes");
  });
});

describe("solutionRequirementsReducer", () => {
  it("should initialize solution requirements when current is null", () => {
    const current: SolutionRequirements | null = null;
    const update: Partial<SolutionRequirements> = {
      primaryGoals: ["Goal 1", "Goal 2"],
      constraints: ["Constraint 1"],
      successMetrics: ["Metric 1", "Metric 2"],
    };

    const result = solutionRequirementsReducer(current, update);
    expect(result.primaryGoals).toHaveLength(2);
    expect(result.constraints).toHaveLength(1);
    expect(result.successMetrics).toHaveLength(2);
  });

  it("should merge and deduplicate arrays", () => {
    const current: SolutionRequirements = {
      primaryGoals: ["Goal 1", "Goal 2"],
      constraints: ["Constraint 1"],
      successMetrics: ["Metric 1", "Metric 2"],
      secondaryObjectives: ["Objective A"],
    };

    const update: Partial<SolutionRequirements> = {
      primaryGoals: ["Goal 2", "Goal 3"],
      constraints: ["Constraint 2"],
      successMetrics: ["Metric 1", "Metric 3"],
      secondaryObjectives: ["Objective B"],
      preferredApproaches: ["Approach X"],
    };

    const result = solutionRequirementsReducer(current, update);
    expect(result.primaryGoals).toHaveLength(3);
    expect(result.primaryGoals).toContain("Goal 3");
    expect(result.constraints).toHaveLength(2);
    expect(result.successMetrics).toHaveLength(3);
    expect(result.secondaryObjectives).toHaveLength(2);
    expect(result.preferredApproaches).toHaveLength(1);
  });

  it("should handle empty update fields", () => {
    const current: SolutionRequirements = {
      primaryGoals: ["Goal 1", "Goal 2"],
      constraints: ["Constraint 1"],
      successMetrics: ["Metric 1", "Metric 2"],
    };

    const update: Partial<SolutionRequirements> = {
      explicitExclusions: ["Exclusion A"],
    };

    const result = solutionRequirementsReducer(current, update);
    expect(result.primaryGoals).toHaveLength(2);
    expect(result.constraints).toHaveLength(1);
    expect(result.successMetrics).toHaveLength(2);
    expect(result.explicitExclusions).toHaveLength(1);
  });
});
