import { test, expect, describe, beforeEach, vi } from "vitest";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { OrchestratorNode } from "../nodes.js";
import { createOrchestratorGraph, runOrchestrator } from "../graph.js";
import { OrchestratorState } from "../state.js";

// Mock LLM for testing
const mockLLM = {
  invoke: vi.fn().mockResolvedValue({
    content: JSON.stringify({
      agentType: "proposal",
      reason: "User is asking about proposal generation",
      priority: 8,
    }),
  }),
};

describe("OrchestratorNode", () => {
  let orchestratorNode: OrchestratorNode;
  
  beforeEach(() => {
    // Create a new orchestratorNode for each test with mock LLM
    orchestratorNode = new OrchestratorNode({
      llm: mockLLM as any,
      debug: true,
    });
  });
  
  test("should initialize with correct config", async () => {
    const initialState = {
      messages: [],
      config: {},
      metadata: {},
    } as unknown as OrchestratorState;
    
    const result = await orchestratorNode.initialize(initialState);
    
    expect(result.status).toBe("init");
    expect(result.metadata?.initialized).toBe(true);
    expect(result.config?.maxRetries).toBeDefined();
  });
  
  test("should analyze user input and determine agent type", async () => {
    const state = {
      messages: [
        new HumanMessage("I need help creating a proposal for a grant application"),
      ],
      metadata: {},
    } as unknown as OrchestratorState;
    
    const result = await orchestratorNode.analyzeUserInput(state);
    
    expect(result.currentAgent).toBe("proposal");
    expect(result.status).toBe("in_progress");
    expect(mockLLM.invoke).toHaveBeenCalled();
  });
  
  test("should handle errors appropriately", async () => {
    const state = {
      metadata: {},
      config: { maxRetries: 3 },
    } as unknown as OrchestratorState;
    
    const error = {
      source: "test",
      message: "Test error",
      recoverable: true,
    };
    
    const result = await orchestratorNode.handleError(state, error);
    
    expect(result.errors?.length).toBe(1);
    expect(result.errors?.[0].source).toBe("test");
    expect(result.errors?.[0].retryCount).toBe(1);
  });
});

describe("OrchestratorGraph", () => {
  test("should compile successfully", () => {
    const graph = createOrchestratorGraph({
      llm: mockLLM as any,
    });
    
    expect(graph).toBeDefined();
  });
  
  test("should process a message through the full workflow", async () => {
    // Mock doesn't need to be reset because each test gets a fresh mock
    mockLLM.invoke.mockResolvedValue({
      content: JSON.stringify({
        agentType: "research",
        reason: "User is asking about research",
        priority: 7,
      }),
    });
    
    const result = await runOrchestrator(
      "Can you research the background of this funding organization?",
      { llm: mockLLM as any }
    );
    
    expect(result.currentAgent).toBe("research");
    expect(result.pendingUserInputs?.research?.length).toBe(1);
    expect(mockLLM.invoke).toHaveBeenCalled();
  });
});