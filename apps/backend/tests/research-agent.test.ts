import { describe, it, expect, vi, beforeEach } from "vitest"; // Removed unused beforeAll/afterAll
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { ResearchState } from "../agents/research/state";
import * as originalNodes from "../agents/research/nodes";

// Mock LLM static
vi.mock("@langchain/openai", () => {
  // ... (LLM mock)
  return {
    ChatOpenAI: vi.fn().mockImplementation(() => ({
      temperature: 0,
      invoke: vi.fn().mockResolvedValue(new AIMessage("Mocked LLM response")),
      bindTools: vi.fn().mockReturnThis(),
    })),
  };
});

describe("Research Agent Integration Tests", () => {
  // Renamed describe block
  let researchAgent: any;
  let createResearchGraph: any;
  let mockedNodes: typeof originalNodes;

  beforeEach(async () => {
    vi.resetModules();

    // Mock the checkpointer module to export MemorySaver
    vi.doMock("../../lib/persistence/supabase-checkpointer.js", () => {
      return { SupabaseCheckpointer: MemorySaver };
    });

    // Mock Nodes for integration testing
    vi.doMock("../agents/research/nodes", () => {
      return {
        documentLoaderNode: vi
          .fn()
          .mockImplementation(async (state: ResearchState) => {
            // Mock minimal state update needed for flow
            return {
              rfpDocument: {
                id: state.rfpDocument?.id || "mock-doc-id",
                text: "Mock RFP content",
                metadata: {},
              },
              status: { documentLoaded: true },
            };
          }),
        deepResearchNode: vi
          .fn()
          .mockImplementation(async (state: ResearchState) => {
            // Mock minimal state update needed for flow
            return {
              deepResearchResults: { mockKey: "mockResearchValue" },
              status: { researchComplete: true },
            };
          }),
        solutionSoughtNode: vi
          .fn()
          .mockImplementation(async (state: ResearchState) => {
            // Only return the fields this node is responsible for updating
            return {
              solutionResults: { mockKey: "mockSolutionValue" },
              status: { solutionAnalysisComplete: true }, // Let LangGraph handle merging this status
            };
          }),
      };
    });

    // Dynamic Import
    try {
      const agentModule = await import("../agents/research/index.js");
      researchAgent = agentModule.researchAgent;
      createResearchGraph = agentModule.createResearchGraph;
      mockedNodes = await import("../agents/research/nodes.js");
    } catch (e) {
      console.error("Dynamic import failed in beforeEach:", e);
      throw e;
    }

    vi.clearAllMocks();
  });

  describe("createResearchGraph", () => {
    it("creates a research graph with the correct nodes and edges", async () => {
      expect(createResearchGraph).toBeDefined();
      const graph = createResearchGraph();
      expect(graph).toBeDefined();
      const compiledGraph = graph.compile({ checkpointer: new MemorySaver() });
      expect(compiledGraph.nodes).toHaveProperty("documentLoader");
      expect(compiledGraph.nodes).toHaveProperty("deepResearch");
      // Check for solutionSoughtNode using the correct property name from the state file if different
      expect(compiledGraph.nodes).toHaveProperty("solutionSought");
    });
  });

  describe("researchAgent.invoke Flow", () => {
    // Renamed describe block

    it("should successfully run the full graph flow with mocked nodes", async () => {
      expect(researchAgent).toBeDefined();
      const checkpointer = new MemorySaver();

      const result = await researchAgent.invoke({
        documentId: "test-doc-flow",
        threadId: "test-thread-flow",
        checkpointer: checkpointer,
      });

      // Verify final status based on the LAST mock node's update
      expect(result.status?.solutionAnalysisComplete).toBe(true);
      // Verify the presence of keys set by mocks (minimal check)
      expect(result).toHaveProperty("rfpDocument");
      expect(result).toHaveProperty("deepResearchResults");
      // Check the property set by the solutionSoughtNode mock
      console.log(
        "Result object before final assertion:",
        JSON.stringify(result, null, 2)
      );
      expect(result).toHaveProperty("solutionResults");
      expect(result.solutionResults).toHaveProperty(
        "mockKey",
        "mockSolutionValue"
      ); // Example check on mock data

      // Verify each mock node was called
      expect(mockedNodes.documentLoaderNode).toHaveBeenCalledTimes(1);
      expect(mockedNodes.deepResearchNode).toHaveBeenCalledTimes(1);
      // Use the correct property name from the mock definition
      expect(mockedNodes.solutionSoughtNode).toHaveBeenCalledTimes(1);
    });

    it("should handle persistence across invocations with MemorySaver", async () => {
      const threadId = "persist-thread-flow";
      const checkpointer = new MemorySaver();

      // First invocation
      await researchAgent.invoke({
        documentId: "persist-doc-1",
        threadId,
        checkpointer: checkpointer,
      });

      // Second invocation
      const result = await researchAgent.invoke({
        documentId: "persist-doc-2",
        threadId,
        checkpointer: checkpointer,
      });

      // Check final status
      expect(result.status?.solutionAnalysisComplete).toBe(true);
      // Check calls across BOTH invocations
      expect(mockedNodes.documentLoaderNode).toHaveBeenCalledTimes(2);
      expect(mockedNodes.deepResearchNode).toHaveBeenCalledTimes(2);
      // Use the correct property name from the mock definition
      expect(mockedNodes.solutionSoughtNode).toHaveBeenCalledTimes(2);
    });

    it("should propagate errors correctly when a node fails", async () => {
      // Reset modules and setup mocks, making deepResearchNode reject
      vi.resetModules();
      vi.doMock("../../lib/persistence/supabase-checkpointer.js", () => ({
        SupabaseCheckpointer: MemorySaver,
      }));
      vi.doMock("../agents/research/nodes", () => {
        return {
          documentLoaderNode: vi.fn().mockResolvedValue({
            rfpDocument: { id: "error-doc", text: "Doc content", metadata: {} },
            status: { documentLoaded: true },
          }),
          deepResearchNode: vi
            .fn()
            .mockRejectedValue(new Error("Mock Node Failure")),
          // Use correct property name from the mock definition
          solutionSoughtNode: vi.fn().mockResolvedValue({}),
        };
      });

      // Dynamic Import
      const agentModule = await import("../agents/research/index.js");
      researchAgent = agentModule.researchAgent;
      mockedNodes = await import("../agents/research/nodes.js");

      const checkpointer = new MemorySaver();

      // Expect invoke to throw the error from the node
      await expect(
        researchAgent.invoke({
          documentId: "error-doc-propagate",
          checkpointer: checkpointer,
        })
      ).rejects.toThrow("Mock Node Failure");

      // Verify only nodes up to the failure were called
      expect(mockedNodes.documentLoaderNode).toHaveBeenCalledTimes(1);
      expect(mockedNodes.deepResearchNode).toHaveBeenCalledTimes(1);
      // Use the correct property name from the mock definition
      expect(mockedNodes.solutionSoughtNode).not.toHaveBeenCalled();
    });
  });
});
