import { describe, it, expect, vi, beforeEach } from "vitest";
import { sectionManagerNode } from "../section_manager.js";
import {
  OverallProposalState,
  ProcessingStatus,
  SectionType,
  SectionProcessingStatus,
  createInitialState,
} from "@/state/proposal.state.js";

// Mock the logger
vi.mock("@/lib/logger.js", () => ({
  Logger: {
    getInstance: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

describe("Section Manager Node", () => {
  // Create a base state that we'll modify for different test cases
  let baseState: OverallProposalState;

  beforeEach(() => {
    // Reset the state before each test
    baseState = createInitialState("test-thread-123");
    baseState.status = ProcessingStatus.RUNNING;
    baseState.researchStatus = ProcessingStatus.APPROVED;
    baseState.solutionStatus = ProcessingStatus.APPROVED;
    baseState.connectionsStatus = ProcessingStatus.APPROVED;
  });

  it("should initialize sections when none exist", async () => {
    // Run the section manager node
    const result = await sectionManagerNode(baseState);

    // Verify that sections were created
    expect(result.sections).toBeDefined();
    expect(result.sections?.size).toBeGreaterThan(0);
    expect(result.requiredSections).toBeDefined();
    expect(result.requiredSections?.length).toBeGreaterThan(0);

    // Verify that the standard sections are included
    expect(result.sections?.has(SectionType.PROBLEM_STATEMENT)).toBe(true);
    expect(result.sections?.has(SectionType.SOLUTION)).toBe(true);
    expect(result.sections?.has(SectionType.CONCLUSION)).toBe(true);
    expect(result.sections?.has(SectionType.EXECUTIVE_SUMMARY)).toBe(true);

    // Verify that the sections have the correct initial state
    const problemStatement = result.sections?.get(
      SectionType.PROBLEM_STATEMENT
    );
    expect(problemStatement).toBeDefined();
    expect(problemStatement?.status).toBe(SectionProcessingStatus.QUEUED);
    expect(problemStatement?.title).toBe("Problem Statement");
    expect(problemStatement?.content).toBe("");
  });

  it("should preserve existing sections and add new ones", async () => {
    // Add an existing section
    const now = new Date().toISOString();
    const existingContent = "This is existing content";
    const sections = new Map();
    sections.set(SectionType.PROBLEM_STATEMENT, {
      id: SectionType.PROBLEM_STATEMENT,
      title: "Existing Problem Statement",
      content: existingContent,
      status: SectionProcessingStatus.APPROVED,
      lastUpdated: now,
    });

    baseState.sections = sections;

    // Run the section manager node
    const result = await sectionManagerNode(baseState);

    // Verify existing section was preserved
    const problemStatement = result.sections?.get(
      SectionType.PROBLEM_STATEMENT
    );
    expect(problemStatement).toBeDefined();
    expect(problemStatement?.status).toBe(SectionProcessingStatus.APPROVED);
    expect(problemStatement?.title).toBe("Existing Problem Statement");
    expect(problemStatement?.content).toBe(existingContent);

    // Verify new sections were added
    expect(result.sections?.has(SectionType.SOLUTION)).toBe(true);
    expect(result.sections?.has(SectionType.CONCLUSION)).toBe(true);
  });

  it("should respect existing requiredSections if provided", async () => {
    // Set specific required sections
    const customRequiredSections = [
      SectionType.PROBLEM_STATEMENT,
      SectionType.SOLUTION,
      SectionType.CONCLUSION,
    ];

    baseState.requiredSections = customRequiredSections;

    // Run the section manager node
    const result = await sectionManagerNode(baseState);

    // Verify only specified sections are included
    expect(result.requiredSections).toEqual(customRequiredSections);
    expect(result.sections?.size).toBe(customRequiredSections.length);
    expect(result.sections?.has(SectionType.EXECUTIVE_SUMMARY)).toBe(false);
  });

  it("should add evaluation section based on research results", async () => {
    // Add research results indicating evaluation is required
    baseState.researchResults = {
      requiresEvaluation: true,
    };

    // Run the section manager node
    const result = await sectionManagerNode(baseState);

    // Verify evaluation section was added
    expect(result.sections?.has(SectionType.EVALUATION_APPROACH)).toBe(true);
  });

  it("should update the current step and status", async () => {
    // Run the section manager node
    const result = await sectionManagerNode(baseState);

    // Verify state updates
    expect(result.currentStep).toBe("section_generation");
    expect(result.status).toBe(ProcessingStatus.RUNNING);
  });

  it("should handle empty state gracefully", async () => {
    // Create a minimal state with just the required fields
    const minimalState: OverallProposalState = {
      ...baseState,
      sections: new Map(),
      requiredSections: [],
    };

    // Run the section manager node
    const result = await sectionManagerNode(minimalState);

    // Verify basic functionality still works
    expect(result.sections).toBeDefined();
    expect(result.requiredSections).toBeDefined();
    expect(result.currentStep).toBe("section_generation");
  });
});
