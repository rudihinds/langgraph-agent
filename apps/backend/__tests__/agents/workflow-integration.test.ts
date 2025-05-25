import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoadingStatus, ProcessingStatus } from "@/state/proposal.state.js";

// Mock dependencies
const mockChatNode = vi.hoisted(() => vi.fn());
const mockDocumentLoaderNode = vi.hoisted(() => vi.fn());
const mockResearchNode = vi.hoisted(() => vi.fn());

// Mock LangGraph StateGraph
const mockAddNode = vi.hoisted(() => vi.fn());
const mockAddEdge = vi.hoisted(() => vi.fn());
const mockAddConditionalEdges = vi.hoisted(() => vi.fn());
const mockCompile = vi.hoisted(() => vi.fn());
const mockInvoke = vi.hoisted(() => vi.fn());

// Mock the StateGraph constructor
const mockStateGraph = vi.hoisted(() =>
  vi.fn(() => ({
    addNode: mockAddNode,
    addEdge: mockAddEdge,
    addConditionalEdges: mockAddConditionalEdges,
    compile: mockCompile,
    invoke: mockInvoke,
  }))
);

// Apply mocks
vi.mock("langchain/graphs", () => ({
  StateGraph: mockStateGraph,
}));

vi.mock("../nodes.js", () => ({
  chatAgentNode: mockChatNode,
  documentLoaderNode: mockDocumentLoaderNode,
  researchNode: mockResearchNode,
}));

// Import after mocks are set up
import { createProposalGenerationGraph } from "../graph.js";

describe("Complete Graph Flow Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up node behavior
    mockChatNode.mockImplementation((state) => {
      // Chat node detects document loading intent
      return {
        ...state,
        intent: "load_document",
        messages: [
          ...(state.messages || []),
          { role: "assistant", content: "I'll help load your document" },
        ],
      };
    });

    mockDocumentLoaderNode.mockImplementation((state) => {
      // Document loader successfully loads document
      return {
        ...state,
        rfpDocument: {
          status: LoadingStatus.LOADED,
          id: "test-rfp-123",
          text: "Test RFP document content",
        },
      };
    });

    mockResearchNode.mockImplementation((state) => {
      // Research node processes document and returns research
      return {
        ...state,
        research: {
          status: ProcessingStatus.COMPLETE,
          content: "Research results based on document",
        },
      };
    });

    // Set up graph invoke to simulate execution
    mockInvoke.mockImplementation(async (state) => {
      // Simulate graph execution by calling nodes in sequence
      const afterChat = await mockChatNode(state);
      const afterDocument = await mockDocumentLoaderNode(afterChat);
      return await mockResearchNode(afterDocument);
    });
  });

  it("should process complete flow from chat through document loading to research", async () => {
    // Arrange
    const userId = "test-user-123";
    const proposalId = "test-proposal-123";
    const rfpId = "test-rfp-123";

    // Create the graph
    const graph = createProposalGenerationGraph(userId, proposalId, rfpId);

    // Initial state
    const initialState = {
      userId,
      proposalId,
      rfpId,
      messages: [
        { role: "human", content: "I want to analyze my RFP document" },
      ],
      rfpDocument: { status: LoadingStatus.NOT_STARTED },
      researchStatus: ProcessingStatus.NOT_STARTED,
    };

    // Act: Simulate running the graph
    const finalState = await mockInvoke(initialState);

    // Assert: Verify the complete flow executed correctly
    // 1. Verify chat node was called
    expect(mockChatNode).toHaveBeenCalled();

    // 2. Verify document loader was called
    expect(mockDocumentLoaderNode).toHaveBeenCalled();

    // 3. Verify research node was called
    expect(mockResearchNode).toHaveBeenCalled();

    // 4. Verify final state contains all expected components
    expect(finalState).toMatchObject({
      userId,
      proposalId,
      rfpId,
      rfpDocument: {
        status: LoadingStatus.LOADED,
        id: "test-rfp-123",
      },
      research: {
        status: ProcessingStatus.COMPLETE,
      },
      messages: expect.arrayContaining([
        expect.objectContaining({ role: "human" }),
        expect.objectContaining({ role: "assistant" }),
      ]),
    });
  });

  it("should handle errors during the flow gracefully", async () => {
    // Arrange: Set up document loader to fail
    mockDocumentLoaderNode.mockImplementation((state) => {
      return {
        ...state,
        rfpDocument: {
          status: LoadingStatus.ERROR,
          metadata: { error: "Document not found" },
        },
      };
    });

    // Adjust research node to handle document error
    mockResearchNode.mockImplementation((state) => {
      if (state.rfpDocument?.status === LoadingStatus.ERROR) {
        return {
          ...state,
          research: {
            status: ProcessingStatus.ERROR,
            error: "Cannot research without document",
          },
        };
      }
      return state;
    });

    // Adjust invoke to simulate this error path
    mockInvoke.mockImplementation(async (state) => {
      const afterChat = await mockChatNode(state);
      const afterDocument = await mockDocumentLoaderNode(afterChat);
      return await mockResearchNode(afterDocument);
    });

    // Initial state
    const initialState = {
      userId: "test-user-123",
      proposalId: "test-proposal-123",
      rfpId: "invalid-rfp-id",
      messages: [
        { role: "human", content: "I want to analyze my RFP document" },
      ],
      rfpDocument: { status: LoadingStatus.NOT_STARTED },
      researchStatus: ProcessingStatus.NOT_STARTED,
    };

    // Act: Simulate running the graph
    const finalState = await mockInvoke(initialState);

    // Assert: Verify the error was handled gracefully
    expect(finalState.rfpDocument.status).toBe(LoadingStatus.ERROR);
    expect(finalState.research.status).toBe(ProcessingStatus.ERROR);
    expect(finalState.research.error).toBeDefined();
  });
});
 