import { describe, it, expect } from "vitest";
import {
  serializeProposalState,
  deserializeProposalState,
} from "../state-serializer";

describe("State Serializer", () => {
  describe("serializeProposalState", () => {
    it("should create a deep copy of the state", () => {
      const state = {
        messages: [{ content: "test", role: "user" }],
        rfpDocument: "Sample RFP",
      };

      const serialized = serializeProposalState(state);

      // Modify the original state
      state.messages[0].content = "modified";
      state.rfpDocument = "Modified RFP";

      // Serialized version should not be affected
      expect(serialized.messages[0].content).toBe("test");
      expect(serialized.rfpDocument).toBe("Sample RFP");
    });

    it("should prune message history if it exceeds maxMessageHistory", () => {
      // Create a state with 60 messages
      const messages = Array.from({ length: 60 }, (_, i) => ({
        content: `Message ${i + 1}`,
        role: i % 2 === 0 ? "user" : "assistant",
      }));

      const state = { messages };

      // Set maxMessageHistory to 20
      const serialized = serializeProposalState(state, {
        maxMessageHistory: 20,
      });

      // Should keep first 5 and last 15 messages
      expect(serialized.messages.length).toBe(20);

      // First 5 messages should be preserved
      expect(serialized.messages[0].content).toBe("Message 1");
      expect(serialized.messages[4].content).toBe("Message 5");

      // Last 15 messages should be preserved
      expect(serialized.messages[5].content).toBe("Message 46");
      expect(serialized.messages[19].content).toBe("Message 60");
    });

    it("should trim large content in messages if trimLargeContent is enabled", () => {
      const largeContent = "A".repeat(15000);
      const state = {
        messages: [
          { content: largeContent, role: "user" },
          { content: "Normal message", role: "assistant" },
        ],
      };

      const serialized = serializeProposalState(state, {
        maxContentSize: 10000,
        trimLargeContent: true,
      });

      // Large message should be trimmed
      expect(serialized.messages[0].content.length).toBe(10000 + 25); // 10000 chars + trimmed message
      expect(serialized.messages[0].content).toContain(
        "... [Trimmed 5000 characters]"
      );

      // Normal message should not be affected
      expect(serialized.messages[1].content).toBe("Normal message");
    });

    it("should trim large rfpDocument if it exceeds maxContentSize", () => {
      const largeRfp = "B".repeat(20000);
      const state = {
        rfpDocument: largeRfp,
      };

      const serialized = serializeProposalState(state, {
        maxContentSize: 5000,
      });

      expect(serialized.rfpDocument.length).toBe(5000 + 25); // 5000 chars + trimmed message
      expect(serialized.rfpDocument).toContain(
        "... [Trimmed 15000 characters]"
      );
    });

    it("should convert non-JSON-serializable values to serializable format", () => {
      const date = new Date("2023-01-01");
      const set = new Set(["a", "b", "c"]);
      const map = new Map([
        ["key1", "value1"],
        ["key2", "value2"],
      ]);

      const state = {
        date,
        set,
        map,
        nested: {
          date: new Date("2023-02-01"),
          array: [
            new Set([1, 2]),
            new Map([["k", "v"]]),
            new Date("2023-03-01"),
          ],
        },
      };

      const serialized = serializeProposalState(state);

      // Date should be converted to ISO string
      expect(serialized.date).toBe(date.toISOString());

      // Set should be converted to array
      expect(Array.isArray(serialized.set)).toBe(true);
      expect(serialized.set).toEqual(["a", "b", "c"]);

      // Map should be converted to object
      expect(serialized.map).toEqual({ key1: "value1", key2: "value2" });

      // Nested conversions should work too
      expect(serialized.nested.date).toBe(new Date("2023-02-01").toISOString());
      expect(serialized.nested.array[0]).toEqual([1, 2]);
      expect(serialized.nested.array[1]).toEqual({ k: "v" });
      expect(serialized.nested.array[2]).toBe(
        new Date("2023-03-01").toISOString()
      );
    });
  });

  describe("deserializeProposalState", () => {
    it("should return the serialized state as is", () => {
      const serializedState = {
        messages: [{ content: "test", role: "user" }],
        rfpDocument: "Sample RFP",
        proposalSections: { introduction: { content: "Intro" } },
      };

      const deserialized = deserializeProposalState(serializedState);

      expect(deserialized).toEqual(serializedState);
    });
  });
});
