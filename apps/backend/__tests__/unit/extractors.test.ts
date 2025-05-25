import { describe, it, expect, vi } from "vitest";
import {
  extractResearchContent,
  extractSolutionContent,
  extractConnectionPairsContent,
  extractSectionContent,
  createSectionExtractor,
  extractProblemStatementContent,
  extractMethodologyContent,
  extractFunderSolutionAlignmentContent,
  validateContent,
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

    it("should extract JSON content from research section", () => {
      // Setup
      const validResearchJSON = {
        sources: [
          { title: "Source 1", url: "https://example.com/1", relevance: 8 },
          { title: "Source 2", url: "https://example.com/2", relevance: 9 },
        ],
        insights: [
          { key: "Key Finding 1", description: "Description 1" },
          { key: "Key Finding 2", description: "Description 2" },
        ],
        summary: "This is a research summary",
      };

      const testState = {
        sections: {
          research: {
            content: JSON.stringify(validResearchJSON),
            status: "awaiting_review",
          },
        },
      } as unknown as OverallProposalState;

      // Execute
      const result = extractResearchContent(testState, "research");

      // Verify
      expect(result).toEqual(validResearchJSON);
      expect(result.sources).toHaveLength(2);
      expect(result.insights).toHaveLength(2);
      expect(result.summary).toBe("This is a research summary");
    });

    it("should handle undefined section", () => {
      // Setup
      const testState = {
        sections: {},
      } as unknown as OverallProposalState;

      // Execute
      const result = extractResearchContent(testState, "research");

      // Verify
      expect(result).toBeNull();
    });

    it("should handle undefined content", () => {
      // Setup
      const testState = {
        sections: {
          research: {
            status: "awaiting_review",
          },
        },
      } as unknown as OverallProposalState;

      // Execute
      const result = extractResearchContent(testState, "research");

      // Verify
      expect(result).toBeNull();
    });

    it("should handle malformed JSON", () => {
      // Setup
      const testState = {
        sections: {
          research: {
            content: "{invalid json",
            status: "awaiting_review",
          },
        },
      } as unknown as OverallProposalState;

      // Execute
      const result = extractResearchContent(testState, "research");

      // Verify
      expect(result).toBeNull();
    });

    it("should handle JSON without required fields", () => {
      // Setup - missing insights field
      const testState = {
        sections: {
          research: {
            content: JSON.stringify({
              sources: [{ title: "Source 1", url: "https://example.com/1" }],
              // Missing insights field
              summary: "This is a research summary",
            }),
            status: "awaiting_review",
          },
        },
      } as unknown as OverallProposalState;

      // Execute
      const result = extractResearchContent(testState, "research");

      // Verify - should still extract the JSON even if fields are missing
      expect(result).toBeDefined();
      expect(result.sources).toHaveLength(1);
      expect(result.insights).toBeUndefined();
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

    it("should extract JSON content from solution section", () => {
      // Setup
      const validSolutionJSON = {
        overview: "Solution overview",
        components: [
          { name: "Component 1", description: "Description 1" },
          { name: "Component 2", description: "Description 2" },
        ],
        architecture: "Architecture description",
        implementation: "Implementation details",
      };

      const testState = {
        sections: {
          solution: {
            content: JSON.stringify(validSolutionJSON),
            status: "awaiting_review",
          },
        },
      } as unknown as OverallProposalState;

      // Execute
      const result = extractSolutionContent(testState, "solution");

      // Verify
      expect(result).toBeDefined();
      expect(result).toEqual(validSolutionJSON);
    });

    it("should handle plain text content", () => {
      // Setup
      const plainText =
        "This is a plain text solution description without JSON formatting";

      const testState = {
        sections: {
          solution: {
            content: plainText,
            status: "awaiting_review",
          },
        },
      } as unknown as OverallProposalState;

      // Execute
      const result = extractSolutionContent(testState, "solution");

      // Verify
      expect(result).toBeDefined();
      expect(result.rawText).toBe(plainText);
    });

    it("should handle markdown content", () => {
      // Setup
      const markdown = `# Solution Heading
      
## Components
- Component 1
- Component 2

## Architecture
Architecture details go here.`;

      const testState = {
        sections: {
          solution: {
            content: markdown,
            status: "awaiting_review",
          },
        },
      } as unknown as OverallProposalState;

      // Execute
      const result = extractSolutionContent(testState, "solution");

      // Verify
      expect(result).toBeDefined();
      expect(result.rawText).toBe(markdown);
    });

    it("should handle undefined section", () => {
      // Setup
      const testState = {
        sections: {},
      } as unknown as OverallProposalState;

      // Execute
      const result = extractSolutionContent(testState, "solution");

      // Verify
      expect(result).toBeNull();
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

  describe("validateContent", () => {
    it("should validate content based on validator type", () => {
      // Setup for isValidJSON validator
      const validJSON = { key: "value" };

      // Execute
      const resultValidJSON = validateContent(validJSON, "isValidJSON");

      // Verify
      expect(resultValidJSON.isValid).toBe(true);
      expect(resultValidJSON.errors).toHaveLength(0);
    });

    it("should validate content with isNotEmpty validator", () => {
      // Setup - Non-empty content
      const nonEmptyContent = "Content";
      const emptyContent = "";

      // Execute
      const resultNonEmpty = validateContent(nonEmptyContent, "isNotEmpty");
      const resultEmpty = validateContent(emptyContent, "isNotEmpty");

      // Verify
      expect(resultNonEmpty.isValid).toBe(true);
      expect(resultNonEmpty.errors).toHaveLength(0);

      expect(resultEmpty.isValid).toBe(false);
      expect(resultEmpty.errors).toHaveLength(1);
      expect(resultEmpty.errors[0]).toBe("Content is empty");
    });

    it("should validate null content", () => {
      // Setup
      const nullContent = null;

      // Execute - with isValidJSON validator
      const resultNullJSON = validateContent(nullContent, "isValidJSON");

      // Execute - with isNotEmpty validator
      const resultNullEmpty = validateContent(nullContent, "isNotEmpty");

      // Verify
      expect(resultNullJSON.isValid).toBe(false);
      expect(resultNullJSON.errors).toHaveLength(1);
      expect(resultNullJSON.errors[0]).toBe("Content is null or undefined");

      expect(resultNullEmpty.isValid).toBe(false);
      expect(resultNullEmpty.errors).toHaveLength(1);
      expect(resultNullEmpty.errors[0]).toBe("Content is null or undefined");
    });

    it("should accept custom validator function", () => {
      // Setup
      const content = { specialField: "value" };
      const customValidator = (content: any) => {
        if (!content || typeof content !== "object" || !content.specialField) {
          return {
            isValid: false,
            errors: ["Content must have specialField"],
          };
        }
        return { isValid: true, errors: [] };
      };

      // Execute
      const resultValid = validateContent(content, customValidator);
      const resultInvalid = validateContent(
        { otherField: "value" },
        customValidator
      );

      // Verify
      expect(resultValid.isValid).toBe(true);
      expect(resultValid.errors).toHaveLength(0);

      expect(resultInvalid.isValid).toBe(false);
      expect(resultInvalid.errors).toHaveLength(1);
      expect(resultInvalid.errors[0]).toBe("Content must have specialField");
    });

    it("should handle unknown validator type", () => {
      // Setup
      const content = "content";

      // Execute with unknown validator
      const result = validateContent(content, "unknownValidator" as any);

      // Verify - should fall back to isNotEmpty
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
