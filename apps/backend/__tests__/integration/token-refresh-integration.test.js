/**
 * Integration tests for token refresh handling in API endpoints
 *
 * These tests verify that API endpoints correctly handle token refresh recommendations
 * and propagate the appropriate headers to clients.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { authMiddleware } from "../../lib/middleware/auth.js";

// Mock Supabase and other dependencies
const mockGetUser = vi.hoisted(() => vi.fn());
const mockCreateClient = vi.hoisted(() =>
  vi.fn().mockImplementation(() => ({
    auth: {
      getUser: mockGetUser,
    },
  }))
);

// Mock dependencies
vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

vi.mock("../../lib/logger.js", () => ({
  Logger: {
    getInstance: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

// Set up environment variables
vi.stubEnv("SUPABASE_URL", "https://test-project.supabase.co");
vi.stubEnv("SUPABASE_ANON_KEY", "test-anon-key");

describe("Token Refresh Integration with API Endpoints", () => {
  let app;

  // Helper function to calculate timestamp in seconds
  const nowInSeconds = () => Math.floor(Date.now() / 1000);

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Set up a minimal Express app for testing
    app = express();
    app.use(express.json());
  });

  it("should propagate X-Token-Refresh-Recommended header from auth middleware to client", async () => {
    // Arrange:
    // 1. Set up a token that will expire in 5 minutes (300 seconds)
    // This is within the default 10-minute threshold
    const expiresInFiveMinutes = nowInSeconds() + 300;

    mockGetUser.mockResolvedValue({
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

    // 2. Create a test API endpoint that uses the auth middleware
    app.get("/api/test-endpoint", authMiddleware, (req, res) => {
      // The auth middleware should have added tokenRefreshRecommended to the request
      // and automatically set the header, but to be thorough, we'll assert both approaches

      // Check if middleware added the flag to the request
      expect(req.tokenRefreshRecommended).toBe(true);
      expect(typeof req.tokenExpiresIn).toBe("number");

      // Send a response with any data
      res.json({ success: true, data: "Test response" });
    });

    // Act: Make a request to the endpoint with a valid token
    const response = await request(app)
      .get("/api/test-endpoint")
      .set("Authorization", "Bearer valid-token-123");

    // Assert:
    // 1. Response should be successful
    expect(response.status).toBe(200);

    // 2. Header should be set in the response
    expect(response.headers).toHaveProperty("x-token-refresh-recommended");
    expect(response.headers["x-token-refresh-recommended"]).toBe("true");

    // 3. Response body should have expected data
    expect(response.body).toEqual({ success: true, data: "Test response" });
  });

  it("should allow routes to add custom headers alongside token refresh recommendation", async () => {
    // Arrange:
    // 1. Set up a token that will expire in 4 minutes 59 seconds (299 seconds)
    // This is just under 5 minutes (300 seconds) to trigger our custom critical header
    const expiresInJustUnderFiveMinutes = nowInSeconds() + 299;

    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "test-user-123",
          email: "test@example.com",
        },
        session: {
          expires_at: expiresInJustUnderFiveMinutes,
        },
      },
      error: null,
    });

    // 2. Create a test API endpoint that uses the auth middleware and adds custom headers
    app.get("/api/custom-headers", authMiddleware, (req, res) => {
      // Add a custom header if token is about to expire soon (less than 5 minutes)
      if (req.tokenExpiresIn && req.tokenExpiresIn < 300) {
        res.set("X-Token-Critical", "true");
      }

      // Add another application-specific header
      res.set("X-API-Version", "1.0");

      // Send a response
      res.json({ success: true });
    });

    // Act: Make a request to the endpoint with a valid token
    const response = await request(app)
      .get("/api/custom-headers")
      .set("Authorization", "Bearer valid-token-123");

    // Assert:
    // 1. Response should be successful
    expect(response.status).toBe(200);

    // 2. Standard token refresh header should be set
    expect(response.headers).toHaveProperty("x-token-refresh-recommended");
    expect(response.headers["x-token-refresh-recommended"]).toBe("true");

    // 3. Custom headers should also be present
    expect(response.headers).toHaveProperty("x-token-critical");
    expect(response.headers["x-token-critical"]).toBe("true");

    expect(response.headers).toHaveProperty("x-api-version");
    expect(response.headers["x-api-version"]).toBe("1.0");
  });

  it("should provide token expiration metadata to route handlers for additional logic", async () => {
    // Arrange:
    // 1. Set up a token that will expire in 5 minutes (300 seconds)
    const expiresInFiveMinutes = nowInSeconds() + 300;

    mockGetUser.mockResolvedValue({
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

    // Mock function to track what gets passed to the route handler
    const routeHandlerSpy = vi.fn((req, res) => {
      res.json({
        tokenMetadata: {
          expiresIn: req.tokenExpiresIn,
          refreshRecommended: req.tokenRefreshRecommended,
        },
      });
    });

    // 2. Create a test API endpoint that uses the auth middleware
    app.get("/api/token-metadata", authMiddleware, routeHandlerSpy);

    // Act: Make a request to the endpoint with a valid token
    const response = await request(app)
      .get("/api/token-metadata")
      .set("Authorization", "Bearer valid-token-123");

    // Assert:
    // 1. Response should be successful
    expect(response.status).toBe(200);

    // 2. Route handler should have been called with request containing token metadata
    expect(routeHandlerSpy).toHaveBeenCalled();

    // 3. Response body should include the token metadata
    expect(response.body).toHaveProperty("tokenMetadata");
    expect(response.body.tokenMetadata).toHaveProperty("expiresIn");
    expect(typeof response.body.tokenMetadata.expiresIn).toBe("number");
    expect(response.body.tokenMetadata.expiresIn).toBeCloseTo(300, -1); // Allow for small timing differences
    expect(response.body.tokenMetadata.refreshRecommended).toBe(true);
  });
});
