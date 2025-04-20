import { describe, it, expect, vi, beforeEach } from "vitest";
import { problemStatementNode } from "../problem_statement.js";
import {
  OverallProposalState,
  ProcessingStatus,
  SectionType,
  SectionProcessingStatus,
  createInitialState,
} from "@/state/proposal.state.js";
import { z } from "zod";

// Mock the external dependencies
vi.mock("@/lib/logger.js", () => ({
  Logger: {
    getInstance: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

// Mock the language model and prompt components
vi.mock("@langchain/openai", () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        content: "Mocked problem statement content.",
        keyPoints: ["Key point 1", "Key point 2"],
        clientNeeds: ["Need 1", "Need 2"],
        stakeholders: ["Stakeholder 1", "Stakeholder 2"],
      }),
    }),
  })),
}));

vi.mock("@langchain/core/prompts", () => ({
  PromptTemplate: {
    fromTemplate: vi.fn().mockReturnValue({
      invoke: vi.fn().mockResolvedValue("Mocked prompt string"),
    }),
  },
}));

vi.mock("@langchain/core/runnables", () => ({
  RunnableSequence: {
    from: vi.fn().mockImplementation((steps) => ({
      invoke: vi.fn().mockImplementation(async () => {
        return {
          content: "Mocked problem statement content.",
          keyPoints: ["Key point 1", "Key point 2"],
          clientNeeds: ["Need 1", "Need 2"],
          stakeholders: ["Stakeholder 1", "Stakeholder 2"],
        };
      }),
    })),
  },
}));

vi.mock("langchain/output_parsers", () => ({
  StructuredOutputParser: {
    fromZodSchema: vi.fn().mockImplementation(() => ({
      getFormatInstructions: vi.fn().mockReturnValue("format instructions"),
      parse: vi.fn().mockImplementation(async (text) => {
        return {
          content: "Parsed content",
          keyPoints: ["Parsed key point"],
          clientNeeds: ["Parsed need"],
          stakeholders: ["Parsed stakeholder"],
        };
      }),
    })),
  },
}));

