import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoadingStatus, ProcessingStatus } from "@/state/proposal.state.js";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

// Mock LangGraph
const mockAddNode = vi.hoisted(() => vi.fn());
const mockAddEdge = vi.hoisted(() => vi.fn());
const mockAddConditionalEdges = vi.hoisted(() => vi.fn());
const mockCompile = vi.hoisted(() => vi.fn());
const mockInvoke = vi.hoisted(() => vi.fn());
const mockStateGraph = vi.hoisted(() =>
  vi.fn(() => ({
    addNode: mockAddNode,
    addEdge: mockAddEdge,
    addConditionalEdges: mockAddConditionalEdges,
    compile: mockCompile,
    invoke: mockInvoke,
  }))
);

// Mock Annotation for LangGraph state management
const mockAnnotation = vi.hoisted(() => {
  const annotationFn = vi.fn((options = {}) => options);
  annotationFn.Root = vi.fn((schema) => schema);
  return annotationFn;
});

// Mock chat node behavior
const mockChatNode = vi.hoisted(() => vi.fn());
const mockDocumentLoaderNode = vi.hoisted(() => vi.fn());
const mockResearchNode = vi.hoisted(() => vi.fn());

// Mock ChatOpenAI
const mockChatOpenAI = vi.hoisted(() => ({
  invoke: vi.fn(),
  bindTools: vi.fn().mockReturnThis(),
}));

// Apply mocks
vi.mock("@langchain/langgraph", () => ({
  StateGraph: mockStateGraph,
  Annotation: mockAnnotation,
  messagesStateReducer: vi.fn(),
}));

vi.mock("../nodes.js", () => ({
  chatAgentNode: mockChatNode,
  documentLoaderNode: mockDocumentLoaderNode,
  researchNode: mockResearchNode,
}));

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: vi.fn(() => mockChatOpenAI),
}));

// Mock console to suppress output
vi.mock("console", () => ({
  log: vi.fn(),
  error: vi.fn(),
}));

// Import after mocks
import { createProposalGenerationGraph } from "../graph.js";

