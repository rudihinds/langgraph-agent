import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DependencyService } from "../DependencyService.js";
import { SectionType } from "../../state/modules/constants.js";
import * as fs from "fs/promises";
import * as path from "path";

// Mock fs and path modules
const fsMock = vi.hoisted(() => ({
  readFile: vi.fn(),
}));

const pathMock = vi.hoisted(() => ({
  resolve: vi.fn(),
}));

// Mock logger
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
}));

// Apply mocks
vi.mock("fs/promises", () => fsMock);
vi.mock("path", () => pathMock);
vi.mock("../../lib/logger/index.js", () => ({
  logger: loggerMock,
}));

describe("DependencyService", () => {
  // Sample dependency map JSON for testing
  const mockDependencyMap = {
    problem_statement: [],
    solution: ["problem_statement"],
    implementation_plan: ["solution"],
    budget: ["solution", "implementation_plan"],
    executive_summary: [
      "problem_statement",
      "solution",
      "implementation_plan",
      "budget",
    ],
  };

  beforeEach(() => {
    // Set up path.resolve to return a consistent test path
    pathMock.resolve.mockReturnValue("/test/path/dependencies.json");

    // Set up fs.readFile to return our mock dependency map
    fsMock.readFile.mockResolvedValue(JSON.stringify(mockDependencyMap));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should load the dependency map on initialization", async () => {
    const dependencyService = new DependencyService();

    // Allow async initialization to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(pathMock.resolve).toHaveBeenCalled();
    expect(fsMock.readFile).toHaveBeenCalledWith(
      "/test/path/dependencies.json",
      "utf8"
    );
  });

  it("should correctly identify direct dependents of a section", async () => {
    const dependencyService = new DependencyService();

    // Allow async initialization to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    const problemDependents = dependencyService.getDependentsOf(
      SectionType.PROBLEM_STATEMENT
    );
    expect(problemDependents).toContain(SectionType.SOLUTION);
    expect(problemDependents).toContain(SectionType.EXECUTIVE_SUMMARY);
    expect(problemDependents.length).toBe(2);

    const solutionDependents = dependencyService.getDependentsOf(
      SectionType.SOLUTION
    );
    expect(solutionDependents).toContain(SectionType.IMPLEMENTATION_PLAN);
    expect(solutionDependents).toContain(SectionType.BUDGET);
    expect(solutionDependents).toContain(SectionType.EXECUTIVE_SUMMARY);
    expect(solutionDependents.length).toBe(3);
  });

  it("should correctly identify direct dependencies of a section", async () => {
    const dependencyService = new DependencyService();

    // Allow async initialization to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    const problemDependencies = dependencyService.getDependenciesOf(
      SectionType.PROBLEM_STATEMENT
    );
    expect(problemDependencies.length).toBe(0);

    const budgetDependencies = dependencyService.getDependenciesOf(
      SectionType.BUDGET
    );
    expect(budgetDependencies).toContain(SectionType.SOLUTION);
    expect(budgetDependencies).toContain(SectionType.IMPLEMENTATION_PLAN);
    expect(budgetDependencies.length).toBe(2);
  });

  it("should find all dependents (direct and indirect)", async () => {
    const dependencyService = new DependencyService();

    // Allow async initialization to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    const allProblemDependents = dependencyService.getAllDependents(
      SectionType.PROBLEM_STATEMENT
    );

    // All sections in this test depend directly or indirectly on problem_statement
    // except problem_statement itself
    expect(allProblemDependents).toContain(SectionType.SOLUTION);
    expect(allProblemDependents).toContain(SectionType.IMPLEMENTATION_PLAN);
    expect(allProblemDependents).toContain(SectionType.BUDGET);
    expect(allProblemDependents).toContain(SectionType.EXECUTIVE_SUMMARY);
    expect(allProblemDependents.length).toBe(4);
  });

  it("should determine if one section depends on another", async () => {
    const dependencyService = new DependencyService();

    // Allow async initialization to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Direct dependency
    expect(
      dependencyService.isDependencyOf(
        SectionType.PROBLEM_STATEMENT,
        SectionType.SOLUTION
      )
    ).toBe(true);

    // Indirect dependency
    expect(
      dependencyService.isDependencyOf(
        SectionType.PROBLEM_STATEMENT,
        SectionType.BUDGET
      )
    ).toBe(true);

    // No dependency
    expect(
      dependencyService.isDependencyOf(
        SectionType.BUDGET,
        SectionType.PROBLEM_STATEMENT
      )
    ).toBe(false);
  });

  it("should return sections in dependency order", async () => {
    const dependencyService = new DependencyService();

    // Allow async initialization to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    const orderedSections = dependencyService.getSectionsInDependencyOrder();

    // Verify that dependencies come before their dependents
    // For example, problem_statement index < solution index
    const problemIndex = orderedSections.indexOf(SectionType.PROBLEM_STATEMENT);
    const solutionIndex = orderedSections.indexOf(SectionType.SOLUTION);
    const implIndex = orderedSections.indexOf(SectionType.IMPLEMENTATION_PLAN);
    const budgetIndex = orderedSections.indexOf(SectionType.BUDGET);
    const summaryIndex = orderedSections.indexOf(SectionType.EXECUTIVE_SUMMARY);

    expect(problemIndex).toBeLessThan(solutionIndex);
    expect(solutionIndex).toBeLessThan(implIndex);
    expect(implIndex).toBeLessThan(budgetIndex);
    expect(budgetIndex).toBeLessThan(summaryIndex);
  });

  it("should handle errors when loading the dependency map", async () => {
    // Simulate a file read error
    fsMock.readFile.mockRejectedValueOnce(new Error("File not found"));

    // The constructor should throw an error when the file can't be loaded
    await expect(async () => {
      const service = new DependencyService();
      // Force the async initialization to complete and throw
      await new Promise((resolve) => setTimeout(resolve, 0));
    }).rejects.toThrow("Failed to load dependency map");
  });
});
