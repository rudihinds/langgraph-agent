import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  extractResearchContent,
  extractSolutionContent,
  validateContent,
} from "../extractors.js";
import type { OverallProposalState } from "../../state/proposal.state.js";

// Define test interfaces
interface TestState {
  sections: {
    [key: string]: {
      content?: string;
      status?: string;
    };
  };
}

describe("Content Extractors", () => {
  // Helper function to create a basic test state
  function createTestState(content: string = ""): TestState {
    return {
      sections: {
        research: {
          content,
          status: "generating",
        },
      },
    };
  }

  describe("extractResearchContent", () => {
    it("should extract JSON research content successfully", () => {
      // Setup
      const jsonContent = JSON.stringify({
        sources: [
          { title: "Source 1", url: "https://example.com/1", relevance: 10 },
          { title: "Source 2", url: "https://example.com/2", relevance: 8 },
        ],
        insights: [
          { key: "Insight 1", description: "Description 1", sources: [0, 1] },
          { key: "Insight 2", description: "Description 2", sources: [1] },
        ],
      });

      const testState = createTestState(
        jsonContent
      ) as unknown as OverallProposalState;

      // Execute
      const result = extractResearchContent(testState, "research");

      // Verify
      expect(result).toBeDefined();
      expect(result.sources).toHaveLength(2);
      expect(result.insights).toHaveLength(2);
      expect(result.sources[0].title).toBe("Source 1");
      expect(result.insights[0].key).toBe("Insight 1");
    });

    it("should return null for undefined section", () => {
      // Setup
      const testState = createTestState() as unknown as OverallProposalState;

      // Execute
      const result = extractResearchContent(testState, "nonexistent");

      // Verify
      expect(result).toBeNull();
    });

    it("should return null for undefined content", () => {
      // Setup
      const testState = {
        sections: {
          research: {
            status: "generating",
            // content is undefined
          },
        },
      } as unknown as OverallProposalState;

      // Execute
      const result = extractResearchContent(testState, "research");

      // Verify
      expect(result).toBeNull();
    });

    it("should return null for empty content", () => {
      // Setup
      const testState = createTestState("") as unknown as OverallProposalState;

      // Execute
      const result = extractResearchContent(testState, "research");

      // Verify
      expect(result).toBeNull();
    });

    it("should handle malformed JSON content", () => {
      // Setup
      const testState = createTestState(
        "{invalid json"
      ) as unknown as OverallProposalState;

      // Execute
      const result = extractResearchContent(testState, "research");

      // Verify
      expect(result).toBeNull();
    });

    it("should handle JSON with missing required fields", () => {
      // Setup - missing 'insights' field
      const jsonContent = JSON.stringify({
        sources: [
          { title: "Source 1", url: "https://example.com/1", relevance: 10 },
        ],
        // missing insights field
      });

      const testState = createTestState(
        jsonContent
      ) as unknown as OverallProposalState;

      // Execute
      const result = extractResearchContent(testState, "research");

      // Verify - should still extract what's available
      expect(result).toBeDefined();
      expect(result.sources).toHaveLength(1);
      expect(result.insights).toBeUndefined();
    });
  });

  describe("extractSolutionContent", () => {
    it("should extract solution content successfully", () => {
      // Setup
      const solutionContent = JSON.stringify({
        problemStatement: "Problem statement",
        proposedSolution: "Proposed solution",
        benefits: ["Benefit 1", "Benefit 2"],
        implementation: {
          phases: [{ name: "Phase 1", description: "Description 1" }],
        },
      });

      const testState = {
        sections: {
          solution: {
            content: solutionContent,
            status: "generating",
          },
        },
      } as unknown as OverallProposalState;

      // Execute
      const result = extractSolutionContent(testState, "solution");

      // Verify
      expect(result).toBeDefined();
      expect(result.problemStatement).toBe("Problem statement");
      expect(result.proposedSolution).toBe("Proposed solution");
      expect(result.benefits).toHaveLength(2);
      expect(result.implementation.phases).toHaveLength(1);
    });

    it("should return null for undefined section", () => {
      // Setup
      const testState = {
        sections: {},
      } as unknown as OverallProposalState;

      // Execute
      const result = extractSolutionContent(testState, "nonexistent");

      // Verify
      expect(result).toBeNull();
    });

    it("should handle text-based solution content", () => {
      // Setup - plain text instead of JSON
      const textContent = "This is a plain text solution description.";

      const testState = {
        sections: {
          solution: {
            content: textContent,
            status: "generating",
          },
        },
      } as unknown as OverallProposalState;

      // Execute
      const result = extractSolutionContent(testState, "solution");

      // Verify
      expect(result).toBeDefined();
      expect(result.rawText).toBe(textContent);
    });

    it("should handle structured text solution content (markdown)", () => {
      // Setup - markdown text
      const markdownContent =
        "# Solution\n\n## Problem Statement\nThe problem is...\n\n## Proposed Solution\nWe propose...";

      const testState = {
        sections: {
          solution: {
            content: markdownContent,
            status: "generating",
          },
        },
      } as unknown as OverallProposalState;

      // Execute
      const result = extractSolutionContent(testState, "solution");

      // Verify
      expect(result).toBeDefined();
      expect(result.rawText).toBe(markdownContent);
      // Verify markdown parsing if implemented
    });
  });

  describe("validateContent", () => {
    it("should validate JSON content successfully", () => {
      // Setup
      const jsonContent = JSON.stringify({
        key1: "value1",
        key2: "value2",
      });

      // Execute
      const result = validateContent(jsonContent, "isValidJSON");

      // Verify
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect invalid JSON content", () => {
      // Setup
      const invalidJsonContent = '{key1: "value1", key2:}';

      // Execute
      const result = validateContent(invalidJsonContent, "isValidJSON");

      // Verify
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should validate non-empty content", () => {
      // Setup
      const content = "This is not empty";

      // Execute
      const result = validateContent(content, "isNotEmpty");

      // Verify
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect empty content", () => {
      // Setup
      const emptyContent = "";

      // Execute
      const result = validateContent(emptyContent, "isNotEmpty");

      // Verify
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should handle custom validator functions", () => {
      // Setup
      const content = "Contains required word: important";
      const customValidator = (content: string) => {
        return {
          isValid: content.includes("important"),
          errors: content.includes("important")
            ? []
            : ['Content must include the word "important"'],
        };
      };

      // Execute
      const result = validateContent(content, customValidator);

      // Verify
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle invalid custom validator functions", () => {
      // Setup
      const content = "Does not contain required word";
      const customValidator = (content: string) => {
        return {
          isValid: content.includes("important"),
          errors: content.includes("important")
            ? []
            : ['Content must include the word "important"'],
        };
      };

      // Execute
      const result = validateContent(content, customValidator);

      // Verify
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Content must include the word "important"'
      );
    });

    it("should handle unknown validator names gracefully", () => {
      // Setup
      const content = "Some content";

      // Execute
      const result = validateContent(content, "unknownValidator");

      // Verify - should default to valid since we don't know how to validate
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
