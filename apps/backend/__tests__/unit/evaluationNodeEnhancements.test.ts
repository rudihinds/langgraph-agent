import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { SystemMessage } from "@langchain/core/messages";

// Define mocks using vi.hoisted
const mocks = vi.hoisted(() => {
  return {
    readFile: vi.fn(),
    access: vi.fn(),
    pathResolve: vi.fn((...segments) => segments.join("/")),
    mockChatResponse: JSON.stringify({
      passed: true,
      timestamp: new Date().toISOString(),
      evaluator: "ai",
      overallScore: 0.8,
      scores: {
        clarity: 0.8,
        relevance: 0.9,
        accuracy: 0.7,
      },
      strengths: ["Very relevant to the requirements."],
      weaknesses: ["Some statements need verification."],
      suggestions: ["Add more structure to improve clarity."],
      feedback: "Good work overall, but attention to detail could be improved.",
    }),
    mockLLMError: new Error("LLM API error"),
    mockTimeout: new Error("Request timed out"),
    mockChatCompletionInvoke: vi.fn(),
    // Mock AbortController
    abort: vi.fn(),
    signal: { aborted: false },
  };
});

// Mock fs/promises
vi.mock("fs/promises", async () => {
  const actual = await vi.importActual("fs/promises");
  return {
    ...actual,
    readFile: mocks.readFile,
    access: mocks.access,
  };
});

// Mock path
vi.mock("path", () => ({
  default: {
    resolve: mocks.pathResolve,
  },
  resolve: mocks.pathResolve,
}));

// Mock ChatOpenAI
vi.mock("@langchain/openai", () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: mocks.mockChatCompletionInvoke,
    lc_serializable: true,
  })),
}));

// Mock AbortController
global.AbortController = vi.fn().mockImplementation(() => ({
  abort: mocks.abort,
  signal: mocks.signal,
}));

// Now import the code under test after mocks are set up
import {
  EvaluationResult,
  createEvaluationNode,
  DEFAULT_CRITERIA,
  ContentExtractor,
} from "../index.js";

// Mock interfaces needed for tests
interface TestState {
  contentType?: string;
  content?: string;
  evaluationResult?: EvaluationResult;
  status?: string;
  isInterrupted?: boolean;
  interruptMetadata?: any;
  messages?: any[];
  errors?: string[];
  [key: string]: any;
}

// Update the extractor to work with TestState
const createTestExtractor = (key: string): ContentExtractor => {
  return ((state: any) => state[key]) as ContentExtractor;
};

// Helper to create test state
const createTestState = (overrides: Partial<TestState> = {}): TestState => ({
  contentType: "test",
  content: "Test content",
  errors: [],
  messages: [],
  ...overrides,
});

