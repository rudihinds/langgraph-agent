import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMultiAgentSystem,
  runMultiAgentExample,
  MultiAgentState,
} from "../agents/multi-agent";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";

// Mock dependencies with appropriate state transitions
vi.mock("@langchain/openai", () => {
  return {
    ChatOpenAI: vi.fn().mockImplementation(() => ({
      temperature: vi.fn().mockReturnThis(),
      invoke: vi.fn().mockImplementation(async (messages) => {
        // Check if this is the researcher or writer based on the messages
        const isResearcher = messages.some(
          (msg) =>
            msg instanceof SystemMessage &&
            msg.content.includes("skilled researcher")
        );

        if (isResearcher) {
          // Ensure research completes on the first call to prevent infinite recursion
          return new AIMessage(
            "Mock research findings about the requested topic. [RESEARCH COMPLETE]"
          );
        } else {
          return new AIMessage("Mock outline based on the research findings.");
        }
      }),
      bindTools: vi.fn().mockReturnThis(),
    })),
  };
});

vi.mock("@langchain/community/tools/tavily_search", () => {
  return {
    TavilySearchResults: vi.fn().mockImplementation(() => ({
      name: "tavily_search",
      description: "Search the web",
      call: vi.fn().mockResolvedValue("Mock search results for the query"),
    })),
  };
});

vi.mock("@langchain/langgraph/prebuilt", () => {
  return {
    ToolNode: vi.fn().mockImplementation((tools) => ({
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _: tools, // Acknowledge variable for linting
      invoke: vi.fn().mockImplementation((state) => {
        // Mock tool execution result
        return {
          messages: [
            ...state.messages,
            new AIMessage("Mock tool execution result"),
          ],
        };
      }),
    })),
  };
});

describe("Multi-Agent System Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createMultiAgentSystem", () => {
    it("creates a multi-agent system that can be invoked", async () => {
      // Create the agent system
      const agentSystem = createMultiAgentSystem();

      // Create input state
      const initialState: MultiAgentState = {
        messages: [new HumanMessage("Research artificial intelligence")],
      };

      // Test the agent system
      const result = await agentSystem.invoke(initialState, {
        recursionLimit: 5,
      });

      // Verify the structure of the result
      expect(result).toHaveProperty("messages");

      // Check that there are at least 3 messages: the human input, research, and writer response
      expect(result.messages.length).toBeGreaterThanOrEqual(3);
      expect(result.messages[0]).toBeInstanceOf(HumanMessage);

      // Check the content of the AI messages
      const aiMessages = result.messages.filter(
        (msg) => msg instanceof AIMessage
      );
      expect(aiMessages.length).toBeGreaterThanOrEqual(2);

      // Verify that research message contains [RESEARCH COMPLETE] tag
      const researchMessage = aiMessages.find((msg) =>
        msg.content.toString().includes("[RESEARCH COMPLETE]")
      );
      expect(researchMessage).toBeDefined();
    });
  });

  describe("runMultiAgentExample", () => {
    it("runs a complete multi-agent workflow", async () => {
      // Run the example with a test topic
      const result = await runMultiAgentExample("artificial intelligence");

      // Verify the structure and content of the results
      expect(result).toHaveProperty("finalMessages");
      expect(result).toHaveProperty("researchFindings");
      expect(result).toHaveProperty("outline");
      expect(Array.isArray(result.finalMessages)).toBe(true);

      // Check that the researchFindings and outline are extracted correctly
      expect(result.researchFindings).toBeTruthy();
      expect(result.outline).toBeTruthy();
    });
  });
});
