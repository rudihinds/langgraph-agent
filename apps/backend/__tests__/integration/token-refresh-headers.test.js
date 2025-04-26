/**
 * Tests for token refresh header integration between auth middleware and route handlers
 *
 * Verifies that route handlers correctly utilize tokenRefreshRecommended
 * from auth middleware to set appropriate response headers
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { authMiddleware } from "../../lib/middleware/auth.js";

// Mock the createClient function and getUser response from Supabase
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

// Mock the dependencies
vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

vi.mock("../../lib/logger.js", () => ({
  Logger: {
    getInstance: () => mockLoggerInstance,
  },
}));

// Set up environment variables for tests
vi.stubEnv("SUPABASE_URL", "https://test-project.supabase.co");
vi.stubEnv("SUPABASE_ANON_KEY", "test-anon-key");

describe("Token Refresh Header Integration", () => {
  let app;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Set up a minimal Express app for testing
    app = express();
    app.use(express.json());

    // Apply auth middleware
    app.use(authMiddleware);

    // Create a test endpoint that follows the pattern of setting refresh headers
    app.get("/api/test-data", (req, res) => {
      // If token is close to expiration, set the recommendation header
      if (req.tokenRefreshRecommended) {
        res.set("X-Token-Refresh-Recommended", "true");
      }

      // Add tokenExpiresIn as a header for testing purposes
      if (req.tokenExpiresIn !== undefined) {
        res.set("X-Token-Expires-In", req.tokenExpiresIn.toString());
      }

      return res.json({ success: true, data: "Test data" });
    });
  });

  it("should set refresh headers when token is close to expiration", async () => {
    // Create token that expires soon (300 seconds from now)
    const currentTime = Math.floor(Date.now() / 1000);
    const expiresAt = currentTime + 300; // Current time + 300 seconds (below threshold)

    // Mock Supabase response with proper session expiry
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: "test-user-id", email: "test@example.com" },
        session: { expires_at: expiresAt },
      },
      error: null,
    });

    // Make request with the mocked token
    const response = await request(app)
      .get("/api/test-data")
      .set("Authorization", "Bearer mock-token");

    // Verify headers for token near expiration
    expect(response.status).toBe(200);
    expect(response.headers["x-token-refresh-recommended"]).toBe("true");
    expect(response.headers["x-token-expires-in"]).toBeTruthy();
    expect(parseInt(response.headers["x-token-expires-in"], 10)).toBe(300);

    // Verify logger was called with appropriate warning
    expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
      "Token close to expiration",
      expect.objectContaining({
        timeRemaining: expect.any(Number),
        userId: "test-user-id",
      })
    );
  });

  it("should not set refresh headers when token expiry is far in the future", async () => {
    // Create token that expires in the distant future (1200 seconds from now)
    const currentTime = Math.floor(Date.now() / 1000);
    const expiresAt = currentTime + 1200; // Current time + 1200 seconds (above threshold)

    // Mock Supabase response with proper session expiry
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: "test-user-id", email: "test@example.com" },
        session: { expires_at: expiresAt },
      },
      error: null,
    });

    // Make request with the mocked token
    const response = await request(app)
      .get("/api/test-data")
      .set("Authorization", "Bearer mock-token");

    // Verify headers for token far from expiration
    expect(response.status).toBe(200);
    expect(response.headers["x-token-refresh-recommended"]).toBeUndefined();
    expect(response.headers["x-token-expires-in"]).toBeTruthy();
    expect(parseInt(response.headers["x-token-expires-in"], 10)).toBe(1200);

    // Verify that the warning log was not called
    expect(mockLoggerInstance.warn).not.toHaveBeenCalledWith(
      "Token close to expiration",
      expect.any(Object)
    );

    // Verify that the info log was called instead
    expect(mockLoggerInstance.info).toHaveBeenCalledWith(
      "Valid authentication",
      expect.objectContaining({
        userId: "test-user-id",
        tokenExpiresIn: expect.any(Number),
      })
    );
  });

  it("should handle token exactly at the threshold boundary correctly", async () => {
    // Create token that expires exactly at the threshold (600 seconds from now)
    const currentTime = Math.floor(Date.now() / 1000);
    const expiresAt = currentTime + 600; // Current time + 600 seconds (exact threshold)

    // Mock Supabase response with proper session expiry
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: "test-user-id", email: "test@example.com" },
        session: { expires_at: expiresAt },
      },
      error: null,
    });

    // Make request with the mocked token
    const response = await request(app)
      .get("/api/test-data")
      .set("Authorization", "Bearer mock-token");

    // The implementation should set this header to 'true' for
    // a token at exactly the 600 second threshold
    expect(response.status).toBe(200);
    expect(response.headers["x-token-refresh-recommended"]).toBe("true");
    expect(response.headers["x-token-expires-in"]).toBeTruthy();
    expect(parseInt(response.headers["x-token-expires-in"], 10)).toBe(600);
  });
});
