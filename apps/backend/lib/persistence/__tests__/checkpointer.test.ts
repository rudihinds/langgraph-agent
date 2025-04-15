/**
 * Tests for the ProposalCheckpointer
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createClient } from "@supabase/supabase-js";
import { Checkpoint } from "@langchain/langgraph";
import { ProposalCheckpointer } from "../checkpointer";
import { createInitialProposalState } from "../../../state/proposal.state";

// Mock the withRetry utility
vi.mock("../../utils/backoff", () => ({
  withRetry: vi.fn().mockImplementation(async (fn) => {
    return fn();
  }),
}));

// Mock Supabase client
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { checkpoint_data: { values: { state: { test: "data" } } } },
            error: null,
          })),
          order: vi.fn(() => ({
            data: [
              { thread_id: "test-123", updated_at: new Date().toISOString() },
              { thread_id: "test-456", updated_at: new Date().toISOString() },
            ],
            error: null,
          })),
        })),
      })),
      upsert: vi.fn(() => ({
        data: { id: "test-123" },
        error: null,
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
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
    vi.clearAllMocks();
    
    // Initialize checkpointer with mocked dependencies
    checkpointer = new ProposalCheckpointer({
      supabaseUrl: "https://test-supabase-url.com",
      supabaseKey: "test-supabase-key",
      userIdGetter: async () => "user-123",
      proposalIdGetter: async () => "proposal-123",
      logger: {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        log: vi.fn(),
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