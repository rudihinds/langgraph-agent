/**
 * Tests for authentication middleware edge case handling
 *
 * These tests verify the middleware's resilience when dealing with non-standard
 * token responses, such as missing session data or expiration timestamps.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { authMiddleware } from "../auth.js";

// Mock dependencies with vi.hoisted to handle hoisting correctly
const mockGetUser = vi.hoisted(() => vi.fn());
const mockCreateClient = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    auth: {
      getUser: mockGetUser,
    },
  })
);

// Mock the Logger
const mockLoggerInstance = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

// Apply mocks
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

describe("Auth Middleware Edge Case Handling", () => {
  // Define mocks for Express request and response
  let mockReq;
  let mockRes;
  let mockNext;

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
      set: vi.fn(),
    };

    // Set up mock next function
    mockNext = vi.fn();
  });

  it("should handle a session without expiration timestamp gracefully", async () => {
    // Arrange: Set up a valid token with session data but no expires_at property
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "test-user-id",
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

    // Assert:
    // 1. Middleware should still proceed with authentication
    expect(mockNext).toHaveBeenCalled();

    // 2. User data should be attached to the request
    expect(mockReq.user).toEqual({
      id: "test-user-id",
      email: "test@example.com",
    });

    // 3. Supabase client should be attached to the request
    expect(mockReq.supabase).toBeDefined();

    // 4. Token expiration metadata should NOT be added
    expect(mockReq.tokenExpiresIn).toBeUndefined();
    expect(mockReq.tokenRefreshRecommended).toBeUndefined();

    // 5. No headers should be set for token refresh
    expect(mockRes.setHeader).not.toHaveBeenCalled();

    // 6. Logger should warn about the missing expiration data
    expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
      "Session missing expiration timestamp",
      expect.objectContaining({
        requestId: "test-request-id",
        userId: "test-user-id",
        session: { hasExpiresAt: false },
      })
    );
  });

  it("should handle missing session data gracefully", async () => {
    // Arrange: Set up a valid token without any session data
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "test-user-id",
          email: "test@example.com",
        },
        // No session property provided
      },
      error: null,
    });

    // Act: Call the middleware
    await authMiddleware(mockReq, mockRes, mockNext);

    // Assert:
    // 1. Middleware should still proceed with authentication
    expect(mockNext).toHaveBeenCalled();

    // 2. User data should be attached to the request
    expect(mockReq.user).toEqual({
      id: "test-user-id",
      email: "test@example.com",
    });

    // 3. Supabase client should be attached to the request
    expect(mockReq.supabase).toBeDefined();

    // 4. Token expiration metadata should NOT be added
    expect(mockReq.tokenExpiresIn).toBeUndefined();
    expect(mockReq.tokenRefreshRecommended).toBeUndefined();

    // 5. No headers should be set for token refresh
    expect(mockRes.setHeader).not.toHaveBeenCalled();

    // 6. Logger should warn about the missing session data
    expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
      "Missing session data during token expiration processing",
      expect.objectContaining({
        requestId: "test-request-id",
        userId: "test-user-id",
      })
    );
  });

  it("should continue processing the request with valid user data despite missing expiration info", async () => {
    // Arrange: Set up a valid token but no session or expiration data
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "test-user-id",
          email: "test@example.com",
          app_metadata: {
            provider: "email",
          },
        },
      },
      error: null,
    });

    // Act: Call the middleware
    await authMiddleware(mockReq, mockRes, mockNext);

    // Assert:
    // 1. Middleware should proceed to next middleware/route handler
    expect(mockNext).toHaveBeenCalled();

    // 2. User data should be attached to the request
    expect(mockReq.user).toBeDefined();
    expect(mockReq.user.id).toBe("test-user-id");

    // 3. Token metadata should NOT be added
    expect(mockReq.tokenExpiresIn).toBeUndefined();
    expect(mockReq.tokenRefreshRecommended).toBeUndefined();

    // 4. Logger should warn about the missing session data
    expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
      expect.stringContaining("Missing session data"),
      expect.any(Object)
    );
  });
});
