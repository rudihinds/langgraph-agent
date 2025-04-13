import { describe, it, expect, vi } from "vitest";
import { pruneMessageHistory } from "../lib/state/messages";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";

// Mock token counting
vi.mock("@langchain/core/language_models/count_tokens", () => {
  return {
    getModelContextSize: vi.fn().mockReturnValue(4000),
    calculateMaxTokens: vi.fn().mockImplementation((_, tokens) => 4000 - tokens),
  };
});

// Helper function to create a long message
const createLongMessage = (type: "human" | "ai" | "system", length: number) => {
  const content = "A ".repeat(length);
  if (type === "human") return new HumanMessage(content);
  if (type === "ai") return new AIMessage(content);
  return new SystemMessage(content);
};

describe("Message Pruning Tests", () => {
  describe("pruneMessageHistory", () => {
    it("returns messages unchanged when under token limit", () => {
      // Create a small set of messages
      const messages = [
        new SystemMessage("System message"),
        new HumanMessage("Human message 1"),
        new AIMessage("AI response 1"),
        new HumanMessage("Human message 2"),
        new AIMessage("AI response 2"),
      ];
      
      // Mock token counting to return small values
      vi.mocked(require("@langchain/core/language_models/count_tokens").calculateMaxTokens)
        .mockReturnValueOnce(3500);
      
      // Run the function
      const result = pruneMessageHistory(messages, {
        maxTokens: 4000,
        keepSystemMessages: true,
      });
      
      // Verify all messages are retained
      expect(result).toEqual(messages);
      expect(result.length).toBe(5);
    });
    
    it("removes oldest messages when over token limit", () => {
      // Create messages with the oldest ones exceeding the token limit
      const messages = [
        new SystemMessage("System message"),
        new HumanMessage("Old human message 1"),
        new AIMessage("Old AI response 1"),
        new HumanMessage("Recent human message"),
        new AIMessage("Recent AI response"),
      ];
      
      // Mock token counting to simulate exceeding limits
      vi.mocked(require("@langchain/core/language_models/count_tokens").calculateMaxTokens)
        .mockReturnValueOnce(-500); // Over by 500 tokens
      
      // Also mock the token counter for individual messages
      const getModelTokens = vi.fn()
        .mockReturnValueOnce(100) // System
        .mockReturnValueOnce(250) // Old human
        .mockReturnValueOnce(300) // Old AI
        .mockReturnValueOnce(200) // Recent human
        .mockReturnValueOnce(250); // Recent AI
      
      // Use our mocked function
      messages.forEach(msg => {
        (msg as any).getTokenCount = () => getModelTokens();
      });
      
      // Run the function
      const result = pruneMessageHistory(messages, {
        maxTokens: 4000,
        keepSystemMessages: true,
      });
      
      // We expect the oldest human-AI pair to be removed
      expect(result.length).toBe(3);
      expect(result[0]).toBeInstanceOf(SystemMessage);
      expect(result[1]).toBeInstanceOf(HumanMessage);
      expect(result[1].content).toBe("Recent human message");
      expect(result[2]).toBeInstanceOf(AIMessage);
      expect(result[2].content).toBe("Recent AI response");
    });
    
    it("keeps system messages when specified", () => {
      // Create messages including system messages
      const messages = [
        new SystemMessage("Important system instruction"),
        new HumanMessage("Human message 1"),
        new AIMessage("AI response 1"),
        new SystemMessage("Another system message"),
        new HumanMessage("Human message 2"),
        new AIMessage("AI response 2"),
      ];
      
      // Mock token counting to simulate exceeding limits
      vi.mocked(require("@langchain/core/language_models/count_tokens").calculateMaxTokens)
        .mockReturnValueOnce(-1000); // Significantly over limit
      
      // Token counting for individual messages
      const getModelTokens = vi.fn()
        .mockReturnValueOnce(150) // System 1
        .mockReturnValueOnce(250) // Human 1
        .mockReturnValueOnce(300) // AI 1
        .mockReturnValueOnce(150) // System 2
        .mockReturnValueOnce(250) // Human 2
        .mockReturnValueOnce(300); // AI 2
      
      // Use our mocked function
      messages.forEach(msg => {
        (msg as any).getTokenCount = () => getModelTokens();
      });
      
      // Run the function with keepSystemMessages = true
      const result = pruneMessageHistory(messages, {
        maxTokens: 4000,
        keepSystemMessages: true,
      });
      
      // We expect system messages to be kept, but oldest conversation removed
      expect(result.length).toBe(4);
      expect(result[0]).toBeInstanceOf(SystemMessage);
      expect(result[1]).toBeInstanceOf(SystemMessage);
      expect(result[2]).toBeInstanceOf(HumanMessage);
      expect(result[3]).toBeInstanceOf(AIMessage);
      expect(result[2].content).toBe("Human message 2");
    });
    
    it("removes system messages when not specified to keep them", () => {
      // Create messages including system messages
      const messages = [
        new SystemMessage("System instruction"),
        new HumanMessage("Human message 1"),
        new AIMessage("AI response 1"),
        new HumanMessage("Human message 2"),
        new AIMessage("AI response 2"),
      ];
      
      // Mock token counting to simulate exceeding limits
      vi.mocked(require("@langchain/core/language_models/count_tokens").calculateMaxTokens)
        .mockReturnValueOnce(-800); // Over limit
      
      // Token counting for individual messages
      const getModelTokens = vi.fn()
        .mockReturnValueOnce(200) // System
        .mockReturnValueOnce(200) // Human 1
        .mockReturnValueOnce(200) // AI 1
        .mockReturnValueOnce(200) // Human 2
        .mockReturnValueOnce(200); // AI 2
      
      // Use our mocked function
      messages.forEach(msg => {
        (msg as any).getTokenCount = () => getModelTokens();
      });
      
      // Run the function with keepSystemMessages = false
      const result = pruneMessageHistory(messages, {
        maxTokens: 4000,
        keepSystemMessages: false,
      });
      
      // We expect oldest messages including system to be removed
      expect(result.length).toBe(2);
      expect(result[0]).toBeInstanceOf(HumanMessage);
      expect(result[1]).toBeInstanceOf(AIMessage);
      expect(result[0].content).toBe("Human message 2");
    });
    
    it("summarizes messages when summarize option is provided", () => {
      // Create a longer conversation
      const messages = [
        new SystemMessage("System instruction"),
        new HumanMessage("Human message 1"),
        new AIMessage("AI response 1"),
        new HumanMessage("Human message 2"),
        new AIMessage("AI response 2"),
        new HumanMessage("Human message 3"),
        new AIMessage("AI response 3"),
      ];
      
      // Mock token counting to simulate exceeding limits
      vi.mocked(require("@langchain/core/language_models/count_tokens").calculateMaxTokens)
        .mockReturnValueOnce(-1200); // Over limit
      
      // Mock the summarize function
      const mockSummarize = vi.fn().mockResolvedValue(
        new AIMessage("Summarized conversation: [summary content]")
      );
      
      // Run the function with summarize option
      const result = pruneMessageHistory(messages, {
        maxTokens: 4000,
        keepSystemMessages: true,
        summarize: mockSummarize,
      });
      
      // We expect a summarized version with recent messages
      expect(mockSummarize).toHaveBeenCalled();
      expect(result.length).toBeLessThan(messages.length);
      expect(result.some(msg => 
        msg instanceof AIMessage && 
        msg.content.includes("Summarized conversation")
      )).toBe(true);
    });
  });
});