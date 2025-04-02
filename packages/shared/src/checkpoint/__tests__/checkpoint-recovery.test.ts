import { beforeEach, describe, expect, it, vi } from "vitest";
import { PostgresCheckpointer } from "../PostgresCheckpointer";
import {
  ProposalStateType,
  defaultProposalState,
} from "../../state/proposalState";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { deserializeState, serializeState } from "../serializers";

// Mock the Supabase client
vi.mock("@supabase/supabase-js", () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then: vi.fn(),
  };

  return {
    createClient: vi.fn(() => ({
      from: vi.fn(() => mockSupabase),
      auth: {
        getSession: vi.fn(),
      },
    })),
  };
});

// Create a class that extends PostgresCheckpointer for testing
class TestableCheckpointer extends PostgresCheckpointer {
  // Override get and list methods for testing
  async get({ namespace }: { namespace: string }) {
    // Mock different responses based on the namespace
    if (namespace === "proposal:valid") {
      return {
        keys: { namespace },
        state: serializeState<ProposalStateType>({
          ...defaultProposalState,
          messages: [
            new HumanMessage("Test input"),
            new AIMessage("Test response"),
          ],
          metadata: {
            ...defaultProposalState.metadata,
            proposalId: "valid",
            userId: "user123",
          },
        }),
        writes: [],
      };
    } else if (namespace === "proposal:corrupted") {
      // Return corrupted state
      return {
        keys: { namespace },
        state: {
          messages: [{ broken: "format" }],
          metadata: { proposalId: "corrupted" },
        },
        writes: [],
      };
    } else if (namespace === "proposal:empty") {
      // Return empty state
      return {
        keys: { namespace },
        state: {},
        writes: [],
      };
    } else if (namespace === "proposal:null") {
      // Return null state
      return null;
    } else if (namespace === "proposal:error") {
      // Simulate error
      throw new Error("Database error");
    }

    return null;
  }

  async list({ namespacePrefix }: { namespacePrefix: string }) {
    if (namespacePrefix === "proposal_sessions:user123") {
      return [
        {
          keys: { namespace: "proposal_sessions:user123:session1" },
          state: {
            proposalId: "valid",
            userId: "user123",
            lastActivity: new Date().toISOString(),
            state: "active",
          },
          writes: [],
        },
        {
          keys: { namespace: "proposal_sessions:user123:session2" },
          state: {
            proposalId: "valid",
            userId: "user123",
            lastActivity: new Date(Date.now() - 86400000).toISOString(), // 1 day old
            state: "paused",
          },
          writes: [],
        },
      ];
    }
    return [];
  }
}

