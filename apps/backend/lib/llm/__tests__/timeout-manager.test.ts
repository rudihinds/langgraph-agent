import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StateGraph } from "@langchain/langgraph";
import { 
  TimeoutManager, 
  WorkflowCancellationError,
  configureTimeouts 
} from "../timeout-manager";

// Mock setTimeout and clearTimeout
vi.useFakeTimers();

// Test state interface
interface TestState {
  counter: number;
}

describe("TimeoutManager", () => {
  let graph: StateGraph<TestState>;
  let timeoutManager: TimeoutManager<TestState>;
  
  beforeEach(() => {
    // Create a simple test graph
    graph = new StateGraph<TestState>({
      channels: {
        counter: { counter: 0 },
      },
    });
    
    // Add a simple node
    graph.addNode("test", async ({ state }) => {
      return { counter: state.counter + 1 };
    });
    
    graph.addEdge("__start__", "test");
    graph.addEdge("test", "__end__");
    
    // Create a timeout manager with short timeouts for testing
    timeoutManager = new TimeoutManager<TestState>({
      workflowTimeout: 1000, // 1 second
      defaultTimeouts: {
        default: 500, // 500ms
      },
      onTimeout: vi.fn(),
      onCancellation: vi.fn(),
    });
  });
  
  afterEach(() => {
    vi.clearAllTimers();
    vi.clearAllMocks();
  });
  
  describe("configureGraph", () => {
    it("should add hooks to the graph", () => {
      const addBeforeCallHookSpy = vi.spyOn(graph, "addBeforeCallHook");
      const addAfterCallHookSpy = vi.spyOn(graph, "addAfterCallHook");
      
      timeoutManager.configureGraph(graph);
      
      expect(addBeforeCallHookSpy).toHaveBeenCalled();
      expect(addAfterCallHookSpy).toHaveBeenCalled();
    });
  });
  
  describe("startWorkflow", () => {
    it("should start the workflow timeout", () => {
      const setTimeoutSpy = vi.spyOn(global, "setTimeout");
      
      timeoutManager.startWorkflow();
      
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
    });
    
    it("should trigger cancellation when workflow timeout is exceeded", () => {
      const cancelSpy = vi.spyOn(timeoutManager, "cancel");
      
      timeoutManager.startWorkflow();
      
      // Fast-forward past the workflow timeout
      vi.advanceTimersByTime(1100);
      
      expect(cancelSpy).toHaveBeenCalledWith(expect.stringContaining("Workflow timeout exceeded"));
    });
  });
  
  describe("cancel", () => {
    it("should set cancelled state and call onCancellation", () => {
      const onCancellationMock = vi.fn();
      const manager = new TimeoutManager<TestState>({
        onCancellation: onCancellationMock,
      });
      
      manager.cancel("Test cancellation");
      
      expect(manager.isCancelled()).toBe(true);
      expect(onCancellationMock).toHaveBeenCalledWith("Test cancellation");
    });
    
    it("should clean up all timers", () => {
      const cleanupSpy = vi.spyOn(timeoutManager, "cleanup");
      
      timeoutManager.cancel("Test cancellation");
      
      expect(cleanupSpy).toHaveBeenCalled();
    });
  });
  
  describe("configureTimeouts helper", () => {
    it("should return configured graph and timeoutManager", () => {
      const result = configureTimeouts(graph, {
        workflowTimeout: 5000,
      });
      
      expect(result.graph).toBeDefined();
      expect(result.timeoutManager).toBeInstanceOf(TimeoutManager);
    });
  });
  
  describe("Node timeouts", () => {
    it("should use research timeout for research nodes", () => {
      const manager = new TimeoutManager<TestState>({
        researchNodes: ["research_node"],
        defaultTimeouts: {
          default: 1000,
          research: 5000,
        },
      });
      
      // Use private method via any cast to test
      const getNodeTimeout = (manager as any).getNodeTimeout.bind(manager);
      
      expect(getNodeTimeout("research_node")).toBe(5000);
      expect(getNodeTimeout("regular_node")).toBe(1000);
    });
    
    it("should use specific node timeout when provided", () => {
      const manager = new TimeoutManager<TestState>({
        nodeTimeouts: {
          "special_node": 7500,
        },
        defaultTimeouts: {
          default: 1000,
        },
      });
      
      // Use private method via any cast to test
      const getNodeTimeout = (manager as any).getNodeTimeout.bind(manager);
      
      expect(getNodeTimeout("special_node")).toBe(7500);
      expect(getNodeTimeout("regular_node")).toBe(1000);
    });
  });
});

// Additional tests for integration with StateGraph
describe("TimeoutManager Integration", () => {
  it("should throw WorkflowCancellationError when workflow is cancelled", async () => {
    // Create a test graph with a node that takes longer than the timeout
    const graph = new StateGraph<TestState>({
      channels: {
        counter: { counter: 0 },
      },
    });
    
    // Add a long-running node
    graph.addNode("long_running", async ({ state }) => {
      // Simulate a long-running operation
      await new Promise(resolve => setTimeout(resolve, 2000));
      return { counter: state.counter + 1 };
    });
    
    graph.addEdge("__start__", "long_running");
    
    // Configure with a short timeout
    const { graph: timeoutGraph, timeoutManager } = configureTimeouts(graph, {
      workflowTimeout: 500, // 500ms timeout
    });
    
    const app = timeoutGraph.compile();
    
    // Start the timeout manager
    timeoutManager.startWorkflow();
    
    // Manually cancel the workflow
    timeoutManager.cancel("Test cancellation");
    
    // The workflow should throw a cancellation error
    await expect(app.invoke({ counter: 0 })).rejects.toThrow(WorkflowCancellationError);
  });
});