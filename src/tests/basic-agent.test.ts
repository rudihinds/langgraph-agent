import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSimpleAgent, createCustomAgent } from "../agents/basic-agent";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";

// Mock the dependencies
vi.mock("@langchain/openai", () => {
  return {
    ChatOpenAI: vi.fn().mockImplementation(() => ({
      temperature: 0,
      invoke: vi.fn().mockResolvedValue(new AIMessage("Mocked response")),
      bindTools: vi.fn().mockReturnThis(),
    })),
  };
});

vi.mock("@langchain/community/tools/tavily_search", () => {
  return {
    TavilySearchResults: vi.fn().mockImplementation(() => ({
      name: "tavily_search",
      description: "Search the web",
      call: vi.fn().mockResolvedValue("Mocked search result"),
    })),
  };
});

vi.mock("@langchain/langgraph/prebuilt", () => {
  return {
    createReactAgent: vi.fn().mockImplementation(({ llm, tools }) => ({
      invoke: vi.fn().mockResolvedValue({
        messages: [
          new HumanMessage("Test input"),
          new AIMessage("Mocked agent response"),
        ],
      }),
    })),
    ToolNode: vi.fn().mockImplementation((tools) => ({
      invoke: vi.fn().mockImplementation((state) => {
        return {
          messages: [...state.messages, new AIMessage("Mocked tool response")],
        };
      }),
    })),
  };
});

describe("LangGraph Agent Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createSimpleAgent", () => {
    it("creates a ReAct agent that can be invoked", async () => {
      // Create the agent
      const agent = createSimpleAgent();

      // Test the agent
      const result = await agent.invoke({
        messages: [new HumanMessage("Test input")],
      });

      // Verify the result
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]).toBeInstanceOf(HumanMessage);
      expect(result.messages[1]).toBeInstanceOf(AIMessage);
      expect(result.messages[1].content).toBe("Mocked agent response");
    });
  });

  describe("createCustomAgent", () => {
    it("creates a custom agent that can be invoked", async () => {
      // Create the custom agent
      const agent = createCustomAgent();

      // Create a test input
      const input = {
        messages: [new HumanMessage("Test input")],
      };

      // Test the agent
      const result = await agent.invoke(input);

      // Verify we have a valid result structure
      expect(result).toHaveProperty("messages");
      expect(Array.isArray(result.messages)).toBe(true);
      expect(result.messages.length).toBeGreaterThan(0);
    });
  });
});
