/**
 * Test suite for message truncation utilities
 */

import {
  estimateTokenCount,
  estimateMessageTokens,
  truncateMessages,
  createMinimalMessageSet,
  progressiveTruncation,
  TruncationLevel,
  TruncateMessagesOptions,
} from "../message-truncation.js";
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  BaseMessage,
} from "@langchain/core/messages";

describe("Message Truncation Utilities", () => {
  describe("estimateTokenCount", () => {
    test("should estimate tokens based on character count", () => {
      expect(estimateTokenCount("")).toBe(0);
      expect(estimateTokenCount("hello")).toBe(2); // 5 chars / 4 = ceil(1.25) = 2
      expect(estimateTokenCount("This is a longer sentence.")).toBe(7); // 27 chars / 4 = ceil(6.75) = 7
    });

    test("should round up fractional tokens", () => {
      expect(estimateTokenCount("a")).toBe(1); // 1 char / 4 = ceil(0.25) = 1
      expect(estimateTokenCount("abc")).toBe(1); // 3 chars / 4 = ceil(0.75) = 1
      expect(estimateTokenCount("abcd")).toBe(1); // 4 chars / 4 = ceil(1) = 1
      expect(estimateTokenCount("abcde")).toBe(2); // 5 chars / 4 = ceil(1.25) = 2
    });
  });

  describe("estimateMessageTokens", () => {
    test("should estimate tokens for simple messages", () => {
      const messages: BaseMessage[] = [
        new SystemMessage("You are a helpful assistant."), // 7 tokens (32 chars / 4 = 8) + 4 overhead = 12
        new HumanMessage("Hi, how are you?"), // 5 tokens (18 chars / 4 = 4.5 = 5) + 4 overhead = 9
        new AIMessage({ content: "I'm doing well, thank you!" }), // 7 tokens (27 chars / 4 = 6.75 = 7) + 4 overhead = 11
      ];

      // Total should be approximately 32 tokens
      const estimated = estimateMessageTokens(messages);
      expect(estimated).toBeGreaterThan(25);
      expect(estimated).toBeLessThan(40);
    });

    test("should handle empty messages", () => {
      const messages: BaseMessage[] = [
        new SystemMessage(""),
        new HumanMessage(""),
        new AIMessage({ content: "" }),
      ];

      // Just overhead - 4 tokens per message
      expect(estimateMessageTokens(messages)).toBe(12);
    });

    test("should handle messages with tool calls", () => {
      const messageWithToolCalls = new AIMessage({
        content: "I'll check the weather for you.",
        tool_calls: [
          {
            id: "tool-1",
            type: "function",
            function: {
              name: "get_weather",
              arguments: JSON.stringify({ location: "San Francisco" }),
            },
          },
        ],
      });

      const estimated = estimateMessageTokens([messageWithToolCalls]);
      expect(estimated).toBeGreaterThan(15); // Base message + tool call overhead
    });
  });

  describe("truncateMessages", () => {
    // Create a test conversation with a mix of message types
    const createTestConversation = (
      messageCount: number = 10
    ): BaseMessage[] => {
      const messages: BaseMessage[] = [
        new SystemMessage("You are a helpful assistant."),
      ];

      for (let i = 0; i < messageCount; i++) {
        if (i % 2 === 0) {
          messages.push(new HumanMessage(`Human message ${i}`));
        } else {
          messages.push(new AIMessage({ content: `AI response ${i}` }));
        }
      }

      return messages;
    };

    test("should not modify messages under the token limit", () => {
      const messages = createTestConversation(3);
      const options: TruncateMessagesOptions = {
        maxTokens: 1000,
        strategy: "sliding-window",
      };

      const truncated = truncateMessages(messages, options);
      expect(truncated).toEqual(messages);
      expect(truncated.length).toBe(messages.length);
    });

    describe("sliding-window strategy", () => {
      test("should keep system message and most recent messages", () => {
        const messages = createTestConversation(10);
        const options: TruncateMessagesOptions = {
          maxTokens: 50, // Very low limit to force truncation
          strategy: "sliding-window",
          preserveInitialCount: 1,
          preserveRecentCount: 4,
        };

        const truncated = truncateMessages(messages, options);

        // Should keep system message (index 0) and 4 most recent (indices 7-10)
        expect(truncated.length).toBe(5);
        expect(truncated[0]).toBe(messages[0]); // System message
        expect(truncated[1]).toBe(messages[messages.length - 4]); // 4th from end
        expect(truncated[4]).toBe(messages[messages.length - 1]); // Last message
      });

      test("should handle very restrictive token limits", () => {
        const messages = createTestConversation(10);
        const options: TruncateMessagesOptions = {
          maxTokens: 10, // Extremely low limit
          strategy: "sliding-window",
        };

        const truncated = truncateMessages(messages, options);

        // In extreme case, should just keep system message and last message
        expect(truncated.length).toBe(2);
        expect(truncated[0]).toBe(messages[0]); // System message
        expect(truncated[1]).toBe(messages[messages.length - 1]); // Last message
      });
    });

    describe("drop-middle strategy", () => {
      test("should keep beginning and end, dropping middle messages", () => {
        const messages = createTestConversation(10);
        const options: TruncateMessagesOptions = {
          maxTokens: 50, // Low limit to force truncation
          strategy: "drop-middle",
          preserveInitialCount: 1,
          preserveRecentCount: 3,
        };

        const truncated = truncateMessages(messages, options);

        // Should keep system message and recent messages
        expect(truncated.length).toBeLessThan(messages.length);
        expect(truncated[0]).toBe(messages[0]); // System message

        // Last messages should be preserved
        const lastIndex = truncated.length - 1;
        expect(truncated[lastIndex]).toBe(messages[messages.length - 1]);
        expect(truncated[lastIndex - 1]).toBe(messages[messages.length - 2]);
        expect(truncated[lastIndex - 2]).toBe(messages[messages.length - 3]);
      });

      test("should return just endpoints if no middle messages fit", () => {
        const messages = createTestConversation(10);
        const options: TruncateMessagesOptions = {
          maxTokens: 25, // Very low limit
          strategy: "drop-middle",
          preserveInitialCount: 1,
          preserveRecentCount: 2,
        };

        const truncated = truncateMessages(messages, options);

        // Should be just system + recent messages
        expect(truncated.length).toBe(3);
        expect(truncated[0]).toBe(messages[0]); // System
        expect(truncated[1]).toBe(messages[messages.length - 2]); // Second-to-last
        expect(truncated[2]).toBe(messages[messages.length - 1]); // Last
      });
    });

    describe("summarize strategy", () => {
      test("should fall back to sliding-window for now", () => {
        const messages = createTestConversation(10);
        const options: TruncateMessagesOptions = {
          maxTokens: 50,
          strategy: "summarize",
        };

        const truncated = truncateMessages(messages, options);

        // Should use sliding window as fallback
        expect(truncated.length).toBeLessThan(messages.length);
        expect(truncated[0]).toBe(messages[0]); // System message kept
        expect(truncated[truncated.length - 1]).toBe(
          messages[messages.length - 1]
        ); // Last message kept
      });
    });
  });

  describe("createMinimalMessageSet", () => {
    test("should keep first and last message only", () => {
      const messages = [
        new SystemMessage("System message"),
        new HumanMessage("First human message"),
        new AIMessage({ content: "First AI response" }),
        new HumanMessage("Second human message"),
        new AIMessage({ content: "Second AI response" }),
      ];

      const minimal = createMinimalMessageSet(messages);

      expect(minimal.length).toBe(2);
      expect(minimal[0]).toBe(messages[0]); // First message (system)
      expect(minimal[1]).toBe(messages[messages.length - 1]); // Last message
    });

    test("should return original array if 2 or fewer messages", () => {
      const singleMessage = [new SystemMessage("System message")];
      expect(createMinimalMessageSet(singleMessage)).toBe(singleMessage);

      const twoMessages = [
        new SystemMessage("System message"),
        new HumanMessage("Human message"),
      ];
      expect(createMinimalMessageSet(twoMessages)).toBe(twoMessages);
    });
  });

  describe("progressiveTruncation", () => {
    // Create a test conversation with many messages
    const createLongConversation = (): BaseMessage[] => {
      const messages: BaseMessage[] = [
        new SystemMessage("You are a helpful assistant."),
      ];

      for (let i = 0; i < 20; i++) {
        if (i % 2 === 0) {
          messages.push(
            new HumanMessage(
              `Human message ${i}. This is a bit longer to use more tokens.`
            )
          );
        } else {
          messages.push(
            new AIMessage({
              content: `AI response ${i}. This is also a bit longer to ensure we exceed token limits quickly.`,
            })
          );
        }
      }

      return messages;
    };

    test("should not truncate if under token limit", () => {
      const messages = [
        new SystemMessage("System message"),
        new HumanMessage("Human message"),
        new AIMessage({ content: "AI response" }),
      ];

      const { messages: truncated, level } = progressiveTruncation(
        messages,
        1000
      );

      expect(truncated).toBe(messages); // Should be same reference if unchanged
      expect(level).toBe(TruncationLevel.NONE);
    });

    test("should apply appropriate truncation level based on token limit", () => {
      const messages = createLongConversation();
      const initialLength = messages.length;

      // Set a token limit that will require truncation
      const { messages: truncated, level } = progressiveTruncation(
        messages,
        100
      );

      expect(level).toBe(TruncationLevel.MODERATE);
      expect(truncated.length).toBeLessThan(initialLength);
      expect(truncated.length).toBeGreaterThan(2); // Should keep more than just first and last
    });

    test("should progress to more aggressive truncation as needed", () => {
      const messages = createLongConversation();

      // Force starting with moderate truncation
      const { messages: truncated, level } = progressiveTruncation(
        messages,
        50, // Very low limit to force aggressive truncation
        TruncationLevel.MODERATE
      );

      // Should be MODERATE or more aggressive
      expect([
        TruncationLevel.MODERATE,
        TruncationLevel.AGGRESSIVE,
        TruncationLevel.EXTREME,
      ]).toContain(level);

      // Should have significantly fewer messages
      expect(truncated.length).toBeLessThan(messages.length / 2);
    });

    test("should fall back to extreme truncation when needed", () => {
      const messages = createLongConversation();

      // Force minimal token limit
      const { messages: truncated, level } = progressiveTruncation(
        messages,
        10, // Impossible token limit
        TruncationLevel.AGGRESSIVE
      );

      expect(level).toBe(TruncationLevel.EXTREME);
      expect(truncated.length).toBe(2); // Just first and last message
      expect(truncated[0]).toBe(messages[0]); // First message (system)
      expect(truncated[1]).toBe(messages[messages.length - 1]); // Last message
    });
  });
});

