import { describe, it, expect, vi, beforeEach } from "vitest";
import { SupabaseCheckpointer } from "../lib/state/supabase";
import { ResearchState } from "../agents/research/state";

// Mock Supabase client
vi.mock("@supabase/supabase-js", () => {
  return {
    createClient: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn().mockResolvedValue({ error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockResolvedValue({ error: null }),
      auth: {
        getUser: vi.fn().mockResolvedValue({ 
          data: { user: { id: "test-user-id" } },
          error: null 
        }),
      },
    }),
  };
});

// Sample state for testing
const sampleState: Partial<ResearchState> = {
  document: {
    id: "test-doc-123",
    content: "Test document content",
    title: "Test Document",
  },
  status: "RESEARCH_NEEDED",
  deepResearchResults: {
    categories: {
      organizationBackground: {
        findings: "Test findings",
        relevanceScore: 8,
      },
    },
  },
};

describe("SupabaseCheckpointer Tests", () => {
  let checkpointer: SupabaseCheckpointer<ResearchState>;
  let mockSupabase: any;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    
    // Create a new checkpointer instance for each test
    checkpointer = new SupabaseCheckpointer<ResearchState>({
      tableName: "proposal_checkpoints",
      sessionTableName: "proposal_sessions",
    });
    
    // Get access to the mocked Supabase client
    mockSupabase = vi.mocked(require("@supabase/supabase-js").createClient());
  });

  describe("get method", () => {
    it("returns null when no checkpoint exists", async () => {
      // Configure mock to return no data
      mockSupabase.from().select().eq().single.mockResolvedValueOnce({ data: null });
      
      // Call the get method
      const result = await checkpointer.get("non-existent-thread");
      
      // Verify the result is null
      expect(result).toBeNull();
      
      // Verify Supabase was queried correctly
      expect(mockSupabase.from).toHaveBeenCalledWith("proposal_checkpoints");
      expect(mockSupabase.select).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith("thread_id", "non-existent-thread");
    });
    
    it("returns the state when checkpoint exists", async () => {
      // Configure mock to return checkpoint data
      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: {
          checkpoint_data: JSON.stringify(sampleState),
          thread_id: "existing-thread",
        },
      });
      
      // Call the get method
      const result = await checkpointer.get("existing-thread");
      
      // Verify the result matches our sample state
      expect(result).toEqual(sampleState);
    });
    
    it("handles malformed JSON data", async () => {
      // Configure mock to return invalid JSON
      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: {
          checkpoint_data: "{ invalid-json",
          thread_id: "bad-json-thread",
        },
      });
      
      // Call the get method and expect it to throw
      await expect(checkpointer.get("bad-json-thread")).rejects.toThrow();
    });
  });
  
  describe("put method", () => {
    it("creates a new checkpoint when none exists", async () => {
      // Set up mocks for checking if checkpoint exists
      mockSupabase.from().select().eq().single.mockResolvedValueOnce({ data: null });
      
      // Call the put method
      await checkpointer.put("new-thread", sampleState as ResearchState);
      
      // Verify Supabase upsert was called correctly
      expect(mockSupabase.from).toHaveBeenCalledWith("proposal_checkpoints");
      expect(mockSupabase.upsert).toHaveBeenCalledWith(expect.objectContaining({
        thread_id: "new-thread",
        checkpoint_data: JSON.stringify(sampleState),
      }));
      
      // Verify session was also updated
      expect(mockSupabase.from).toHaveBeenCalledWith("proposal_sessions");
      expect(mockSupabase.upsert).toHaveBeenCalledWith(expect.objectContaining({
        thread_id: "new-thread",
        last_active: expect.any(String),
        status: "RESEARCH_NEEDED",
      }));
    });
    
    it("updates an existing checkpoint", async () => {
      // Set up mocks for checking if checkpoint exists
      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: {
          checkpoint_data: JSON.stringify({ status: "STARTED" }),
          thread_id: "existing-thread",
        },
      });
      
      // Call the put method
      await checkpointer.put("existing-thread", sampleState as ResearchState);
      
      // Verify Supabase upsert was called correctly
      expect(mockSupabase.from).toHaveBeenCalledWith("proposal_checkpoints");
      expect(mockSupabase.upsert).toHaveBeenCalledWith(expect.objectContaining({
        thread_id: "existing-thread",
        checkpoint_data: JSON.stringify(sampleState),
      }));
    });
    
    it("handles Supabase errors", async () => {
      // Set up mock to simulate a database error
      mockSupabase.from().upsert.mockResolvedValueOnce({ error: new Error("Database error") });
      
      // Call the put method and expect it to throw
      await expect(checkpointer.put("error-thread", sampleState as ResearchState))
        .rejects.toThrow("Failed to save checkpoint");
    });
  });
  
  describe("delete method", () => {
    it("deletes an existing checkpoint", async () => {
      // Call the delete method
      await checkpointer.delete("thread-to-delete");
      
      // Verify Supabase delete was called correctly
      expect(mockSupabase.from).toHaveBeenCalledWith("proposal_checkpoints");
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith("thread_id", "thread-to-delete");
    });
    
    it("handles Supabase errors during deletion", async () => {
      // Set up mock to simulate a database error
      mockSupabase.from().delete.mockResolvedValueOnce({ error: new Error("Delete error") });
      
      // Call the delete method and expect it to throw
      await expect(checkpointer.delete("error-delete-thread"))
        .rejects.toThrow("Failed to delete checkpoint");
    });
  });
  
  describe("generateThreadId method", () => {
    it("generates a unique thread ID", () => {
      const threadId = checkpointer.generateThreadId();
      
      // Verify the thread ID is a string
      expect(typeof threadId).toBe("string");
      
      // Verify it has the expected format (UUID v4)
      expect(threadId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
    
    it("generates different IDs on each call", () => {
      const id1 = checkpointer.generateThreadId();
      const id2 = checkpointer.generateThreadId();
      
      // Verify the IDs are different
      expect(id1).not.toBe(id2);
    });
  });
});