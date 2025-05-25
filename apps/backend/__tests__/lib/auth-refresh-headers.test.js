/**
 * Tests for the authentication middleware's automatic header setting behavior
 *
 * These tests verify that the middleware correctly sets the X-Token-Refresh-Recommended
 * header for tokens that are close to expiration.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { authMiddleware } from "../auth.js";

// Mock the createClient function from Supabase using vi.hoisted
const mockGetUser = vi.hoisted(() => vi.fn());
const mockCreateClient = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    auth: {
      getUser: mockGetUser,
    },
  })
);

// Mock the Logger using vi.hoisted
const mockLoggerInstance = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

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

describe("Auth Middleware Header Setting Behavior", () => {
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

    // Set up mock response object with header tracking
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
      headers: {},
      set: vi.fn((name, value) => {
        mockRes.headers[name] = value;
        return mockRes;
      }),
    };

    // Set up mock next function
    mockNext = vi.fn();
  });

  it("should automatically set X-Token-Refresh-Recommended header for tokens expiring within threshold", async () => {
    // Arrange:
    // Set up a valid token that expires in 5 minutes (300 seconds)
    // This is within the default 10-minute (600 seconds) threshold
    const expiresInFiveMinutes = nowInSeconds() + 300;
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: { id: "test-user-id" },
        session: {
          expires_at: expiresInFiveMinutes,
        },
      },
      error: null,
    });

    // Act: Call the middleware
    await authMiddleware(mockReq, mockRes, mockNext);

    // Assert:
    // 1. Middleware should call next() to continue the request
    expect(mockNext).toHaveBeenCalled();

    // 2. Request should have tokenRefreshRecommended set to true
    expect(mockReq.tokenRefreshRecommended).toBe(true);

    // 3. Response should have X-Token-Refresh-Recommended header set
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      "X-Token-Refresh-Recommended",
      "true"
    );

    // 4. Log warning about token expiration
    expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
      expect.stringContaining("Token close to expiration"),
      expect.objectContaining({
        requestId: "test-request-id",
        userId: "test-user-id",
        timeRemaining: expect.any(Number),
      })
    );
  });

  it("should not set X-Token-Refresh-Recommended header for tokens with ample expiration time", async () => {
    // Arrange:
    // Set up a valid token that expires in 30 minutes (1800 seconds)
    // This is well beyond the default 10-minute (600 seconds) threshold
    const expiresInThirtyMinutes = nowInSeconds() + 1800;
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: { id: "test-user-id" },
        session: {
          expires_at: expiresInThirtyMinutes,
        },
      },
      error: null,
    });

    // Act: Call the middleware
    await authMiddleware(mockReq, mockRes, mockNext);

    // Assert:
    // 1. Middleware should call next() to continue the request
    expect(mockNext).toHaveBeenCalled();

    // 2. Request should have tokenRefreshRecommended set to false
    expect(mockReq.tokenRefreshRecommended).toBe(false);

    // 3. Response should NOT have X-Token-Refresh-Recommended header set
    expect(mockRes.setHeader).not.toHaveBeenCalledWith(
      "X-Token-Refresh-Recommended",
      expect.any(String)
    );

    // 4. Log info about valid authentication but no warning about expiration
    expect(mockLoggerInstance.warn).not.toHaveBeenCalledWith(
      expect.stringContaining("Token close to expiration"),
      expect.any(Object)
    );
    expect(mockLoggerInstance.info).toHaveBeenCalledWith(
      expect.stringContaining("Valid authentication"),
      expect.objectContaining({
        userId: "test-user-id",
      })
    );
  });

  it("should respect the TOKEN_REFRESH_RECOMMENDATION_THRESHOLD_SECONDS constant", async () => {
    // Arrange:
    // This test verifies that the middleware uses the defined threshold constant
    // By creating a token that expires just beyond the threshold (e.g., 11 minutes)

    // Assuming the constant is 600 seconds (10 minutes), we'll set expiration at 601 seconds
    const justBeyondThreshold = nowInSeconds() + 601;
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: { id: "test-user-id" },
        session: {
          expires_at: justBeyondThreshold,
        },
      },
      error: null,
    });

    // Act: Call the middleware
    await authMiddleware(mockReq, mockRes, mockNext);

    // Assert:
    // 1. Middleware should call next() to continue the request
    expect(mockNext).toHaveBeenCalled();

    // 2. Request should have tokenRefreshRecommended set to false
    // This verifies the threshold is being respected
    expect(mockReq.tokenRefreshRecommended).toBe(false);

    // 3. Response should NOT have X-Token-Refresh-Recommended header set
    expect(mockRes.setHeader).not.toHaveBeenCalledWith(
      "X-Token-Refresh-Recommended",
      expect.any(String)
    );
  });
});
