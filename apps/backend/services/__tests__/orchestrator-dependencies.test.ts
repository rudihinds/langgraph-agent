import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OrchestratorService, AnyStateGraph } from "../orchestrator.service.js";
import { DependencyService } from "../DependencyService.js";
import {
  SectionType,
  SectionStatus,
  ProcessingStatus,
  LoadingStatus,
} from "../../state/modules/constants.js";
import { OverallProposalState } from "../../state/modules/types.js";
import { BaseCheckpointSaver } from "@langchain/langgraph";

// Mock the DependencyService
vi.mock("../DependencyService.js");

// Mock the logger
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  setLogLevel: vi.fn(),
  getInstance: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    setLogLevel: vi.fn(),
  }),
}));

vi.mock("../../lib/logger.js", () => ({
  Logger: loggerMock,
  LogLevel: { INFO: "info" },
}));

// Mock checkpointer with all required methods from BaseCheckpointSaver
const checkpointerMock = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  list: vi.fn().mockResolvedValue([]),
  delete: vi.fn(),
  putWrites: vi.fn(),
  getNextVersion: vi.fn().mockResolvedValue(1),
  getTuple: vi.fn(),
  serde: {
    serialize: vi.fn((x) => JSON.stringify(x)),
    deserialize: vi.fn((x) => JSON.parse(x)),
  },
}));

// Mock StateGraph
const graphMock = vi.hoisted(() => ({
  // Add any graph methods that might be called
  invoke: vi.fn(),
  batch: vi.fn(),
  stream: vi.fn(),
  streamLog: vi.fn(),
})) as unknown as AnyStateGraph;

// Create a mock state factory function
function createMockState(): OverallProposalState {
  // Create sections map
  const sectionsMap = new Map();
  sectionsMap.set(SectionType.PROBLEM_STATEMENT, {
    id: "1",
    content: "Problem Statement Content",
    status: SectionStatus.APPROVED,
    lastUpdated: new Date().toISOString(),
  });

  sectionsMap.set(SectionType.SOLUTION, {
    id: "2",
    content: "Solution Content",
    status: SectionStatus.APPROVED,
    lastUpdated: new Date().toISOString(),
  });

  sectionsMap.set(SectionType.EVALUATION_PLAN, {
    id: "3",
    content: "Implementation Plan Content",
    status: SectionStatus.APPROVED,
    lastUpdated: new Date().toISOString(),
  });

  return {
    rfpDocument: {
      id: "doc-1",
      status: LoadingStatus.LOADED,
    },
    researchStatus: ProcessingStatus.COMPLETE,
    solutionStatus: ProcessingStatus.COMPLETE,
    connectionsStatus: ProcessingStatus.COMPLETE,
    sections: sectionsMap,
    requiredSections: [
      SectionType.PROBLEM_STATEMENT,
      SectionType.SOLUTION,
      SectionType.EVALUATION_PLAN,
    ],
    interruptStatus: {
      isInterrupted: false,
      interruptionPoint: null,
      feedback: null,
      processingStatus: null,
    },
    currentStep: null,
    activeThreadId: "thread-1",
    messages: [],
    errors: [],
    createdAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    status: ProcessingStatus.RUNNING,
  };
}