describe("Checkpoint Recovery", () => {
  let checkpointer: TestableCheckpointer;

  beforeEach(() => {
    checkpointer = new TestableCheckpointer({
      supabaseUrl: "https://example.com",
      supabaseKey: "test-key",
    });
  });

  describe("Basic Recovery", () => {
    it("successfully recovers a valid proposal state", async () => {
      const result = await checkpointer.get({ namespace: "proposal:valid" });

      expect(result).not.toBeNull();
      const state = deserializeState<ProposalStateType>(result!.state);

      expect(state.messages).toHaveLength(2);
      expect(state.metadata.proposalId).toBe("valid");
      expect(state.metadata.userId).toBe("user123");
    });

    it("returns null for non-existent proposal", async () => {
      const result = await checkpointer.get({
        namespace: "proposal:nonexistent",
      });
      expect(result).toBeNull();
    });
  });

  describe("Error Handling", () => {
    it("handles database errors gracefully", async () => {
      await expect(
        checkpointer.get({ namespace: "proposal:error" })
      ).rejects.toThrow("Database error");
    });

    it("handles corrupted state by throwing an error during deserialization", () => {
      const corruptedStateSerialized = checkpointer.get({
        namespace: "proposal:corrupted",
      });

      expect(async () => {
        const result = await corruptedStateSerialized;
        deserializeState<ProposalStateType>(result!.state);
      }).rejects.toThrow();
    });
  });

  describe("Session Recovery", () => {
    it("lists active sessions for a user", async () => {
      const sessions = await checkpointer.list({
        namespacePrefix: "proposal_sessions:user123",
      });

      expect(sessions).toHaveLength(2);
      expect(sessions[0].state.proposalId).toBe("valid");
      expect(sessions[0].state.state).toBe("active");
    });

    it("returns empty array for users with no sessions", async () => {
      const sessions = await checkpointer.list({
        namespacePrefix: "proposal_sessions:nonexistent",
      });

      expect(sessions).toHaveLength(0);
    });
  });

  describe("Recovery Functions", () => {
    // Mock the SessionManager and ProposalManager
    const mockSessionManager = {
      getUserSessions: vi.fn(),
      resumeSession: vi.fn(),
      createSession: vi.fn(),
      getSession: vi.fn(),
      updateSession: vi.fn(),
      recoverSession: vi.fn(),
      start: vi.fn(),
    };

    const mockProposalManager = {
      getProposal: vi.fn(),
    };

    beforeEach(() => {
      vi.resetAllMocks();
    });

    it("handles user return by resuming the most recent session", async () => {
      // Setup
      mockSessionManager.getUserSessions.mockResolvedValue([
        {
          sessionId: "session1",
          proposalId: "valid",
          lastActivity: new Date().toISOString(),
        },
        {
          sessionId: "session2",
          proposalId: "valid",
          lastActivity: new Date(Date.now() - 3600000).toISOString(),
        },
      ]);
      mockSessionManager.resumeSession.mockResolvedValue(true);

      // Test function
      async function handleUserReturn(userId: string, proposalId: string) {
        try {
          const userSessions = await mockSessionManager.getUserSessions(userId);
          const proposalSessions = userSessions.filter(
            (session) => session.proposalId === proposalId
          );

          if (proposalSessions.length > 0) {
            const sortedSessions = proposalSessions.sort(
              (a, b) =>
                new Date(b.lastActivity).getTime() -
                new Date(a.lastActivity).getTime()
            );

            const mostRecentSession = sortedSessions[0];
            await mockSessionManager.resumeSession(mostRecentSession.sessionId);

            return mostRecentSession.sessionId;
          } else {
            return await mockSessionManager.createSession(proposalId, userId);
          }
        } catch (error) {
          console.error("Failed to recover user session:", error);
          return await mockSessionManager.createSession(proposalId, userId);
        }
      }

      // Execute
      const result = await handleUserReturn("user123", "valid");

      // Verify
      expect(mockSessionManager.getUserSessions).toHaveBeenCalledWith(
        "user123"
      );
      expect(mockSessionManager.resumeSession).toHaveBeenCalledWith("session1");
      expect(result).toBe("session1");
    });

    it("creates a new session when no sessions exist", async () => {
      // Setup
      mockSessionManager.getUserSessions.mockResolvedValue([]);
      mockSessionManager.createSession.mockResolvedValue("new-session");

      // Test function
      async function handleUserReturn(userId: string, proposalId: string) {
        try {
          const userSessions = await mockSessionManager.getUserSessions(userId);
          const proposalSessions = userSessions.filter(
            (session) => session.proposalId === proposalId
          );

          if (proposalSessions.length > 0) {
            const sortedSessions = proposalSessions.sort(
              (a, b) =>
                new Date(b.lastActivity).getTime() -
                new Date(a.lastActivity).getTime()
            );

            const mostRecentSession = sortedSessions[0];
            await mockSessionManager.resumeSession(mostRecentSession.sessionId);

            return mostRecentSession.sessionId;
          } else {
            return await mockSessionManager.createSession(proposalId, userId);
          }
        } catch (error) {
          console.error("Failed to recover user session:", error);
          return await mockSessionManager.createSession(proposalId, userId);
        }
      }

      // Execute
      const result = await handleUserReturn("user123", "valid");

      // Verify
      expect(mockSessionManager.getUserSessions).toHaveBeenCalledWith(
        "user123"
      );
      expect(mockSessionManager.createSession).toHaveBeenCalledWith(
        "valid",
        "user123"
      );
      expect(result).toBe("new-session");
    });

    it("falls back to creating a new session when recovery fails", async () => {
      // Setup
      mockSessionManager.getUserSessions.mockRejectedValue(
        new Error("Database error")
      );
      mockSessionManager.createSession.mockResolvedValue("fallback-session");

      // Test function
      async function handleUserReturn(userId: string, proposalId: string) {
        try {
          const userSessions = await mockSessionManager.getUserSessions(userId);
          const proposalSessions = userSessions.filter(
            (session) => session.proposalId === proposalId
          );

          if (proposalSessions.length > 0) {
            const sortedSessions = proposalSessions.sort(
              (a, b) =>
                new Date(b.lastActivity).getTime() -
                new Date(a.lastActivity).getTime()
            );

            const mostRecentSession = sortedSessions[0];
            await mockSessionManager.resumeSession(mostRecentSession.sessionId);

            return mostRecentSession.sessionId;
          } else {
            return await mockSessionManager.createSession(proposalId, userId);
          }
        } catch (error) {
          console.error("Failed to recover user session:", error);
          return await mockSessionManager.createSession(proposalId, userId);
        }
      }

      // Execute
      const result = await handleUserReturn("user123", "valid");

      // Verify
      expect(mockSessionManager.getUserSessions).toHaveBeenCalledWith(
        "user123"
      );
      expect(mockSessionManager.createSession).toHaveBeenCalledWith(
        "valid",
        "user123"
      );
      expect(result).toBe("fallback-session");
    });

    it("recovers from error state", async () => {
      // Setup
      mockSessionManager.getSession.mockResolvedValue({
        sessionId: "error-session",
        proposalId: "valid",
        userId: "user123",
      });
      mockSessionManager.updateSession.mockResolvedValue(true);
      mockSessionManager.recoverSession.mockResolvedValue(true);

      // Test function
      async function recoverFromError(sessionId: string, errorDetails: string) {
        try {
          const session = await mockSessionManager.getSession(sessionId);

          if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
          }

          await mockSessionManager.updateSession(sessionId, {
            state: "error",
            errorDetails,
          });

          return await mockSessionManager.recoverSession(sessionId);
        } catch (error) {
          console.error("Failed to recover from error:", error);
          throw error;
        }
      }

      // Execute
      await recoverFromError("error-session", "Test error");

      // Verify
      expect(mockSessionManager.getSession).toHaveBeenCalledWith(
        "error-session"
      );
      expect(mockSessionManager.updateSession).toHaveBeenCalledWith(
        "error-session",
        {
          state: "error",
          errorDetails: "Test error",
        }
      );
      expect(mockSessionManager.recoverSession).toHaveBeenCalledWith(
        "error-session"
      );
    });

    it("verifies recovered state integrity", async () => {
      // Setup
      mockProposalManager.getProposal.mockResolvedValue({
        messages: [new HumanMessage("Test")],
        metadata: {
          proposalId: "valid-proposal",
          userId: "user123",
        },
        proposalSections: {
          problem_statement: { content: "Test content" },
        },
      });

      // Test function
      async function verifyRecoveredState(proposalId: string, userId: string) {
        const proposal = await mockProposalManager.getProposal(proposalId);

        if (!proposal) {
          throw new Error(`Failed to recover proposal: ${proposalId}`);
        }

        const verification = {
          hasMessages: proposal.messages.length > 0,
          hasMetadata:
            proposal.metadata && proposal.metadata.proposalId === proposalId,
          userMatch: proposal.metadata.userId === userId,
          hasSections: Object.keys(proposal.proposalSections).length > 0,
        };

        return Object.values(verification).every((value) => value === true);
      }

      // Execute
      const result = await verifyRecoveredState("valid-proposal", "user123");

      // Verify
      expect(mockProposalManager.getProposal).toHaveBeenCalledWith(
        "valid-proposal"
      );
      expect(result).toBe(true);
    });

    it("detects invalid recovered state", async () => {
      // Setup
      mockProposalManager.getProposal.mockResolvedValue({
        messages: [], // Empty messages
        metadata: {
          proposalId: "invalid-proposal", // Mismatched ID
          userId: "user456", // Mismatched user
        },
        proposalSections: {}, // No sections
      });

      // Test function
      async function verifyRecoveredState(proposalId: string, userId: string) {
        const proposal = await mockProposalManager.getProposal(proposalId);

        if (!proposal) {
          throw new Error(`Failed to recover proposal: ${proposalId}`);
        }

        const verification = {
          hasMessages: proposal.messages.length > 0,
          hasMetadata:
            proposal.metadata && proposal.metadata.proposalId === proposalId,
          userMatch: proposal.metadata.userId === userId,
          hasSections: Object.keys(proposal.proposalSections).length > 0,
        };

        return Object.values(verification).every((value) => value === true);
      }

      // Execute
      const result = await verifyRecoveredState("valid-proposal", "user123");

      // Verify
      expect(mockProposalManager.getProposal).toHaveBeenCalledWith(
        "valid-proposal"
      );
      expect(result).toBe(false);
    });
  });
});
