/**
 * Tests for the authentication middleware's token refresh handling
 *
 * These tests verify that the middleware correctly detects expired tokens
 * and returns appropriate 401 responses with refresh flags when needed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { authMiddleware } from "../auth.js";

// Mock dependencies
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

vi.mock("../../logger.js", () => ({
  Logger: {
    getInstance: vi.fn(),
  },
}));

// Import after mocking
import { createClient } from "@supabase/supabase-js";
import { Logger } from "../../logger.js";

describe("Auth Middleware - Token Refresh", () => {
  // Setup mocks for each test
  const authMiddlewareMocks = {
    createClient: vi.fn(),
    getUser: vi.fn(),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };

  const mockReq = {
    headers: {
      authorization: "Bearer valid-token",
      "x-request-id": "test-request-id",
    },
  };

  const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };

  const mockNext = vi.fn();

  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();

    // Set up createClient mock
    createClient.mockImplementation(() => ({
      auth: {
        getUser: authMiddlewareMocks.getUser,
      },
    }));

    // Set up Logger.getInstance mock
    Logger.getInstance.mockReturnValue(authMiddlewareMocks.logger);

    // Set up response mock
    mockRes.status.mockReturnValue(mockRes);
    mockRes.json.mockReturnValue(mockRes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should add refresh_required flag for expired tokens", async () => {
    // Setup mock for expired token
    authMiddlewareMocks.getUser.mockResolvedValue({
      error: {
        message: "JWT expired at 2023-01-01T00:00:00",
      },
    });

    // Execute middleware
    await authMiddleware(mockReq, mockRes, mockNext);

    // Verify response
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        refresh_required: true,
      })
    );
    expect(authMiddlewareMocks.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Auth error"),
      expect.objectContaining({
        requestId: "test-request-id",
        error: expect.objectContaining({
          message: expect.stringContaining("expired"),
        }),
      })
    );
  });

  it("should not add refresh_required flag for other auth errors", async () => {
    // Setup mock for generic auth error
    authMiddlewareMocks.getUser.mockResolvedValue({
      error: {
        message: "Invalid token format",
      },
    });

    // Execute middleware
    await authMiddleware(mockReq, mockRes, mockNext);

    // Verify response
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.not.objectContaining({
        refresh_required: true,
      })
    );
    expect(authMiddlewareMocks.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Auth error"),
      expect.objectContaining({
        requestId: "test-request-id",
        error: expect.objectContaining({ message: "Invalid token format" }),
      })
    );
  });

  it("should set tokenExpiresIn and tokenRefreshRecommended for tokens close to expiration", async () => {
    // Current time in seconds (Unix timestamp)
    const currentTime = Math.floor(Date.now() / 1000);

    // Token expires in 5 minutes (300 seconds)
    const expiresAt = currentTime + 300;

    // Setup mock for valid token close to expiration
    authMiddlewareMocks.getUser.mockResolvedValue({
      data: {
        user: { id: "test-user-id" },
        session: {
          expires_at: expiresAt,
        },
      },
    });

    // Execute middleware
    await authMiddleware(mockReq, mockRes, mockNext);

    // Verify request properties and middleware behavior
    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.tokenExpiresIn).toBeCloseTo(300, -1); // Allow small timing differences
    expect(mockReq.tokenRefreshRecommended).toBe(true);
    expect(authMiddlewareMocks.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Token close to expiration"),
      expect.objectContaining({
        requestId: "test-request-id",
        timeRemaining: expect.any(Number),
      })
    );
  });

  it("should not recommend refresh for tokens with plenty of time remaining", async () => {
    // Current time in seconds (Unix timestamp)
    const currentTime = Math.floor(Date.now() / 1000);

    // Token expires in 30 minutes (1800 seconds)
    const expiresAt = currentTime + 1800;

    // Setup mock for valid token with plenty of time
    authMiddlewareMocks.getUser.mockResolvedValue({
      data: {
        user: { id: "test-user-id" },
        session: {
          expires_at: expiresAt,
        },
      },
    });

    // Execute middleware
    await authMiddleware(mockReq, mockRes, mockNext);

    // Verify request properties and middleware behavior
    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.tokenExpiresIn).toBeCloseTo(1800, -1); // Allow small timing differences
    expect(mockReq.tokenRefreshRecommended).toBe(false);

    // Ensure we didn't log a warning for a token with plenty of time
    expect(authMiddlewareMocks.logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining("Token close to expiration"),
      expect.any(Object)
    );
  });
});