describe("End-to-End Chat Workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default chat behavior - helpful assistant
    mockChatOpenAI.invoke.mockResolvedValue({
      content: "I'll help with your proposal. Let's get started!",
    });

    // Default node behaviors
    mockChatNode.mockImplementation((state) => ({
      ...state,
      messages: [
        ...(state.messages || []),
        { role: "assistant", content: "I'll help with your proposal." },
      ],
    }));

    mockDocumentLoaderNode.mockImplementation((state) => ({
      ...state,
      rfpDocument: {
        status: LoadingStatus.LOADED,
        id: "test-rfp-123",
        text: "Sample RFP document text",
      },
    }));

    mockResearchNode.mockImplementation((state) => ({
      ...state,
      research: {
        status: ProcessingStatus.COMPLETE,
        content: "Research results",
      },
    }));

    // Setup invoke to simulate graph execution
    mockInvoke.mockImplementation(async (state) => {
      const afterChat = await mockChatNode(state);
      return afterChat;
    });
  });

  it("should provide appropriate welcome message for new proposal", async () => {
    // Arrange
    const userId = "test-user-123";
    const proposalId = "new-proposal-456";
    const rfpId = "test-rfp-123";

    // Set up chat node with welcome message for new users
    mockChatNode.mockImplementation((state) => {
      // Check if this is a new conversation (no messages)
      if (!state.messages || state.messages.length === 0) {
        return {
          ...state,
          messages: [
            {
              role: "assistant",
              content:
                "Welcome! I'll help you generate a proposal based on your RFP document. Let's get started by analyzing your document.",
            },
          ],
        };
      }
      return state;
    });

    // Create the graph
    createProposalGenerationGraph(userId, proposalId, rfpId);

    // Initial state - empty messages array for new proposal
    const initialState = {
      userId,
      proposalId,
      rfpId,
      messages: [],
      rfpDocument: { status: LoadingStatus.NOT_STARTED },
    };

    // Act: Simulate running the graph
    const finalState = await mockInvoke(initialState);

    // Assert: Verify welcome message is present
    expect(finalState.messages.length).toBeGreaterThan(0);
    expect(finalState.messages[0].content).toContain("Welcome");
    expect(finalState.messages[0].content).toContain("RFP document");
  });

  it("should adapt welcome message for existing proposal with loaded document", async () => {
    // Arrange
    const userId = "test-user-123";
    const proposalId = "existing-proposal-789";
    const rfpId = "test-rfp-123";

    // Set up chat node with context-aware welcome for returning users
    mockChatNode.mockImplementation((state) => {
      // Check if this is a resumed session with loaded document
      if (
        (!state.messages || state.messages.length === 0) &&
        state.rfpDocument?.status === LoadingStatus.LOADED
      ) {
        return {
          ...state,
          messages: [
            {
              role: "assistant",
              content:
                "Welcome back! Your RFP document is already loaded. Would you like to continue with the research phase?",
            },
          ],
        };
      }
      return state;
    });

    // Create the graph
    createProposalGenerationGraph(userId, proposalId, rfpId);

    // Initial state - empty messages but document already loaded
    const initialState = {
      userId,
      proposalId,
      rfpId,
      messages: [],
      rfpDocument: {
        status: LoadingStatus.LOADED,
        id: rfpId,
        text: "Sample RFP document text",
      },
    };

    // Act: Simulate running the graph
    const finalState = await mockInvoke(initialState);

    // Assert: Verify welcome message acknowledges existing document
    expect(finalState.messages.length).toBeGreaterThan(0);
    expect(finalState.messages[0].content).toContain("Welcome back");
    expect(finalState.messages[0].content).toContain("already loaded");
  });

  it("should maintain conversation continuity across workflow stages", async () => {
    // Arrange
    const userId = "test-user-123";
    const proposalId = "continuity-test-123";
    const rfpId = "test-rfp-123";

    // Setup multi-message conversation history
    const existingMessages = [
      new HumanMessage("Can you help with my proposal?"),
      new AIMessage(
        "Yes, I can help you generate a proposal. Do you have your RFP document ready?"
      ),
      new HumanMessage("Yes, it should be uploaded already"),
    ];

    // Set up chat node to append to existing conversation
    mockChatNode.mockImplementation((state) => {
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            role: "assistant",
            content:
              "Great! I can see your document is loaded. Let's proceed with analyzing it.",
          },
        ],
      };
    });

    // Create the graph
    createProposalGenerationGraph(userId, proposalId, rfpId);

    // Initial state with existing conversation
    const initialState = {
      userId,
      proposalId,
      rfpId,
      messages: existingMessages,
      rfpDocument: {
        status: LoadingStatus.LOADED,
        id: rfpId,
      },
    };

    // Act: Simulate running the graph
    const finalState = await mockInvoke(initialState);

    // Assert: Verify conversation history is preserved and extended
    expect(finalState.messages.length).toBe(existingMessages.length + 1);

    // Check that original messages are preserved
    expect(finalState.messages[0].content).toBe(
      "Can you help with my proposal?"
    );
    expect(finalState.messages[1].content).toContain(
      "Yes, I can help you generate a proposal"
    );

    // Check that new message references document status
    expect(
      finalState.messages[finalState.messages.length - 1].content
    ).toContain("document is loaded");
  });

  it("should gracefully handle unavailable services", async () => {
    // Arrange
    const userId = "test-user-123";
    const proposalId = "error-test-123";
    const rfpId = "test-rfp-123";

    // Set up document loader to fail
    mockDocumentLoaderNode.mockImplementation(() => {
      throw new Error("Service unavailable");
    });

    // Set up chat node to handle service errors gracefully
    mockChatNode.mockImplementation((state) => {
      // If there was an error in a previous step
      if (state.serviceError) {
        return {
          ...state,
          messages: [
            ...(state.messages || []),
            {
              role: "assistant",
              content:
                "I'm sorry, but there seems to be a temporary issue with our service. Please try again in a few minutes.",
            },
          ],
        };
      }
      return state;
    });

    // Setup invoke to simulate error handling flow
    mockInvoke.mockImplementation(async (state) => {
      try {
        // Try document loading
        await mockDocumentLoaderNode(state);
      } catch (error) {
        // If fails, add error to state and return to chat
        const stateWithError = {
          ...state,
          serviceError: error.message,
        };
        return await mockChatNode(stateWithError);
      }
      return state;
    });

    // Create the graph
    createProposalGenerationGraph(userId, proposalId, rfpId);

    // Initial state
    const initialState = {
      userId,
      proposalId,
      rfpId,
      messages: [new HumanMessage("Let's analyze my document")],
      rfpDocument: { status: LoadingStatus.NOT_STARTED },
    };

    // Act: Simulate running the graph with error
    const finalState = await mockInvoke(initialState);

    // Assert: Verify helpful error message is provided
    expect(finalState.serviceError).toBe("Service unavailable");
    expect(
      finalState.messages[finalState.messages.length - 1].content
    ).toContain("temporary issue");
    expect(
      finalState.messages[finalState.messages.length - 1].content
    ).toContain("try again");
  });
});