describe("Error Handling in Message Truncation", () => {
  test("should handle invalid input gracefully", () => {
    // Test with null input
    const result = truncateMessages(null as any, { maxTokens: 100 });
    expect(result).toEqual([]);

    // Test with empty array
    const emptyResult = truncateMessages([], { maxTokens: 100 });
    expect(emptyResult).toEqual([]);
  });

  test("should handle very low token limits by keeping only essential messages", () => {
    const messages = [
      new SystemMessage("System message"),
      new HumanMessage("First human message"),
      new AIMessage({ content: "First AI response" }),
      new HumanMessage("Second human message"),
      new AIMessage({ content: "Second AI response" }),
    ];

    // Extremely low token limit
    const result = truncateMessages(messages, {
      maxTokens: 1,
      strategy: "sliding-window",
    });

    // Should keep at minimum the system message and last message
    expect(result.length).toBe(2);
    expect(result[0]).toBe(messages[0]); // System message
    expect(result[1]).toBe(messages[4]); // Last message
  });

  test("progressiveTruncation should fall back to extreme truncation when needed", () => {
    const messages = [
      new SystemMessage("System message"),
      new HumanMessage("First human message"),
      new AIMessage({ content: "First AI response" }),
      new HumanMessage("Second human message"),
      new AIMessage({ content: "Second AI response" }),
    ];

    // Set token limit impossibly low
    const result = progressiveTruncation(messages, 1);

    // Should have applied extreme truncation
    expect(result.level).toBe(TruncationLevel.EXTREME);
    expect(result.messages.length).toBe(2);
    expect(result.messages[0]).toBe(messages[0]); // System message
    expect(result.messages[1]).toBe(messages[4]); // Last message
  });

  test("createMinimalMessageSet should handle edge cases", () => {
    // Empty array
    expect(createMinimalMessageSet([])).toEqual([]);

    // Single message
    const singleMessage = [new SystemMessage("System message")];
    expect(createMinimalMessageSet(singleMessage)).toBe(singleMessage);

    // No system message
    const noSystemMessages = [
      new HumanMessage("Human message 1"),
      new AIMessage({ content: "AI response" }),
      new HumanMessage("Human message 2"),
    ];

    const minimalNoSystem = createMinimalMessageSet(noSystemMessages);
    expect(minimalNoSystem.length).toBe(2);
    expect(minimalNoSystem[0]).toBe(noSystemMessages[0]); // First message
    expect(minimalNoSystem[1]).toBe(noSystemMessages[2]); // Last message
  });
});