describe("Problem Statement Node", () => {
  let baseState: OverallProposalState;

  beforeEach(() => {
    // Reset the state before each test
    baseState = createInitialState("test-thread-123");
    baseState.status = ProcessingStatus.RUNNING;
    baseState.researchStatus = ProcessingStatus.APPROVED;
    baseState.solutionStatus = ProcessingStatus.APPROVED;
    baseState.connectionsStatus = ProcessingStatus.APPROVED;

    // Add sample data needed for generation
    baseState.rfpDocument = {
      id: "test-rfp-doc",
      status: "loaded",
      text: "This is a sample RFP document for testing.",
    };

    baseState.researchResults = {
      key: "value",
      requiresEvaluation: true,
    };

    baseState.connections = [
      { source: "research", target: "solution", type: "supports" },
    ];
  });

  it("should generate a problem statement when none exists", async () => {
    // Set up sections map without a problem statement
    baseState.sections = new Map();

    // Run the problem statement node
    const result = await problemStatementNode(baseState);

    // Verify the problem statement was generated
    expect(result.sections).toBeDefined();
    expect(result.sections?.has(SectionType.PROBLEM_STATEMENT)).toBe(true);

    const section = result.sections?.get(SectionType.PROBLEM_STATEMENT);
    expect(section).toBeDefined();
    expect(section?.status).toBe(SectionProcessingStatus.READY_FOR_EVALUATION);
    expect(section?.content).toBe("Mocked problem statement content.");

    // Verify the next step is set correctly
    expect(result.currentStep).toBe("problem_statement_evaluation");
  });

  it("should skip generation if problem statement exists and is not stale or queued", async () => {
    // Set up sections map with an existing problem statement that is approved
    const existingContent = "Existing problem statement content";
    const sections = new Map();
    sections.set(SectionType.PROBLEM_STATEMENT, {
      id: SectionType.PROBLEM_STATEMENT,
      title: "Problem Statement",
      content: existingContent,
      status: SectionProcessingStatus.APPROVED,
      lastUpdated: new Date().toISOString(),
    });

    baseState.sections = sections;

    // Run the problem statement node
    const result = await problemStatementNode(baseState);

    // Verify the existing problem statement was preserved
    expect(result.sections?.get(SectionType.PROBLEM_STATEMENT)?.content).toBe(
      existingContent
    );
    expect(result.sections?.get(SectionType.PROBLEM_STATEMENT)?.status).toBe(
      SectionProcessingStatus.APPROVED
    );

    // Verify no currentStep update was made
    expect(result.currentStep).toBeUndefined();
  });

  it("should regenerate problem statement if it is queued", async () => {
    // Set up sections map with a queued problem statement
    const sections = new Map();
    sections.set(SectionType.PROBLEM_STATEMENT, {
      id: SectionType.PROBLEM_STATEMENT,
      title: "Problem Statement",
      content: "",
      status: SectionProcessingStatus.QUEUED,
      lastUpdated: new Date().toISOString(),
    });

    baseState.sections = sections;

    // Run the problem statement node
    const result = await problemStatementNode(baseState);

    // Verify the problem statement was regenerated
    expect(result.sections?.get(SectionType.PROBLEM_STATEMENT)?.content).toBe(
      "Mocked problem statement content."
    );
    expect(result.sections?.get(SectionType.PROBLEM_STATEMENT)?.status).toBe(
      SectionProcessingStatus.READY_FOR_EVALUATION
    );
  });

  it("should regenerate problem statement if it is stale", async () => {
    // Set up sections map with a stale problem statement
    const sections = new Map();
    sections.set(SectionType.PROBLEM_STATEMENT, {
      id: SectionType.PROBLEM_STATEMENT,
      title: "Problem Statement",
      content: "Old content",
      status: SectionProcessingStatus.STALE,
      lastUpdated: new Date().toISOString(),
    });

    baseState.sections = sections;

    // Run the problem statement node
    const result = await problemStatementNode(baseState);

    // Verify the problem statement was regenerated
    expect(result.sections?.get(SectionType.PROBLEM_STATEMENT)?.content).toBe(
      "Mocked problem statement content."
    );
    expect(result.sections?.get(SectionType.PROBLEM_STATEMENT)?.status).toBe(
      SectionProcessingStatus.READY_FOR_EVALUATION
    );
  });

  it("should handle errors during generation", async () => {
    // Set up sections map without a problem statement
    baseState.sections = new Map();

    // Mock RunnableSequence to throw an error
    vi.mocked(
      require("@langchain/core/runnables").RunnableSequence.from
    ).mockImplementationOnce(() => ({
      invoke: vi.fn().mockRejectedValue(new Error("Test error")),
    }));

    // Run the problem statement node
    const result = await problemStatementNode(baseState);

    // Verify error handling
    expect(result.sections?.get(SectionType.PROBLEM_STATEMENT)?.status).toBe(
      SectionProcessingStatus.ERROR
    );
    expect(
      result.sections?.get(SectionType.PROBLEM_STATEMENT)?.lastError
    ).toContain("Test error");
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]).toContain(
      "Error generating problem statement: Test error"
    );
  });

  it("should trim large inputs to fit context windows", async () => {
    // Create a large RFP document and research results
    const largeText = "A".repeat(10000);
    baseState.rfpDocument.text = largeText;
    baseState.researchResults = { largeField: largeText };
    baseState.sections = new Map();

    // Create a spy on RunnableSequence.from().invoke()
    const invokeSpy = vi.fn().mockResolvedValue({
      content: "Mocked problem statement content.",
      keyPoints: ["Key point 1"],
      clientNeeds: ["Need 1"],
      stakeholders: ["Stakeholder 1"],
    });

    vi.mocked(
      require("@langchain/core/runnables").RunnableSequence.from
    ).mockImplementationOnce(() => ({
      invoke: invokeSpy,
    }));

    // Run the problem statement node
    await problemStatementNode(baseState);

    // Verify the inputs were trimmed
    const invokeArgs = invokeSpy.mock.calls[0][0];
    expect(invokeArgs.rfpText.length).toBeLessThanOrEqual(8000);
    expect(invokeArgs.researchSummary.length).toBeLessThanOrEqual(3000);
    expect(invokeArgs.connectionPoints.length).toBeLessThanOrEqual(2000);
  });
});
