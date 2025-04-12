import { describe, it, expect, vi, beforeEach } from "vitest";
import { StateGraph } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { NodeInterrupt } from "@langchain/langgraph";
import {
  configureLoopPrevention,
  terminateOnLoop,
  createProgressDetectionNode,
  createIterationLimitNode,
  createCompletionCheckNode,
} from "../loop-prevention";
import { createStateFingerprint } from "../state-fingerprinting";

// Mock console.warn to prevent test output clutter
vi.spyOn(console, "warn").mockImplementation(() => {});

// Test state interface
interface TestState {
  counter: number;
  value: string;
  items: string[];
  stateHistory?: any[];
  loopDetection?: any;
  next?: string;
  nested?: any;
  timestamp?: number;
}

// Helper to create a basic state graph for testing
function createTestGraph() {
  const graph = new StateGraph<TestState>({
    channels: {
      value: { value: "" },
      counter: { counter: 0 },
      items: { items: [] },
    },
  });

  // Add nodes to the graph
  graph.addNode("increment", async ({ state }) => {
    return {
      ...state,
      counter: state.counter + 1,
    };
  });

  graph.addNode("addItem", async ({ state }) => {
    return {
      ...state,
      items: [...state.items, `item-${state.items.length}`],
    };
  });

  graph.addNode("noChange", async ({ state }) => {
    return { ...state };
  });

  // Add END node
  graph.addNode("END", async ({ state }) => {
    return { ...state };
  });

  return graph;
}

