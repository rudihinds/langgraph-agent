import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";

// Create hoisted mocks
const mockServerSupabase = vi.hoisted(() => ({
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
}));

// Mock Supabase server client
vi.mock("@/lib/supabase/server.js", () => ({
  serverSupabase: mockServerSupabase,
}));

// Import after mocks
import { continueProposal } from "../rfp.js";

describe("RFP Continue Endpoint - Permission Validation", () => {
  let req;
  let res;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup request and response objects
    req = {
      params: { proposalId: "test-proposal-123" },
      query: { userId: "test-user-123" },
    } as unknown as Request;

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
  });

  it("should return 404 when user does not have access to the proposal", async () => {
    // Arrange: Setup DB to return no proposals (unauthorized access)
    mockServerSupabase.single.mockResolvedValue({
      data: null,
      error: { message: "No proposal found" },
    });

    // Act: Call the endpoint handler
    await continueProposal(req, res);

    // Assert: Check that status 404 was returned
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("not found"),
      })
    );

    // Verify correct query parameters were used
    expect(mockServerSupabase.eq).toHaveBeenCalledWith(
      "id",
      "test-proposal-123"
    );
    expect(mockServerSupabase.eq).toHaveBeenCalledWith(
      "user_id",
      "test-user-123"
    );
  });

  it("should handle database errors gracefully", async () => {
    // Arrange: Setup DB to throw an error
    mockServerSupabase.single.mockResolvedValue({
      data: null,
      error: { code: "PGRST_ERROR", message: "Database connection failed" },
    });

    // Act: Call the endpoint handler
    await continueProposal(req, res);

    // Assert: Check that appropriate error response was returned
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("Database"),
      })
    );
  });

  it("should return proposal data when user has access", async () => {
    // Arrange: Setup DB to return a proposal (authorized access)
    const mockProposal = {
      id: "test-proposal-123",
      title: "Test Proposal",
      status: "draft",
      user_id: "test-user-123",
      rfp_document_id: "test-rfp-123",
    };

    mockServerSupabase.single.mockResolvedValue({
      data: mockProposal,
      error: null,
    });

    // Act: Call the endpoint handler
    await continueProposal(req, res);

    // Assert: Check that success response with proposal data was returned
    expect(res.status).not.toHaveBeenCalled(); // No error status
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        proposalId: "test-proposal-123",
        status: "draft",
      })
    );
  });
});
