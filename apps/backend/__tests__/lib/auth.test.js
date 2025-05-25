/**
 * Tests for the authentication middleware
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { authMiddleware } from "../auth.js";

// Mock the createClient function from Supabase
const mockGetUser = vi.hoisted(() => vi.fn());
const mockCreateClient = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    auth: {
      getUser: mockGetUser,
    },
  })
);

// Mock the Logger
const mockLoggerInstance = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock the dependencies
vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

vi.mock("../../logger.js", () => ({
  Logger: {
    getInstance: () => mockLoggerInstance,
  },
}));

// Set up environment variables for tests
vi.stubEnv("SUPABASE_URL", "https://test-project.supabase.co");
vi.stubEnv("SUPABASE_ANON_KEY", "test-anon-key");

describe("Auth Middleware Token Expiration and Refresh", () => {
  // Define mocks for Express request and response
  let mockReq;
  let mockRes;
  let mockNext;

  // Helper function to calculate timestamp in seconds
  const nowInSeconds = () => Math.floor(Date.now() / 1000);

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Set up mock request object
    mockReq = {
      headers: {
        authorization: "Bearer valid-token-123",
        "x-request-id": "test-request-id",
      },
    };

    // Set up mock response object
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
    };

    // Set up mock next function
    mockNext = vi.fn();
  });

  it("should add token expiration metadata for valid tokens with ample time left", async () => {
    // Arrange: Set up a valid token with expiration time far in the future (1 hour)
    const expiresInOneHour = nowInSeconds() + 3600; // 1 hour in seconds
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "test-user-123",
          email: "test@example.com",
        },
        session: {
          expires_at: expiresInOneHour,
        },
      },
      error: null,
    });

    // Act: Call the middleware
    await authMiddleware(mockReq, mockRes, mockNext);

    // Assert: Verify token expiration metadata was added
    expect(mockNext).toHaveBeenCalled(); // Middleware passed control to next
    expect(mockReq.tokenExpiresIn).toBeDefined();
    expect(mockReq.tokenExpiresIn).toBeGreaterThan(0);
    expect(mockReq.tokenRefreshRecommended).toBe(false); // Should not recommend refresh for tokens with ample time
    expect(mockReq.user).toEqual({
      id: "test-user-123",
      email: "test@example.com",
    });
    expect(mockRes.status).not.toHaveBeenCalled(); // Should not set error status
  });

  it("should recommend token refresh when token is about to expire", async () => {
    // Arrange: Set up a valid token that will expire soon (5 minutes)
    const expiresInFiveMinutes = nowInSeconds() + 300; // 5 minutes in seconds
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "test-user-123",
          email: "test@example.com",
        },
        session: {
          expires_at: expiresInFiveMinutes,
        },
      },
      error: null,
    });

    // Act: Call the middleware
    await authMiddleware(mockReq, mockRes, mockNext);

    // Assert: Verify refresh is recommended
    expect(mockNext).toHaveBeenCalled(); // Middleware still passes control
    expect(mockReq.tokenExpiresIn).toBeDefined();
    expect(mockReq.tokenExpiresIn).toBeLessThan(600); // Less than 10 minutes (typical refresh threshold)
    expect(mockReq.tokenRefreshRecommended).toBe(true); // Should recommend refresh

    // Verify header was set to recommend refresh
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      "X-Token-Refresh-Recommended",
      "true"
    );
  });

  it("should include refresh_required flag in response for expired tokens", async () => {
    // Arrange: Set up an expired token response
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "JWT token has expired" },
    });

    // Act: Call the middleware
    await authMiddleware(mockReq, mockRes, mockNext);

    // Assert: Verify expired token handling
    expect(mockNext).not.toHaveBeenCalled(); // Should not proceed to next middleware
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Token expired",
        refresh_required: true, // Important flag for client to know refresh is needed
        message: expect.any(String),
      })
    );

    // Verify the logger was called with appropriate info
    expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
      expect.stringContaining("Token expired"),
      expect.objectContaining({
        requestId: "test-request-id",
      })
    );
  });

  it("should handle valid tokens with missing session data gracefully", async () => {
    // Arrange: Set up a valid token response but without session data
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "test-user-123",
          email: "test@example.com",
        },
        // No session property provided
      },
      error: null,
    });

    // Act: Call the middleware
    await authMiddleware(mockReq, mockRes, mockNext);

    // Assert: Verify the middleware still proceeds
    expect(mockNext).toHaveBeenCalled(); // Middleware should still pass control to next
    expect(mockReq.user).toEqual({
      id: "test-user-123",
      email: "test@example.com",
    });
    expect(mockReq.supabase).toBeDefined();

    // Verify token expiration properties were not set
    expect(mockReq.tokenExpiresIn).toBeUndefined();
    expect(mockReq.tokenRefreshRecommended).toBeUndefined();

    // Verify the logger was called with a warning about missing data
    expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
      "Missing session data during token expiration processing",
      expect.objectContaining({
        requestId: "test-request-id",
        userId: "test-user-123",
      })
    );

    // Verify no headers were set
    expect(mockRes.setHeader).not.toHaveBeenCalled();
  });

  it("should handle tokens with session but missing expiration data", async () => {
    // Arrange: Set up a valid token with session but without expiration timestamp
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "test-user-123",
          email: "test@example.com",
        },
        session: {
          // Session object exists but has no expires_at property
          access_token: "some-access-token",
          refresh_token: "some-refresh-token",
        },
      },
      error: null,
    });

    // Act: Call the middleware
    await authMiddleware(mockReq, mockRes, mockNext);

    // Assert: Verify the middleware still proceeds
    expect(mockNext).toHaveBeenCalled(); // Middleware should still pass control to next
    expect(mockReq.user).toEqual({
      id: "test-user-123",
      email: "test@example.com",
    });
    expect(mockReq.supabase).toBeDefined();

    // Verify token expiration properties were not set
    expect(mockReq.tokenExpiresIn).toBeUndefined();
    expect(mockReq.tokenRefreshRecommended).toBeUndefined();

    // Verify the logger was called with a warning about missing expiration data
    expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
      "Session missing expiration timestamp",
      expect.objectContaining({
        requestId: "test-request-id",
        userId: "test-user-123",
        session: { hasExpiresAt: false },
      })
    );

    // Verify no headers were set
    expect(mockRes.setHeader).not.toHaveBeenCalled();
  });
});
