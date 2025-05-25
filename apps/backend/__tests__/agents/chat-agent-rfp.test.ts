import { describe, it, expect, vi } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { LoadingStatus, ProcessingStatus } from "@/state/proposal.state.js";

// Mock ChatOpenAI
vi.mock("@langchain/openai", () => {
  return {
    ChatOpenAI: vi.fn().mockImplementation(() => ({
      invoke: vi.fn().mockResolvedValue({
        content:
          "I see your document is still loading. I'll help you once it's ready.",
      }),
      bindTools: vi.fn().mockReturnThis(),
    })),
  };
});

// Import after mock is set up
import { chatAgentNode } from "../chatAgent.js";
import { ChatOpenAI } from "@langchain/openai";

// Mock console to reduce noise
vi.mock("console", () => ({
  log: vi.fn(),
  error: vi.fn(),
}));

describe("chatAgentNode - Basic Test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should process human message and return a response", async () => {
    // Create a minimal state object
    const minimalState = {
      messages: [new HumanMessage("Can you help me with my proposal?")],
      rfpDocument: {
        status: LoadingStatus.LOADING,
        id: "test-rfp-123",
      },
      researchStatus: ProcessingStatus.NOT_STARTED,
      solutionStatus: ProcessingStatus.NOT_STARTED,
      sections: new Map(),
    };

    // Run the function with type assertion
    const result = await chatAgentNode(minimalState as any);

    // Basic assertions
    expect(ChatOpenAI).toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result.messages).toBeDefined();
    expect(result.messages.length).toBe(1);

    // Verify a mock instance was created and used
    const mockInstance = vi.mocked(ChatOpenAI).mock.results[0].value;
    expect(mockInstance.invoke).toHaveBeenCalled();
    expect(mockInstance.bindTools).toHaveBeenCalled();
  });
});
