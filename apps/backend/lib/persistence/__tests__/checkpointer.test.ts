/**
 * Tests for the ProposalCheckpointer
 */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createClient } from "@supabase/supabase-js";
import { Checkpoint } from "@langchain/langgraph";
import { ProposalCheckpointer } from "../checkpointer";
import { OverallProposalState, createInitialProposalState } from "../../../state/proposal.state";

// Mock the withRetry utility
jest.mock("../../utils/backoff", () => ({
  withRetry: jest.fn().mockImplementation(async (fn) => {
    return fn();
  }),
}));

// Mock Supabase client
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({
            data: { checkpoint_data: { values: { state: { test: "data" } } } },
            error: null,
          })),
          order: jest.fn(() => ({
            data: [
              { thread_id: "test-123", updated_at: new Date().toISOString() },
              { thread_id: "test-456", updated_at: new Date().toISOString() },
            ],
            error: null,
          })),
        })),
      })),
      upsert: jest.fn(() => ({
        data: { id: "test-123" },
        error: null,
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => ({
          data: null,
          error: null,
        })),
      })),
    })),
  })),
}));

describe("ProposalCheckpointer", () => {
  let checkpointer: ProposalCheckpointer;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Initialize checkpointer with mocked dependencies
    checkpointer = new ProposalCheckpointer({
      supabaseUrl: "https://test-supabase-url.com",
      supabaseKey: "test-supabase-key",
      userIdGetter: async () => "user-123",
      proposalIdGetter: async () => "proposal-123",
      logger: {
        warn: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
        log: jest.fn(),
      } as unknown as Console,
    });
  });
  
  describe("generateThreadId", () => {
    it("should generate a consistent thread ID format", () => {
      const threadId = ProposalCheckpointer.generateThreadId("proposal-123", "research");
      
      expect(typeof threadId).toBe("string");
      expect(threadId).toMatch(/^research_proposal-123_\d+$/);
    });
    
    it("should use default component name if not provided", () => {
      const threadId = ProposalCheckpointer.generateThreadId("proposal-123");
      
      expect(threadId).toMatch(/^proposal_proposal-123_\d+$/);
    });
  });
  
  describe("get", () => {
    it("should get a checkpoint", async () => {
      const checkpoint = await checkpointer.get("test-123");
      
      expect(checkpoint).toBeDefined();
      expect(checkpoint?.values.state.test).toBe("data");
    });
  });
  
  describe("put", () => {
    it("should enrich checkpoint with metadata", async () => {
      // Create test state
      const state = createInitialProposalState("test-thread", "user-123", "Test Project");
      
      // Create checkpoint with state
      const checkpoint: Checkpoint = {
        values: {
          state: state,
        },
        config: {},
      };
      
      await checkpointer.put("test-123", checkpoint);
      
      // The state should have been enriched with userId
      expect(state.userId).toBe("user-123");
      expect(state.lastUpdatedAt).toBeDefined();
    });
  });
  
  describe("delete", () => {
    it("should delete a checkpoint", async () => {
      await checkpointer.delete("test-123");
      // If it doesn't throw, it succeeded
    });
  });
  
  describe("listUserCheckpoints", () => {
    it("should list checkpoints for a user", async () => {
      const checkpoints = await checkpointer.listUserCheckpoints("user-123");
      
      expect(checkpoints).toHaveLength(2);
      expect(checkpoints[0].thread_id).toBe("test-123");
      expect(checkpoints[1].thread_id).toBe("test-456");
    });
  });
});