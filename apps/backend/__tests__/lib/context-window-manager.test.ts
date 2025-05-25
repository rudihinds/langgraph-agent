import {
  ContextWindowManager,
  Message,
  PreparedMessages,
} from "../context-window-manager.js";
import { LLMFactory } from "../llm-factory.js";
import { LLMClient } from "../types.js";

// Mock LLMFactory and LLMClient
jest.mock("../llm-factory.js");
jest.mock("../llm-client.js");

describe("ContextWindowManager", () => {
  // Mock data
  const modelId = "gpt-4o";
  const contextWindow = 8000;

  // Sample messages
  const systemMessage: Message = {
    role: "system",
    content: "You are a helpful assistant.",
  };
  const userMessage1: Message = {
    role: "user",
    content: "Hello, how are you?",
  };
  const assistantMessage1: Message = {
    role: "assistant",
    content: "I'm doing well, thank you for asking. How can I help you today?",
  };
  const userMessage2: Message = {
    role: "user",
    content: "Can you help me with my project?",
  };
  const assistantMessage2: Message = {
    role: "assistant",
    content:
      "Of course! I'd be happy to help with your project. What kind of project are you working on and what assistance do you need?",
  };

  // Mock implementations
  let mockGetInstance: jest.Mock;
  let mockGetClientForModel: jest.Mock;
  let mockGetModelById: jest.Mock;
  let mockEstimateTokens: jest.Mock;
  let mockCompletion: jest.Mock;
  let mockLLMClient: jest.Mocked<LLMClient>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup LLMClient mock
    mockEstimateTokens = jest.fn();
    mockCompletion = jest.fn();
    mockLLMClient = {
      estimateTokens: mockEstimateTokens,
      completion: mockCompletion,
      streamCompletion: jest.fn(),
      supportedModels: [],
    };

    // Setup LLMFactory mock
    mockGetClientForModel = jest.fn().mockReturnValue(mockLLMClient);
    mockGetModelById = jest.fn().mockReturnValue({
      id: modelId,
      contextWindow: contextWindow,
      inputCostPer1000Tokens: 1.0,
      outputCostPer1000Tokens: 2.0,
    });
    mockGetInstance = jest.fn().mockReturnValue({
      getClientForModel: mockGetClientForModel,
      getModelById: mockGetModelById,
    });

    (LLMFactory.getInstance as jest.Mock) = mockGetInstance;
  });

  describe("prepareMessages", () => {
    it("should return messages unchanged when they fit within context window", async () => {
      // Setup token estimation to return small values (fit within context)
      mockEstimateTokens.mockResolvedValue(100);

      const messages = [systemMessage, userMessage1, assistantMessage1];

      const manager = ContextWindowManager.getInstance({ debug: true });
      const result = await manager.prepareMessages(messages, modelId);

      expect(result.wasSummarized).toBe(false);
      expect(result.messages.length).toBe(messages.length);
      expect(result.messages).toEqual(messages);
    });

    it("should truncate oldest messages when above context window but below summarization threshold", async () => {
      // First message is 500 tokens, others are 2000 each (total exceeds context window)
      mockEstimateTokens
        .mockResolvedValueOnce(500) // system message
        .mockResolvedValueOnce(2000) // user message 1
        .mockResolvedValueOnce(2000) // assistant message 1
        .mockResolvedValueOnce(2000) // user message 2
        .mockResolvedValueOnce(2000) // assistant message 2
        // For truncation calculations
        .mockResolvedValueOnce(500) // system message again
        .mockResolvedValueOnce(2000) // assistant message 2
        .mockResolvedValueOnce(2000); // user message 2

      const messages = [
        systemMessage,
        userMessage1,
        assistantMessage1,
        userMessage2,
        assistantMessage2,
      ];

      const manager = ContextWindowManager.getInstance({
        maxTokensBeforeSummarization: 10000, // High threshold to force truncation
        debug: true,
      });

      const result = await manager.prepareMessages(messages, modelId);

      // System message should always be preserved
      expect(result.messages).toContain(systemMessage);

      // Should keep only the most recent messages that fit
      expect(result.messages.length).toBeLessThan(messages.length);
      expect(result.messages).toContain(userMessage2);
      expect(result.messages).toContain(assistantMessage2);

      // Should not contain oldest messages
      expect(result.messages).not.toContain(userMessage1);
      expect(result.messages).not.toContain(assistantMessage1);

      expect(result.wasSummarized).toBe(false);
    });

    it("should summarize conversation when total tokens exceed summarization threshold", async () => {
      // Setup token estimation to return large values (exceed summarization threshold)
      mockEstimateTokens
        .mockResolvedValueOnce(500) // system message
        .mockResolvedValueOnce(3000) // user message 1
        .mockResolvedValueOnce(3000) // assistant message 1
        .mockResolvedValueOnce(3000) // user message 2
        // For summary calculation
        .mockResolvedValueOnce(500) // system message again
        .mockResolvedValueOnce(1000) // summary message
        .mockResolvedValueOnce(3000) // user message 2
        .mockResolvedValueOnce(3000); // assistant message 2

      // Mock completion to return a summary
      mockCompletion.mockResolvedValue({
        content: "A summarized conversation about helping with a project.",
      });

      const messages = [
        systemMessage,
        userMessage1,
        assistantMessage1,
        userMessage2,
        assistantMessage2,
      ];

      const manager = ContextWindowManager.getInstance({
        maxTokensBeforeSummarization: 5000, // Low threshold to force summarization
        debug: true,
      });

      const result = await manager.prepareMessages(messages, modelId);

      // Check that we have a summary
      expect(result.wasSummarized).toBe(true);

      // Should have system message, summary, and some recent messages
      const summaryMessage = result.messages.find((m) => m.isSummary);
      expect(summaryMessage).toBeDefined();
      expect(summaryMessage?.content).toContain("Conversation summary");

      // First message should be system message
      expect(result.messages[0]).toEqual(systemMessage);

      // Should include some recent messages
      expect(
        result.messages.some(
          (m) => m === userMessage2 || m === assistantMessage2
        )
      ).toBe(true);
    });

    it("should use token cache for repeated token calculations", async () => {
      // Messages with the same content should reuse token calculations
      mockEstimateTokens
        .mockResolvedValueOnce(100) // First token calculation
        .mockResolvedValueOnce(200) // Second token calculation for different content
        .mockResolvedValueOnce(300); // Third token calculation for different content

      const duplicateContent = "This is a duplicate message";
      const messages = [
        { role: "user", content: duplicateContent },
        { role: "assistant", content: "Different message 1" },
        { role: "user", content: duplicateContent }, // Should use cached value
        { role: "assistant", content: "Different message 2" },
        { role: "user", content: duplicateContent }, // Should use cached value
      ];

      const manager = ContextWindowManager.getInstance();
      await manager.prepareMessages(messages, modelId);

      // Expected to call estimateTokens only 3 times despite 5 messages
      // (once for duplicate content, once for each unique message)
      expect(mockEstimateTokens).toHaveBeenCalledTimes(3);
    });

    it("should respect custom summarizationRatio option", async () => {
      // Setup token estimation
      mockEstimateTokens.mockResolvedValue(2000); // All messages are 2000 tokens

      // Mock completion
      mockCompletion.mockResolvedValue({
        content: "Custom ratio summary.",
      });

      const messages = Array(10)
        .fill(null)
        .map((_, i) => ({
          role: i % 2 === 0 ? "user" : "assistant",
          content: `Message ${i + 1}`,
        }));

      // Create manager with custom 0.3 ratio (summarize only oldest 30%)
      const manager = ContextWindowManager.getInstance({
        maxTokensBeforeSummarization: 1000, // Ensure summarization happens
        summarizationRatio: 0.3,
        debug: true,
      });

      await manager.prepareMessages(messages, modelId);

      // Should call summarizeConversation with only the oldest 30% of messages (3 out of 10)
      expect(mockCompletion).toHaveBeenCalled();
      const promptText = mockCompletion.mock.calls[0][0].messages[1].content;

      // Expected to contain only the first 3 messages in the summarization input
      expect(promptText).toContain("Message 1");
      expect(promptText).toContain("Message 2");
      expect(promptText).toContain("Message 3");
      expect(promptText).not.toContain("Message 4");
    });
  });

  describe("summarizeConversation", () => {
    it("should generate a summary message for the conversation", async () => {
      // Mock completion to return a summary
      mockCompletion.mockResolvedValue({
        content: "A detailed summary of the previous conversation.",
      });

      const messages = [
        systemMessage,
        userMessage1,
        assistantMessage1,
        userMessage2,
      ];

      const manager = ContextWindowManager.getInstance({
        summarizationModel: "claude-3-7-sonnet",
        debug: true,
      });

      const summaryResult = await manager.summarizeConversation(messages);

      // Verify the completion was called with appropriate prompt
      expect(mockCompletion).toHaveBeenCalled();
      expect(mockCompletion.mock.calls[0][0].messages[0].content).toContain(
        "summarize the following conversation"
      );

      // Verify the returned summary message
      expect(summaryResult.role).toBe("assistant");
      expect(summaryResult.content).toContain("Conversation summary");
      expect(summaryResult.content).toContain(
        "A detailed summary of the previous conversation"
      );
      expect(summaryResult.isSummary).toBe(true);
    });

    it("should handle empty conversations gracefully", async () => {
      const manager = ContextWindowManager.getInstance();
      const result = await manager.summarizeConversation([systemMessage]);

      // Should not call completion for just system messages
      expect(mockCompletion).not.toHaveBeenCalled();

      // Should return a basic summary message
      expect(result.role).toBe("assistant");
      expect(result.content).toContain("No conversation to summarize");
      expect(result.isSummary).toBe(true);
    });
  });
});
