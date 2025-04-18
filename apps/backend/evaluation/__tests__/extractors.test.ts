import { describe, it, expect } from "vitest";
import {
  extractResearchContent,
  extractSolutionContent,
  extractConnectionPairsContent,
  extractSectionContent,
  createSectionExtractor,
  extractProblemStatementContent,
  extractMethodologyContent,
  extractFunderSolutionAlignmentContent,
} from "../extractors.js";
import {
  OverallProposalState,
  SectionType,
} from "../../state/proposal.state.js";

// Create a mock state builder
function createMockState(
  overrides: Partial<OverallProposalState> = {}
): OverallProposalState {
  return {
    rfpDocument: {
      id: "mock-rfp",
      status: "loaded",
    },
    researchStatus: "complete",
    solutionSoughtStatus: "complete",
    connectionPairsStatus: "complete",
    sections: {},
    requiredSections: [],
    interruptStatus: {
      isInterrupted: false,
      interruptionPoint: null,
      feedback: null,
      processingStatus: null,
    },
    currentStep: null,
    activeThreadId: "mock-thread",
    messages: [],
    errors: [],
    createdAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    status: "running",
    ...overrides,
  } as unknown as OverallProposalState;
}

describe("Content Extractors", () => {
  describe("extractResearchContent", () => {
    it("should return null for missing research results", () => {
      const state = createMockState();
      const content = extractResearchContent(state);
      expect(content).toBeNull();
    });

    it("should return null for empty research results", () => {
      const state = createMockState({
        researchResults: {},
      });
      const content = extractResearchContent(state);
      expect(content).toBeNull();
    });

    it("should extract valid research results", () => {
      const mockResearch = {
        findings: [
          {
            topic: "Market Analysis",
            content: "The market is growing rapidly...",
          },
          {
            topic: "Competitor Analysis",
            content: "Main competitors include...",
          },
        ],
        summary: "Overall research indicates positive prospects...",
        additionalInfo: "Some extra information...",
      };

      const state = createMockState({
        researchResults: mockResearch,
      });

      const content = extractResearchContent(state);
      expect(content).toEqual(mockResearch);
    });

    it("should extract research results with warnings for missing keys", () => {
      // Mock console.warn to capture warnings
      const originalWarn = console.warn;
      const mockWarn = vi.fn();
      console.warn = mockWarn;

      try {
        const incompleteResearch = {
          findings: [
            {
              topic: "Market Analysis",
              content: "The market is growing rapidly...",
            },
          ],
          // Missing summary
        };

        const state = createMockState({
          researchResults: incompleteResearch,
        });

        const content = extractResearchContent(state);

        // Should still extract the content despite missing keys
        expect(content).toEqual(incompleteResearch);

        // Should have logged a warning
        expect(mockWarn).toHaveBeenCalledWith(
          expect.stringContaining("summary")
        );
      } finally {
        // Restore console.warn
        console.warn = originalWarn;
      }
    });
  });

  describe("extractSolutionContent", () => {
    it("should return null for missing solution results", () => {
      const state = createMockState();
      const content = extractSolutionContent(state);
      expect(content).toBeNull();
    });

    it("should return null for empty solution results", () => {
      const state = createMockState({
        solutionSoughtResults: {},
      });
      const content = extractSolutionContent(state);
      expect(content).toBeNull();
    });

    it("should extract valid solution results", () => {
      const mockSolution = {
        description: "A comprehensive solution that addresses...",
        keyComponents: ["Component A", "Component B", "Component C"],
        benefits: ["Benefit 1", "Benefit 2"],
      };

      const state = createMockState({
        solutionSoughtResults: mockSolution,
      });

      const content = extractSolutionContent(state);
      expect(content).toEqual(mockSolution);
    });
  });

  describe("extractConnectionPairsContent", () => {
    it("should return null for missing connection pairs", () => {
      const state = createMockState();
      const content = extractConnectionPairsContent(state);
      expect(content).toBeNull();
    });

    it("should return null for empty connection pairs array", () => {
      const state = createMockState({
        connectionPairs: [],
      });
      const content = extractConnectionPairsContent(state);
      expect(content).toBeNull();
    });

    it("should extract valid connection pairs", () => {
      const mockPairs = [
        {
          problem: "High customer acquisition cost",
          solution: "Implement referral program",
        },
        {
          problem: "Poor user retention",
          solution: "Enhance onboarding experience",
        },
      ];

      const state = createMockState({
        connectionPairs: mockPairs,
      });

      const content = extractConnectionPairsContent(state);
      expect(content).toEqual(mockPairs);
    });

    it("should filter out invalid connection pairs", () => {
      const mockPairs = [
        {
          problem: "High customer acquisition cost",
          solution: "Implement referral program",
        },
        {
          // Missing problem
          solution: "Enhance onboarding experience",
        },
        {
          problem: "Security vulnerabilities",
          // Missing solution
        },
      ];

      const state = createMockState({
        connectionPairs: mockPairs,
      });

      const content = extractConnectionPairsContent(state);

      // Should only contain the first valid pair
      expect(content).toHaveLength(1);
      expect(content[0]).toEqual(mockPairs[0]);
    });
  });

  describe("extractSectionContent", () => {
    it("should return null for missing section", () => {
      const state = createMockState();
      const content = extractSectionContent(
        state,
        SectionType.PROBLEM_STATEMENT
      );
      expect(content).toBeNull();
    });

    it("should return null for empty section content", () => {
      const state = createMockState({
        sections: {
          [SectionType.PROBLEM_STATEMENT]: {
            id: SectionType.PROBLEM_STATEMENT,
            content: "",
            status: "complete",
          },
        },
      });

      const content = extractSectionContent(
        state,
        SectionType.PROBLEM_STATEMENT
      );
      expect(content).toBeNull();
    });

    it("should extract valid section content", () => {
      const mockContent = "This is the problem statement content...";

      const state = createMockState({
        sections: {
          [SectionType.PROBLEM_STATEMENT]: {
            id: SectionType.PROBLEM_STATEMENT,
            content: mockContent,
            status: "complete",
          },
        },
      });

      const content = extractSectionContent(
        state,
        SectionType.PROBLEM_STATEMENT
      );
      expect(content).toBe(mockContent);
    });
  });

  describe("createSectionExtractor", () => {
    it("should create an extractor function for a specific section", () => {
      const mockContent = "This is the methodology content...";

      const state = createMockState({
        sections: {
          [SectionType.METHODOLOGY]: {
            id: SectionType.METHODOLOGY,
            content: mockContent,
            status: "complete",
          },
        },
      });

      const methodologyExtractor = createSectionExtractor(
        SectionType.METHODOLOGY
      );
      expect(typeof methodologyExtractor).toBe("function");

      const content = methodologyExtractor(state);
      expect(content).toBe(mockContent);
    });
  });

  describe("Predefined Section Extractors", () => {
    it("should extract problem statement content", () => {
      const mockContent = "This is the problem statement content...";

      const state = createMockState({
        sections: {
          [SectionType.PROBLEM_STATEMENT]: {
            id: SectionType.PROBLEM_STATEMENT,
            content: mockContent,
            status: "complete",
          },
        },
      });

      const content = extractProblemStatementContent(state);
      expect(content).toBe(mockContent);
    });

    it("should extract methodology content", () => {
      const mockContent = "This is the methodology content...";

      const state = createMockState({
        sections: {
          [SectionType.METHODOLOGY]: {
            id: SectionType.METHODOLOGY,
            content: mockContent,
            status: "complete",
          },
        },
      });

      const content = extractMethodologyContent(state);
      expect(content).toBe(mockContent);
    });
  });

  describe("extractFunderSolutionAlignmentContent", () => {
    it("should return null when missing research results", () => {
      const state = createMockState({
        solutionSoughtResults: {
          description: "A solution",
          keyComponents: ["Component A"],
        },
      });
      const content = extractFunderSolutionAlignmentContent(state);
      expect(content).toBeNull();
    });

    it("should return null when missing solution results", () => {
      const state = createMockState({
        researchResults: {
          "Author/Organization Deep Dive": "Some research",
        },
      });
      const content = extractFunderSolutionAlignmentContent(state);
      expect(content).toBeNull();
    });

    it("should return null when both are empty objects", () => {
      const state = createMockState({
        researchResults: {},
        solutionSoughtResults: {},
      });
      const content = extractFunderSolutionAlignmentContent(state);
      expect(content).toBeNull();
    });

    it("should extract and combine solution and research content", () => {
      const mockSolution = {
        description: "A comprehensive solution",
        keyComponents: ["Component A", "Component B"],
      };

      const mockResearch = {
        "Author/Organization Deep Dive": {
          "Company Background": "Organization history...",
          "Key Individuals": "Leadership team...",
        },
        "Structural & Contextual Analysis": {
          "RFP Tone & Style": "Formal and structured...",
        },
      };

      const state = createMockState({
        solutionSoughtResults: mockSolution,
        researchResults: mockResearch,
      });

      const content = extractFunderSolutionAlignmentContent(state);

      expect(content).toEqual({
        solution: mockSolution,
        research: mockResearch,
      });
    });

    it("should extract content with warnings for missing recommended keys", () => {
      // Mock console.warn to capture warnings
      const originalWarn = console.warn;
      const mockWarn = vi.fn();
      console.warn = mockWarn;

      try {
        const mockSolution = {
          // Missing description
          keyComponents: ["Component A"],
        };

        const mockResearch = {
          // Missing recommended research sections
          "Other Section": "Content",
        };

        const state = createMockState({
          solutionSoughtResults: mockSolution,
          researchResults: mockResearch,
        });

        const content = extractFunderSolutionAlignmentContent(state);

        // Should still extract the content despite missing keys
        expect(content).toEqual({
          solution: mockSolution,
          research: mockResearch,
        });

        // Should have logged warnings
        expect(mockWarn).toHaveBeenCalledTimes(2);
        expect(mockWarn).toHaveBeenCalledWith(
          expect.stringContaining("description")
        );
        expect(mockWarn).toHaveBeenCalledWith(
          expect.stringContaining("Author/Organization Deep Dive")
        );
      } finally {
        // Restore console.warn
        console.warn = originalWarn;
      }
    });
  });
});
