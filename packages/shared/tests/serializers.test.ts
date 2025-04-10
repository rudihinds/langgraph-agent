import { describe, it, expect } from "vitest";
import {
  serializeMessage,
  deserializeMessage,
  serializeMessages,
  deserializeMessages,
  serializeState,
  deserializeState,
  SerializedMessage,
} from "../src/checkpoint/serializers";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";

describe("Message Serializers", () => {
  describe("serializeMessage", () => {
    it("should serialize AIMessage correctly", () => {
      const message = new AIMessage("AI response");
      const serialized = serializeMessage(message);

      expect(serialized).toEqual({
        type: "ai",
        data: {
          content: "AI response",
        },
      });
    });

    it("should serialize HumanMessage correctly", () => {
      const message = new HumanMessage("Human question");
      const serialized = serializeMessage(message);

      expect(serialized).toEqual({
        type: "human",
        data: {
          content: "Human question",
        },
      });
    });

    it("should serialize SystemMessage correctly", () => {
      const message = new SystemMessage("System instruction");
      const serialized = serializeMessage(message);

      expect(serialized).toEqual({
        type: "system",
        data: {
          content: "System instruction",
        },
      });
    });

    it("should include additional_kwargs when present", () => {
      const message = new AIMessage("AI response", {
        additional_kwargs: { tool_calls: [{ id: "123", type: "function" }] },
      });

      const serialized = serializeMessage(message, { includeMetadata: true });

      expect(serialized).toEqual({
        type: "ai",
        data: {
          content: "AI response",
          additional_kwargs: { tool_calls: [{ id: "123", type: "function" }] },
        },
      });
    });
  });

  describe("deserializeMessage", () => {
    it("should deserialize AIMessage correctly", () => {
      const serialized: SerializedMessage = {
        type: "ai",
        data: {
          content: "AI response",
        },
      };

      const message = deserializeMessage(serialized);

      expect(message).toBeInstanceOf(AIMessage);
      expect(message.content).toBe("AI response");
    });

    it("should deserialize HumanMessage correctly", () => {
      const serialized: SerializedMessage = {
        type: "human",
        data: {
          content: "Human question",
        },
      };

      const message = deserializeMessage(serialized);

      expect(message).toBeInstanceOf(HumanMessage);
      expect(message.content).toBe("Human question");
    });

    it("should deserialize SystemMessage correctly", () => {
      const serialized: SerializedMessage = {
        type: "system",
        data: {
          content: "System instruction",
        },
      };

      const message = deserializeMessage(serialized);

      expect(message).toBeInstanceOf(SystemMessage);
      expect(message.content).toBe("System instruction");
    });

    it("should preserve additional_kwargs when present", () => {
      const serialized: SerializedMessage = {
        type: "ai",
        data: {
          content: "AI response",
          additional_kwargs: { tool_calls: [{ id: "123", type: "function" }] },
        },
      };

      const message = deserializeMessage(serialized) as AIMessage;

      expect(message.additional_kwargs).toEqual({
        tool_calls: [{ id: "123", type: "function" }],
      });
    });
  });

  describe("serializeMessages and deserializeMessages", () => {
    it("should handle an array of messages", () => {
      const messages = [
        new HumanMessage("Hello"),
        new AIMessage("Hi there"),
        new SystemMessage("Be helpful"),
      ];

      const serialized = serializeMessages(messages);
      const deserialized = deserializeMessages(
        serialized as SerializedMessage[]
      );

      expect(deserialized[0]).toBeInstanceOf(HumanMessage);
      expect(deserialized[1]).toBeInstanceOf(AIMessage);
      expect(deserialized[2]).toBeInstanceOf(SystemMessage);

      expect((deserialized[0] as HumanMessage).content).toBe("Hello");
      expect((deserialized[1] as AIMessage).content).toBe("Hi there");
      expect((deserialized[2] as SystemMessage).content).toBe("Be helpful");
    });
  });

  describe("serializeState and deserializeState", () => {
    it("should handle objects with message arrays", () => {
      const state = {
        messages: [new HumanMessage("Hello"), new AIMessage("Hi there")],
        otherData: "some value",
        nestedData: {
          systemMessage: new SystemMessage("Be helpful"),
        },
      };

      const serialized = serializeState(state);
      const deserialized = deserializeState(serialized);

      // Check that messages array was properly serialized/deserialized
      expect(Array.isArray(deserialized.messages)).toBe(true);
      const messages = deserialized.messages as unknown[];
      expect(messages[0]).toBeInstanceOf(HumanMessage);
      expect(messages[1]).toBeInstanceOf(AIMessage);

      // Check nested message
      const nestedData = deserialized.nestedData as Record<string, unknown>;
      expect(nestedData.systemMessage).toBeInstanceOf(SystemMessage);

      // Check primitive value passed through
      expect(deserialized.otherData).toBe("some value");
    });

    it("should handle objects without any messages", () => {
      const state = {
        count: 42,
        active: true,
        data: {
          name: "Test",
          values: [1, 2, 3],
        },
      };

      const serialized = serializeState(state);
      const deserialized = deserializeState(serialized);

      expect(deserialized).toEqual(state);
    });
  });
});
