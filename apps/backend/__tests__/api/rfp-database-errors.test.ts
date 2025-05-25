import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";

// Create hoisted mocks
const mockServerSupabase = vi.hoisted(() => ({
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
}));

// Mock Supabase server client
vi.mock("@/lib/supabase/server.js", () => ({
  serverSupabase: mockServerSupabase,
}));

// Mock console to suppress error outputs during tests
vi.mock("console", () => ({
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
}));

// Import after mocks
import { continueProposal } from "../rfp.js";

describe("RFP API Database Error Handling", () => {
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

  it("should handle database connection failures gracefully", async () => {
    // Arrange: Setup Supabase to throw a connection error
    mockServerSupabase.single.mockImplementation(() => {
      throw new Error("Database connection failed");
    });

    // Act: Call the endpoint handler
    await continueProposal(req, res);

    // Assert: Check for correct error handling
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("Database error"),
      })
    );
  });

  it("should handle PGRST database errors with proper status code", async () => {
    // Arrange: Setup Supabase to return a database-specific error
    mockServerSupabase.single.mockResolvedValue({
      data: null,
      error: {
        code: "PGRST_ERROR",
        message: "Database constraint violation",
      },
    });

    // Act: Call the endpoint handler
    await continueProposal(req, res);

    // Assert: Check for correct error handling with 500 status
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("Database error"),
      })
    );
  });

  it("should handle transient database timeouts", async () => {
    // Arrange: Setup Supabase to simulate a timeout error
    mockServerSupabase.single.mockImplementation(() => {
      const timeoutError = new Error("Database query timed out");
      timeoutError.name = "TimeoutError";
      throw timeoutError;
    });

    // Act: Call the endpoint handler
    await continueProposal(req, res);

    // Assert: Check for appropriate error response
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringMatching(/Database error.*timed out/i),
      })
    );
  });

  it("should handle database errors during proposal lookup", async () => {
    // Arrange: Setup multi-step Supabase interaction with failure
    mockServerSupabase.from.mockReturnThis();
    mockServerSupabase.select.mockReturnThis();
    mockServerSupabase.eq.mockReturnThis();

    // Make the second eq call throw an error to simulate failure mid-query
    mockServerSupabase.eq
      .mockImplementationOnce(() => {
        return mockServerSupabase; // First call succeeds
      })
      .mockImplementationOnce(() => {
        throw new Error("Database error during query building");
      });

    // Act: Call the endpoint handler
    await continueProposal(req, res);

    // Assert: Check for correct error handling
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("Database error"),
      })
    );
  });
});