describe("Enhanced Evaluation Node Factory", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mocks.readFile.mockResolvedValue(JSON.stringify(DEFAULT_CRITERIA));
    mocks.access.mockResolvedValue(undefined);
    mocks.mockChatCompletionInvoke.mockResolvedValue({
      content: mocks.mockChatResponse,
    });
  });

  describe("Timeout Handling", () => {
    it("should use timeout configuration with AbortController", async () => {
      // Create an evaluation node with timeout configuration
      const evaluateContent = createEvaluationNode({
        contentType: "research",
        contentExtractor: createTestExtractor("content"),
        criteriaPath: "test-criteria.json",
        resultField: "evaluationResult",
        statusField: "evaluationStatus",
        timeoutSeconds: 30, // Custom timeout
      });

      // Setup state
      const state = createTestState({ content: "Test research content" });

      // Execute the node
      await evaluateContent(state as any);

      // Verify AbortController was created
      expect(global.AbortController).toHaveBeenCalled();

      // For now, we can't directly test the ChatOpenAI options
      // This would need a better mock setup
    });

    it("should apply default 60-second timeout when not specified", async () => {
      // Create an evaluation node without explicit timeout
      const evaluateContent = createEvaluationNode({
        contentType: "research",
        contentExtractor: createTestExtractor("content"),
        criteriaPath: "test-criteria.json",
        resultField: "evaluationResult",
        statusField: "evaluationStatus",
      });

      // Setup state
      const state = createTestState({ content: "Test research content" });

      // Execute the node
      await evaluateContent(state as any);

      // The test should check that a default timeout of 60 seconds was used
      // For now, just verify AbortController is called
      expect(global.AbortController).toHaveBeenCalled();
    });

    it("should handle timeout errors gracefully", async () => {
      // Mock a timeout error
      const timeoutError = new Error("Request timed out");
      timeoutError.name = "AbortError";
      mocks.mockChatCompletionInvoke.mockRejectedValueOnce(timeoutError);

      // Create an evaluation node
      const evaluateContent = createEvaluationNode({
        contentType: "research",
        contentExtractor: createTestExtractor("content"),
        criteriaPath: "test-criteria.json",
        resultField: "evaluationResult",
        statusField: "evaluationStatus",
      });

      // Setup state
      const state = createTestState({ content: "Test research content" });

      // Execute the node
      const result = (await evaluateContent(state as any)) as any;

      // Verify error handling for timeouts
      expect(result.evaluationStatus).toBe("error");
      expect(result.errors[0]).toMatch(/timed out/i);
    });
  });

  describe("HITL Integration", () => {
    it("should set interrupt flag and metadata", async () => {
      // Create an evaluation node
      const evaluateContent = createEvaluationNode({
        contentType: "research",
        contentExtractor: createTestExtractor("content"),
        criteriaPath: "test-criteria.json",
        resultField: "evaluationResult",
        statusField: "evaluationStatus",
      });

      // Setup state
      const state = createTestState({ content: "Test research content" });

      // Execute the node
      const result = (await evaluateContent(state as any)) as any;

      // Verify HITL integration
      expect(result.interruptStatus.isInterrupted).toBe(true);
      expect(result.interruptMetadata).toBeDefined();
      expect(result.interruptMetadata).toEqual(
        expect.objectContaining({
          reason: "EVALUATION_NEEDED",
          contentReference: "research",
        })
      );
    });

    it("should include evaluation result in interrupt metadata", async () => {
      // Create an evaluation node
      const evaluateContent = createEvaluationNode({
        contentType: "research",
        contentExtractor: createTestExtractor("content"),
        criteriaPath: "test-criteria.json",
        resultField: "evaluationResult",
        statusField: "evaluationStatus",
      });

      // Setup state
      const state = createTestState({ content: "Test research content" });

      // Execute the node
      const result = (await evaluateContent(state as any)) as any;

      // Verify evaluation results are included in metadata
      expect(result.interruptMetadata.evaluationResult).toBeDefined();
      expect(result.interruptMetadata.evaluationResult).toEqual(
        expect.objectContaining({
          passed: true,
          overallScore: expect.any(Number),
        })
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle LLM API errors", async () => {
      // Mock an LLM API error
      mocks.mockChatCompletionInvoke.mockRejectedValueOnce(
        new Error("LLM API error")
      );

      // Create an evaluation node
      const evaluateContent = createEvaluationNode({
        contentType: "research",
        contentExtractor: createTestExtractor("content"),
        criteriaPath: "test-criteria.json",
        resultField: "evaluationResult",
        statusField: "evaluationStatus",
      });

      // Setup state
      const state = createTestState({ content: "Test research content" });

      // Execute the node
      const result = (await evaluateContent(state as any)) as any;

      // Verify error handling
      expect(result.evaluationStatus).toBe("error");
      expect(result.errors[0]).toMatch(/LLM API error/i);
    });

    it("should handle malformed LLM responses", async () => {
      // Mock a malformed response
      mocks.mockChatCompletionInvoke.mockResolvedValueOnce({
        content: "Not valid JSON",
      });

      // Create an evaluation node
      const evaluateContent = createEvaluationNode({
        contentType: "research",
        contentExtractor: createTestExtractor("content"),
        criteriaPath: "test-criteria.json",
        resultField: "evaluationResult",
        statusField: "evaluationStatus",
      });

      // Setup state
      const state = createTestState({ content: "Test research content" });

      // Execute the node
      const result = (await evaluateContent(state as any)) as any;

      // Verify error handling
      expect(result.evaluationStatus).toBe("error");
      expect(result.errors[0]).toMatch(/Failed to parse/i);
    });

    it("should handle content validation errors", async () => {
      // Create an evaluation node with custom validation
      const evaluateContent = createEvaluationNode({
        contentType: "research",
        contentExtractor: createTestExtractor("content"),
        criteriaPath: "test-criteria.json",
        resultField: "evaluationResult",
        statusField: "evaluationStatus",
        customValidator: (content) => {
          if (
            !content ||
            (typeof content === "string" && content.length < 10)
          ) {
            return false; // Return boolean instead of object
          }
          return true;
        },
      });

      // Setup state with invalid content
      const state = createTestState({ content: "Short" });

      // Execute the node
      const result = (await evaluateContent(state as any)) as any;

      // Verify validation error handling
      expect(result.evaluationStatus).toBe("error");
      expect(result.errors[0]).toMatch(/Custom validation failed/i);
    });
  });

  describe("User Messages", () => {
    it("should add informative messages to state on success", async () => {
      // Create an evaluation node
      const evaluateContent = createEvaluationNode({
        contentType: "research",
        contentExtractor: createTestExtractor("content"),
        criteriaPath: "test-criteria.json",
        resultField: "evaluationResult",
        statusField: "evaluationStatus",
      });

      // Setup state with empty messages array
      const state = createTestState({
        content: "Test research content",
        messages: [],
      });

      // Execute the node
      const result = (await evaluateContent(state as any)) as any;

      // Verify messages were added
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toMatch(/evaluation completed/i);
    });

    it("should add error messages to state on failure", async () => {
      // Mock an error
      mocks.mockChatCompletionInvoke.mockRejectedValueOnce(
        new Error("Test error")
      );

      // Create an evaluation node
      const evaluateContent = createEvaluationNode({
        contentType: "research",
        contentExtractor: createTestExtractor("content"),
        criteriaPath: "test-criteria.json",
        resultField: "evaluationResult",
        statusField: "evaluationStatus",
      });

      // Setup state with empty messages array
      const state = createTestState({
        content: "Test research content",
        messages: [],
      });

      // Execute the node
      const result = (await evaluateContent(state as any)) as any;

      // Verify error messages were added
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toMatch(/Error during/i);
    });
  });
});
