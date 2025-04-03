import { describe, it, expect, vi, beforeEach } from "vitest";
import { ThreadManager } from "../src/checkpoint/threadManager";

// Mock the uuid package
vi.mock("uuid", () => ({
  v4: vi.fn(() => "123e4567-e89b-12d3-a456-426614174000"),
}));

describe("ThreadManager", () => {
  describe("generateThreadId", () => {
    it("should generate a thread ID with the correct format", () => {
      const threadId = ThreadManager.generateThreadId({
        userId: "user123",
        proposalId: "prop456",
      });

      expect(threadId).toBe("proposal:prop456:user:user123");
    });

    it("should include subgraph if provided", () => {
      const threadId = ThreadManager.generateThreadId({
        userId: "user123",
        proposalId: "prop456",
        subgraph: "research",
      });

      expect(threadId).toBe("proposal:prop456:user:user123:subgraph:research");
    });
  });

  describe("generateProposalId", () => {
    it("should return a UUID", () => {
      const proposalId = ThreadManager.generateProposalId();
      expect(proposalId).toBe("123e4567-e89b-12d3-a456-426614174000");
    });
  });

  describe("parseThreadId", () => {
    it("should parse a valid thread ID correctly", () => {
      const result = ThreadManager.parseThreadId(
        "proposal:prop456:user:user123"
      );

      expect(result).toEqual({
        proposalId: "prop456",
        userId: "user123",
        subgraph: undefined,
      });
    });

    it("should parse a thread ID with subgraph correctly", () => {
      const result = ThreadManager.parseThreadId(
        "proposal:prop456:user:user123:subgraph:research"
      );

      expect(result).toEqual({
        proposalId: "prop456",
        userId: "user123",
        subgraph: "research",
      });
    });

    it("should return null for invalid thread ID format", () => {
      const result = ThreadManager.parseThreadId("invalid-format");
      expect(result).toBeNull();
    });
  });

  describe("isValidThreadId", () => {
    it("should return true for valid thread IDs", () => {
      expect(
        ThreadManager.isValidThreadId("proposal:prop456:user:user123")
      ).toBe(true);
      expect(
        ThreadManager.isValidThreadId(
          "proposal:prop456:user:user123:subgraph:research"
        )
      ).toBe(true);
    });

    it("should return false for invalid thread IDs", () => {
      expect(ThreadManager.isValidThreadId("invalid-format")).toBe(false);
      expect(ThreadManager.isValidThreadId("proposal:missing-user")).toBe(
        false
      );
    });
  });

  describe("getProposalThreadIds", () => {
    it("should retrieve thread IDs for a specific proposal", async () => {
      // Mock the checkpointer
      const mockCheckpointer = {
        listNamespaces: vi
          .fn()
          .mockResolvedValue([
            "proposal:prop456:user:user123",
            "proposal:prop456:user:user123:subgraph:research",
          ]),
      };

      const result = await ThreadManager.getProposalThreadIds(
        mockCheckpointer,
        "prop456"
      );

      expect(result).toEqual([
        "proposal:prop456:user:user123",
        "proposal:prop456:user:user123:subgraph:research",
      ]);

      expect(mockCheckpointer.listNamespaces).toHaveBeenCalledWith({
        match: "proposal:prop456:",
        matchType: "PREFIX",
      });
    });

    it("should handle errors and return empty array", async () => {
      // Mock the checkpointer that throws an error
      const mockCheckpointer = {
        listNamespaces: vi.fn().mockRejectedValue(new Error("Test error")),
      };

      // Mock console.error to avoid test output noise
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await ThreadManager.getProposalThreadIds(
        mockCheckpointer,
        "prop456"
      );

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();

      // Restore console.error
      consoleErrorSpy.mockRestore();
    });
  });

  describe("createNamespacePath", () => {
    it("should format namespace path correctly", () => {
      const result = ThreadManager.createNamespacePath(
        "proposal:prop456:user:user123"
      );
      expect(result).toBe("proposal:prop456:user:user123");
    });

    it("should include channel when provided", () => {
      const result = ThreadManager.createNamespacePath(
        "proposal:prop456:user:user123",
        "messages"
      );

      expect(result).toBe("proposal:prop456:user:user123:channel:messages");
    });
  });
});
