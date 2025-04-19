import { describe, it, expect, beforeEach, vi } from "vitest";
import { OverallProposalState } from "../../state/proposal.state";
import { StateGraph } from "@langchain/langgraph";

// Mock the evaluation integration
const evaluationIntegrationMock = vi.hoisted(() => ({
  addEvaluationNode: vi.fn(),
}));

vi.mock(
  "../../agents/proposal_generation/evaluation_integration",
  () => evaluationIntegrationMock
);

// Mock the factories for nodes
const mockEvaluationNodes = {
  researchEvaluationNode: vi.fn(),
  solutionEvaluationNode: vi.fn(),
  connectionPairsEvaluationNode: vi.fn(),
};

// Mock the graph
let mockAddNode = vi.fn();
let mockAddEdge = vi.fn();
let mockAddConditionalEdges = vi.fn();
let mockInterruptAfter = vi.fn();
let mockCompilerProp = vi.fn();

const mockGraph = vi.hoisted(() => ({
  addNode: mockAddNode,
  addEdge: mockAddEdge,
  addConditionalEdges: mockAddConditionalEdges,
  compiler: {
    interruptAfter: mockInterruptAfter,
  },
}));

// Mock LangGraph StateGraph class
vi.mock("@langchain/langgraph", () => {
  return {
    StateGraph: vi.fn().mockImplementation(() => {
      return mockGraph;
    }),
  };
});

// Mock the nodes module
const nodesMock = vi.hoisted(() => ({
  documentLoaderNode: vi.fn(),
  solutionSoughtNode: vi.fn(),
  connectionPairsNode: vi.fn(),
  // Add other nodes here
}));

vi.mock("../../agents/proposal_generation/nodes", () => nodesMock);

// Import the graph module after mocking
import { createProposalGenerationGraph } from "../../agents/proposal_generation/graph";

describe("Evaluation Node Graph Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the mock implementations
    mockAddNode = vi.fn();
    mockAddEdge = vi.fn();
    mockAddConditionalEdges = vi.fn();
    mockInterruptAfter = vi.fn();

    // Update the mock graph with new functions
    mockGraph.addNode = mockAddNode;
    mockGraph.addEdge = mockAddEdge;
    mockGraph.addConditionalEdges = mockAddConditionalEdges;
    mockGraph.compiler = { interruptAfter: mockInterruptAfter };
  });

  describe("Adding Evaluation Nodes", () => {
    it("adds multiple evaluation nodes to the graph", () => {
      // Act
      createProposalGenerationGraph();

      // Assert
      // Check that addEvaluationNode was called for at least research, solution, and connections
      expect(evaluationIntegrationMock.addEvaluationNode).toHaveBeenCalledTimes(
        expect.any(Number)
      );

      // Check research evaluation was added
      expect(evaluationIntegrationMock.addEvaluationNode).toHaveBeenCalledWith(
        expect.objectContaining({
          graph: mockGraph,
          contentType: "research",
          sourceNode: expect.any(String),
          destinationNode: expect.any(String),
        })
      );

      // Check solution evaluation was added
      expect(evaluationIntegrationMock.addEvaluationNode).toHaveBeenCalledWith(
        expect.objectContaining({
          graph: mockGraph,
          contentType: "solution",
          sourceNode: expect.any(String),
          destinationNode: expect.any(String),
        })
      );

      // Check connection pairs evaluation was added
      expect(evaluationIntegrationMock.addEvaluationNode).toHaveBeenCalledWith(
        expect.objectContaining({
          graph: mockGraph,
          contentType: "connection_pairs",
          sourceNode: expect.any(String),
          destinationNode: expect.any(String),
        })
      );
    });

    it("configures proper HITL interrupt points for evaluation nodes", () => {
      // Act
      createProposalGenerationGraph();

      // Assert
      // Check that interruptAfter was called for evaluation nodes
      expect(mockInterruptAfter).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringMatching(/^evaluate/), // At least one node name starting with "evaluate"
        ])
      );
    });
  });

  describe("State Transitions", () => {
    it("updates state during graph execution through evaluation phases", async () => {
      // This test will need to be updated once we have the actual implementation
      // Currently, we'll just sketch the test structure

      // Arrange
      const initialState: Partial<OverallProposalState> = {
        sections: {
          research: {
            status: "queued",
            content: null,
            evaluationResult: null,
          },
        },
        interruptStatus: null,
      };

      // We'd need to setup proper mocks to capture state transitions
      // This would involve mocking functions like runGraph, etc.

      // Act
      // In the actual implementation this would involve:
      // const result = await runGraph(initialState);

      // Assert
      // We'd expect to see state transitions like:
      // queued → running → evaluating → awaiting_review
      // expect(result.sections.research.status).toBe("awaiting_review");
      // expect(result.interruptStatus).not.toBeNull();
    });
  });

  describe("Integration of Multiple Evaluation Nodes", () => {
    it("properly configures source and destination nodes for each evaluation node", () => {
      // Act
      createProposalGenerationGraph();

      // Assert - check evaluation source/destination pairs
      const calls = evaluationIntegrationMock.addEvaluationNode.mock.calls;

      // Extract the source/destination pairs from the calls
      const nodeConnections = calls.map((call) => ({
        contentType: call[0].contentType,
        sourceNode: call[0].sourceNode,
        destinationNode: call[0].destinationNode,
      }));

      // Verify each evaluation node connects to the correct nodes
      // These are just example assertions - actual values depend on implementation
      expect(nodeConnections).toContainEqual(
        expect.objectContaining({
          contentType: "research",
          sourceNode: expect.any(String),
          destinationNode: expect.any(String),
        })
      );

      expect(nodeConnections).toContainEqual(
        expect.objectContaining({
          contentType: "solution",
          sourceNode: expect.any(String),
          destinationNode: expect.any(String),
        })
      );

      expect(nodeConnections).toContainEqual(
        expect.objectContaining({
          contentType: "connection_pairs",
          sourceNode: expect.any(String),
          destinationNode: expect.any(String),
        })
      );
    });
  });
});