describe("Loop Prevention Module", () => {
  let graph: StateGraph<TestState>;

  beforeEach(() => {
    graph = createTestGraph();
  });

  describe("configureLoopPrevention", () => {
    it("should set the recursion limit on the graph", () => {
      const setRecursionLimitSpy = vi.spyOn(graph, "setRecursionLimit");
      configureLoopPrevention(graph, { maxIterations: 15 });
      expect(setRecursionLimitSpy).toHaveBeenCalledWith(15);
    });

    it("should wrap nodes with loop detection logic when autoAddTerminationNodes is true", () => {
      const getNodeSpy = vi.spyOn(graph, "getNode");
      const addNodeSpy = vi.spyOn(graph, "addNode");

      configureLoopPrevention(graph, {
        maxIterations: 5,
        autoAddTerminationNodes: true,
      });

      // Should get each node
      expect(getNodeSpy).toHaveBeenCalledTimes(3); // 3 main nodes excluding END

      // Should add wrapped nodes back
      expect(addNodeSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe("terminateOnLoop", () => {
    it("should add stateHistory on first execution", async () => {
      const nodeFn = async ({ state }: { state: TestState }) => state;
      const wrappedNode = terminateOnLoop(nodeFn);

      const initialState = { counter: 0, value: "", items: [] };
      const result = await wrappedNode({
        state: initialState,
        name: "testNode",
        config: {},
        metadata: {},
      });

      expect(result.stateHistory).toBeDefined();
      expect(result.stateHistory?.length).toBe(1);
    });

    it("should detect cycles and direct to END when set", async () => {
      const nodeFn = async ({ state }: { state: TestState }) => state;
      const wrappedNode = terminateOnLoop(nodeFn, {
        terminateOnNoProgress: true,
      });

      // Create a state with history that includes the same state multiple times
      const initialState = {
        counter: 0,
        value: "",
        items: [],
        stateHistory: [
          createStateFingerprint(
            { counter: 0, value: "", items: [] },
            {},
            "testNode"
          ),
          createStateFingerprint(
            { counter: 0, value: "", items: [] },
            {},
            "testNode"
          ),
          createStateFingerprint(
            { counter: 0, value: "", items: [] },
            {},
            "testNode"
          ),
        ],
      };

      const result = await wrappedNode({
        state: initialState,
        name: "testNode",
        config: {},
        metadata: {},
      });

      expect(result.loopDetection).toBeDefined();
      expect(result.loopDetection?.cycleDetected).toBe(true);
      expect(result.next).toBe("END");
    });

    it("should direct to breakLoopNodeName when specified", async () => {
      const nodeFn = async ({ state }: { state: TestState }) => state;
      const wrappedNode = terminateOnLoop(nodeFn, {
        breakLoopNodeName: "handleLoop",
      });

      // Create a state with history that includes the same state multiple times
      const initialState = {
        counter: 0,
        value: "",
        items: [],
        stateHistory: [
          createStateFingerprint(
            { counter: 0, value: "", items: [] },
            {},
            "testNode"
          ),
          createStateFingerprint(
            { counter: 0, value: "", items: [] },
            {},
            "testNode"
          ),
          createStateFingerprint(
            { counter: 0, value: "", items: [] },
            {},
            "testNode"
          ),
        ],
      };

      const result = await wrappedNode({
        state: initialState,
        name: "testNode",
        config: {},
        metadata: {},
      });

      expect(result.next).toBe("handleLoop");
    });

    it("should call custom handler when provided", async () => {
      const customHandler = vi.fn().mockReturnValue({
        counter: 999,
        value: "handled",
        items: [],
      });

      const nodeFn = async ({ state }: { state: TestState }) => state;
      const wrappedNode = terminateOnLoop(nodeFn, {
        onLoopDetected: customHandler,
      });

      // Create a state with history that includes the same state multiple times
      const initialState = {
        counter: 0,
        value: "",
        items: [],
        stateHistory: [
          createStateFingerprint(
            { counter: 0, value: "", items: [] },
            {},
            "testNode"
          ),
          createStateFingerprint(
            { counter: 0, value: "", items: [] },
            {},
            "testNode"
          ),
          createStateFingerprint(
            { counter: 0, value: "", items: [] },
            {},
            "testNode"
          ),
        ],
      };

      const result = await wrappedNode({
        state: initialState,
        name: "testNode",
        config: {},
        metadata: {},
      });

      expect(customHandler).toHaveBeenCalled();
      expect(result.counter).toBe(999);
      expect(result.value).toBe("handled");
    });
  });

  describe("createProgressDetectionNode", () => {
    it("should not modify state when progress is detected in a number field", async () => {
      const progressNode = createProgressDetectionNode<TestState>("counter");

      const state: TestState = {
        counter: 5,
        value: "",
        items: [],
        stateHistory: [
          {
            nodeName: "testNode",
            originalState: { counter: 3, value: "", items: [] },
            fingerprint: {},
          },
        ],
      };

      const result = await progressNode({
        state,
        name: "progressCheck",
        config: {},
        metadata: {},
      });

      expect(result.next).toBeUndefined();
    });

    it("should direct to END when no progress is detected", async () => {
      const progressNode = createProgressDetectionNode<TestState>("counter");

      const state: TestState = {
        counter: 5,
        value: "",
        items: [],
        stateHistory: [
          {
            nodeName: "testNode",
            originalState: { counter: 5, value: "", items: [] },
            fingerprint: {},
          },
        ],
      };

      const result = await progressNode({
        state,
        name: "progressCheck",
        config: {},
        metadata: {},
      });

      expect(result.next).toBe("END");
    });

    it("should direct to custom node when no progress and breakLoopNodeName specified", async () => {
      const progressNode = createProgressDetectionNode<TestState>("counter", {
        breakLoopNodeName: "handleNoProgress",
      });

      const state: TestState = {
        counter: 5,
        value: "",
        items: [],
        stateHistory: [
          {
            nodeName: "testNode",
            originalState: { counter: 5, value: "", items: [] },
            fingerprint: {},
          },
        ],
      };

      const result = await progressNode({
        state,
        name: "progressCheck",
        config: {},
        metadata: {},
      });

      expect(result.next).toBe("handleNoProgress");
    });
  });

  describe("createIterationLimitNode", () => {
    it("should increment counter and not modify next when below limit", async () => {
      const limitNode = createIterationLimitNode<TestState>(5);

      const state: TestState = {
        counter: 0,
        value: "",
        items: [],
      };

      const result = await limitNode({
        state,
        name: "limitCheck",
        config: {},
        metadata: {},
      });

      expect(result._iterationCount).toBe(1);
      expect(result.next).toBeUndefined();
    });

    it("should direct to END when iteration limit reached", async () => {
      const limitNode = createIterationLimitNode<TestState>(5);

      const state: TestState = {
        counter: 0,
        value: "",
        items: [],
        _iterationCount: 4,
      };

      const result = await limitNode({
        state,
        name: "limitCheck",
        config: {},
        metadata: {},
      });

      expect(result._iterationCount).toBe(5);
      expect(result.next).toBe("END");
    });

    it("should use custom counter field when specified", async () => {
      const limitNode = createIterationLimitNode<TestState>(5, {
        iterationCounterField: "customCounter",
      });

      const state: TestState = {
        counter: 0,
        value: "",
        items: [],
      };

      const result = (await limitNode({
        state,
        name: "limitCheck",
        config: {},
        metadata: {},
      })) as TestState & { customCounter: number };

      expect(result.customCounter).toBe(1);
    });
  });

  describe("createCompletionCheckNode", () => {
    it("should direct to END when completion check returns true", async () => {
      const completionNode = createCompletionCheckNode<TestState>(
        (state) => state.counter >= 5
      );

      const state: TestState = {
        counter: 5,
        value: "",
        items: [],
      };

      const result = await completionNode({
        state,
        name: "completionCheck",
        config: {},
        metadata: {},
      });

      expect(result.next).toBe("END");
    });

    it("should not modify state when completion check returns false", async () => {
      const completionNode = createCompletionCheckNode<TestState>(
        (state) => state.counter >= 5
      );

      const state: TestState = {
        counter: 3,
        value: "",
        items: [],
      };

      const result = await completionNode({
        state,
        name: "completionCheck",
        config: {},
        metadata: {},
      });

      expect(result.next).toBeUndefined();
    });
  });
});

// Add additional tests for edge cases and integration
describe("Loop Prevention Edge Cases", () => {
  let graph: StateGraph<TestState>;

  beforeEach(() => {
    graph = createTestGraph();
  });

  it("should handle complex nested state objects", async () => {
    const nodeFn = async ({ state }: { state: TestState }) => state;
    const wrappedNode = terminateOnLoop(nodeFn);

    const complexState = {
      counter: 0,
      value: "",
      items: [],
      nested: {
        level1: {
          level2: {
            level3: "deep value",
          },
        },
      },
    };

    const result = await wrappedNode({
      state: complexState,
      name: "testNode",
      config: {},
      metadata: {},
    });

    expect(result.stateHistory).toBeDefined();
    expect(result.stateHistory?.length).toBe(1);
  });

  it("should detect loops even when non-essential fields change", async () => {
    const nodeFn = async ({
      state,
    }: {
      state: TestState & { timestamp: number };
    }) => ({
      ...state,
      timestamp: Date.now(), // This changes on every iteration
    });

    const wrappedNode = terminateOnLoop(nodeFn, {
      fingerprintOptions: {
        excludeFields: ["timestamp"], // Exclude the changing timestamp
      },
    });

    // Create a state with history that includes the same state multiple times
    const initialState = {
      counter: 0,
      value: "",
      items: [],
      timestamp: Date.now(),
      stateHistory: [
        createStateFingerprint(
          { counter: 0, value: "", items: [] },
          {},
          "testNode"
        ),
        createStateFingerprint(
          { counter: 0, value: "", items: [] },
          {},
          "testNode"
        ),
        createStateFingerprint(
          { counter: 0, value: "", items: [] },
          {},
          "testNode"
        ),
      ],
    };

    const result = await wrappedNode({
      state: initialState,
      name: "testNode",
      config: {},
      metadata: {},
    });

    expect(result.loopDetection).toBeDefined();
    expect(result.loopDetection?.cycleDetected).toBe(true);
  });

  it("should not detect loops when values are meaningfully different", async () => {
    const nodeFn = async ({ state }: { state: TestState }) => state;

    const wrappedNode = terminateOnLoop(nodeFn, {
      progressField: "value",
    });

    // Create a state with history of different values
    const initialState = {
      counter: 0,
      value: "third",
      items: [],
      stateHistory: [
        createStateFingerprint(
          { counter: 0, value: "first", items: [] },
          {},
          "testNode"
        ),
        createStateFingerprint(
          { counter: 0, value: "second", items: [] },
          {},
          "testNode"
        ),
      ],
    };

    const result = await wrappedNode({
      state: initialState,
      name: "testNode",
      config: {},
      metadata: {},
    });

    expect(result.loopDetection?.cycleDetected).toBeUndefined();
    expect(result.next).toBeUndefined();
  });
});

describe("Loop Prevention Integration Scenarios", () => {
  it("should integrate with checkpoint system", async () => {
    const graph = createTestGraph();
    const memorySaver = new MemorySaver();

    // Add nodes and edges for a workflow with potential loops
    graph.addConditionalEdges("increment", (state) => {
      if (state.counter < 5) {
        return "increment"; // Create a cycle until counter reaches 5
      }
      return "END";
    });

    // Configure loop prevention
    configureLoopPrevention(graph, {
      maxIterations: 10,
      progressField: "counter",
    });

    const app = graph.compile({
      checkpointer: memorySaver,
    });

    // Run the workflow and it should terminate properly
    const result = await app.invoke({ counter: 0, value: "", items: [] });

    // Should have completed properly and reached 5
    expect(result.counter).toBe(5);

    // Checkpoints should have been created
    const checkpoints = await memorySaver.list({});
    expect(checkpoints.length).toBeGreaterThan(0);
  });

  it("should handle interrupted workflows and resumption", async () => {
    const graph = createTestGraph();
    const memorySaver = new MemorySaver();

    let interruptionThrown = false;

    // Add nodes and edges
    graph.addNode("maybeInterrupt", async ({ state }: { state: TestState }) => {
      if (state.counter === 3 && !interruptionThrown) {
        interruptionThrown = true;
        throw new NodeInterrupt("handleInterrupt", state);
      }
      return state;
    });

    graph.addNode(
      "handleInterrupt",
      async ({ state }: { state: TestState }) => {
        return {
          ...state,
          value: "interrupted",
        };
      }
    );

    graph.addEdge("increment", "maybeInterrupt");
    graph.addEdge("maybeInterrupt", "increment");

    // Configure loop prevention
    configureLoopPrevention(graph, {
      maxIterations: 15,
      progressField: "counter",
    });

    const app = graph.compile({
      checkpointer: memorySaver,
    });

    // Start the workflow
    let threadId: string;
    try {
      await app.invoke({ counter: 0, value: "", items: [] });
    } catch (e) {
      expect(e).toBeInstanceOf(NodeInterrupt);
      // Extract thread ID
      threadId = e.thread_id;
    }

    // Resume the workflow
    const result = await app.invoke(
      { counter: 3, value: "interrupted", items: [] },
      { configurable: { thread_id: threadId } }
    );

    // Should continue and eventually complete
    expect(result.counter).toBeGreaterThan(3);
    expect(result.value).toBe("interrupted");
  });

  it("should handle high iteration workflows with progress tracking", async () => {
    const graph = createTestGraph();

    // Configure loop prevention with higher limits
    configureLoopPrevention(graph, {
      maxIterations: 100,
      progressField: "counter",
      maxIterationsWithoutProgress: 3,
    });

    // Add nodes and edges
    graph.addConditionalEdges("increment", (state) => {
      if (state.counter < 50) {
        return state.counter % 10 === 0 ? "noChange" : "increment";
      }
      return "END";
    });

    graph.addConditionalEdges("noChange", () => "increment");

    const app = graph.compile();

    // Run the workflow
    const result = await app.invoke({ counter: 0, value: "", items: [] });

    // Should complete successfully
    expect(result.counter).toBe(50);
  });
});