describe("OrchestratorService Dependency Chain", () => {
  let orchestratorService: OrchestratorService;
  let mockDependencyService: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Configure the dependency service mock
    mockDependencyService = {
      getDependentsOf: vi.fn(),
      getAllDependents: vi.fn(),
      getDependenciesOf: vi.fn(),
      loadDependencyMap: vi.fn(),
    };

    // Configure DependencyService mock constructor
    (DependencyService as any).mockImplementation(() => mockDependencyService);

    // Configure checkpointer mock
    checkpointerMock.get.mockImplementation(({ configurable }) => {
      const state = createMockState();
      return {
        id: configurable.thread_id,
        channel_values: state,
      };
    });

    // Create orchestrator service instance
    orchestratorService = new OrchestratorService(
      graphMock,
      checkpointerMock as unknown as BaseCheckpointSaver
    );
  });

  // Dummy test to ensure the test suite runs
  it("should run a dummy test", () => {
    expect(true).toBe(true);
  });

  it("should mark dependent sections as stale when a section is edited", async () => {
    // Set up mock dependents for PROBLEM_STATEMENT
    const dependents = [SectionType.SOLUTION, SectionType.EVALUATION_PLAN];
    mockDependencyService.getAllDependents.mockReturnValue(dependents);

    // Set up initial state
    const initialState = createMockState();

    // Call the method
    const updatedState = await orchestratorService.markDependentSectionsAsStale(
      initialState,
      SectionType.PROBLEM_STATEMENT
    );

    // Verify the dependency service was called with the right section
    expect(mockDependencyService.getAllDependents).toHaveBeenCalledWith(
      SectionType.PROBLEM_STATEMENT
    );

    // Verify dependent sections are now marked as stale
    expect(updatedState.sections.get(SectionType.SOLUTION)?.status).toBe(
      SectionStatus.STALE
    );
    expect(updatedState.sections.get(SectionType.EVALUATION_PLAN)?.status).toBe(
      SectionStatus.STALE
    );

    // Verify previous status was saved
    expect(
      updatedState.sections.get(SectionType.SOLUTION)?.previousStatus
    ).toBe(SectionStatus.APPROVED);

    // Verify checkpointer was called to save the state
    expect(checkpointerMock.put).toHaveBeenCalled();
  });

  it("should keep the original state when no dependent sections are found", async () => {
    // No dependents for the edited section
    mockDependencyService.getAllDependents.mockReturnValue([]);

    // Set up initial state
    const initialState = createMockState();

    // Call the method
    const updatedState = await orchestratorService.markDependentSectionsAsStale(
      initialState,
      SectionType.PROBLEM_STATEMENT
    );

    // State should remain unchanged
    expect(updatedState).toBe(initialState);

    // Verify the dependency service was called
    expect(mockDependencyService.getAllDependents).toHaveBeenCalledWith(
      SectionType.PROBLEM_STATEMENT
    );

    // Checkpointer should not have been called
    expect(checkpointerMock.put).not.toHaveBeenCalled();
  });

  it("should properly handle keep decision for stale sections", async () => {
    // Set up initial state with a stale section
    const threadId = "thread-1";
    const mockState = createMockState();

    // Make one section stale
    const staleSection = mockState.sections.get(SectionType.SOLUTION);
    if (staleSection) {
      staleSection.status = SectionStatus.STALE;
      staleSection.previousStatus = SectionStatus.APPROVED;
      mockState.sections.set(SectionType.SOLUTION, staleSection);
    }

    checkpointerMock.get.mockReturnValueOnce({
      id: threadId,
      channel_values: mockState,
    });

    // Call the method with "keep" decision
    const updatedState = await orchestratorService.handleStaleDecision(
      threadId,
      SectionType.SOLUTION,
      "keep"
    );

    // Verify section status was restored
    const updatedSection = updatedState.sections.get(SectionType.SOLUTION);
    expect(updatedSection?.status).toBe(SectionStatus.APPROVED);
    expect(updatedSection?.previousStatus).toBeUndefined();

    // Verify state was saved
    expect(checkpointerMock.put).toHaveBeenCalled();
  });

  it("should properly handle regenerate decision for stale sections", async () => {
    // Set up initial state with a stale section
    const threadId = "thread-1";
    const mockState = createMockState();

    // Make one section stale
    const staleSection = mockState.sections.get(SectionType.SOLUTION);
    if (staleSection) {
      staleSection.status = SectionStatus.STALE;
      staleSection.previousStatus = SectionStatus.APPROVED;
      mockState.sections.set(SectionType.SOLUTION, staleSection);
    }

    checkpointerMock.get.mockReturnValueOnce({
      id: threadId,
      channel_values: mockState,
    });

    // Call the method with "regenerate" decision and guidance
    const guidance = "Please improve the solution section";
    const updatedState = await orchestratorService.handleStaleDecision(
      threadId,
      SectionType.SOLUTION,
      "regenerate",
      guidance
    );

    // Verify section status was changed to queued
    const updatedSection = updatedState.sections.get(SectionType.SOLUTION);
    expect(updatedSection?.status).toBe(SectionStatus.QUEUED);
    expect(updatedSection?.previousStatus).toBeUndefined();

    // Verify guidance message was added
    expect(updatedState.messages.length).toBe(1);

    // The message should contain our guidance text
    const guidanceMessage = updatedState.messages[0];
    expect(guidanceMessage.content).toBe(guidance);
    expect(guidanceMessage.additional_kwargs.type).toBe(
      "regeneration_guidance"
    );

    // Verify state was saved
    expect(checkpointerMock.put).toHaveBeenCalled();
  });

  it("should throw an error when handling a non-stale section", async () => {
    // Set up initial state with an approved section (non-stale)
    const threadId = "thread-1";
    checkpointerMock.get.mockReturnValueOnce({
      id: threadId,
      channel_values: createMockState(),
    });

    // Call should throw error
    await expect(
      orchestratorService.handleStaleDecision(
        threadId,
        SectionType.SOLUTION,
        "keep"
      )
    ).rejects.toThrow(/Cannot handle stale decision for non-stale section/);
  });

  it("should handle section editing and mark dependents as stale", async () => {
    // Set up dependencies
    const dependents = [SectionType.EVALUATION_PLAN];
    mockDependencyService.getAllDependents.mockReturnValue(dependents);

    const threadId = "thread-1";
    const newContent = "Updated solution content";

    // Call the handleSectionEdit method
    const updatedState = await orchestratorService.handleSectionEdit(
      threadId,
      SectionType.SOLUTION,
      newContent
    );

    // Verify the edited section was updated
    const editedSection = updatedState.sections.get(SectionType.SOLUTION);
    expect(editedSection?.content).toBe(newContent);
    expect(editedSection?.status).toBe(SectionStatus.EDITED);

    // Verify dependent sections were marked as stale
    const dependentSection = updatedState.sections.get(
      SectionType.EVALUATION_PLAN
    );
    expect(dependentSection?.status).toBe(SectionStatus.STALE);

    // Verify state was saved twice (once for edit, once for marking dependents)
    expect(checkpointerMock.put).toHaveBeenCalledTimes(2);
  });

  it("should retrieve all stale sections", async () => {
    // Set up initial state with stale sections
    const threadId = "thread-1";
    const mockState = createMockState();

    // Make two sections stale
    const solution = mockState.sections.get(SectionType.SOLUTION);
    if (solution) {
      solution.status = SectionStatus.STALE;
      mockState.sections.set(SectionType.SOLUTION, solution);
    }

    const implementation = mockState.sections.get(SectionType.EVALUATION_PLAN);
    if (implementation) {
      implementation.status = SectionStatus.STALE;
      mockState.sections.set(SectionType.EVALUATION_PLAN, implementation);
    }

    checkpointerMock.get.mockReturnValueOnce({
      id: threadId,
      channel_values: mockState,
    });

    // Get stale sections
    const staleSections = await orchestratorService.getStaleSections(threadId);

    // Verify correct sections are returned
    expect(staleSections).toContain(SectionType.SOLUTION);
    expect(staleSections).toContain(SectionType.EVALUATION_PLAN);
    expect(staleSections).not.toContain(SectionType.PROBLEM_STATEMENT);
    expect(staleSections.length).toBe(2);
  });
});
