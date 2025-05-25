/**
 * Tests for the rate limiting middleware
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock the Logger before importing the middleware
const mockLoggerInstance = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../../logger.js", () => ({
  Logger: {
    getInstance: () => mockLoggerInstance,
  },
}));

// Mock the current time for predictable testing
let currentTime = 0;

// Stub global Date.now before importing middleware
vi.stubGlobal("Date", {
  ...Date,
  now: vi.fn(() => currentTime),
});

// Function to advance mock time
function advanceTime(ms) {
  currentTime += ms;
}

// Mock setInterval to prevent actual interval setup
vi.stubGlobal("setInterval", vi.fn());

// Import the middleware after mocks are set up
import { rateLimitMiddleware } from "../rate-limit.js";

describe("Rate Limiting Middleware", () => {
  let app;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Reset time to zero for each test
    currentTime = 0;

    // Create an Express app for testing
    app = express();

    // Apply rate limiting middleware with testing parameters
    // 3 requests per 60 second window
    app.use(
      rateLimitMiddleware({
        windowMs: 60000, // 1 minute
        maxRequests: 3, // 3 requests per window
      })
    );

    // Add a simple test route
    app.get("/test", (req, res) => {
      res.status(200).json({ success: true });
    });
  });

  it("should allow requests under the rate limit", async () => {
    // Arrange
    const testIp = "192.168.1.1";

    // Act & Assert - Send requests under the limit
    for (let i = 0; i < 3; i++) {
      const response = await request(app)
        .get("/test")
        .set("X-Forwarded-For", testIp);

      // Each request should be allowed
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    }

    // Verify logging
    expect(mockLoggerInstance.info).toHaveBeenCalledWith(
      expect.stringContaining("Rate limit status"),
      expect.objectContaining({
        ip: testIp,
        requestCount: 3, // Third request count
        limit: 3,
      })
    );
  });

  it("should block requests over the rate limit with 429 response", async () => {
    // Arrange
    const testIp = "192.168.1.2";

    // Act - First, exhaust the rate limit
    for (let i = 0; i < 3; i++) {
      await request(app).get("/test").set("X-Forwarded-For", testIp);
    }

    // Then, attempt one more request over the limit
    const response = await request(app)
      .get("/test")
      .set("X-Forwarded-For", testIp);

    // Assert - The over-limit request should be blocked
    expect(response.status).toBe(429);
    expect(response.body).toHaveProperty("error", "Too Many Requests");
    expect(response.body).toHaveProperty("retryAfter");
    expect(response.headers).toHaveProperty("retry-after");

    // Verify rate limit exceeded log
    expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
      expect.stringContaining("Rate limit exceeded"),
      expect.objectContaining({
        ip: testIp,
        requestCount: 4, // Fourth attempt
        limit: 3,
      })
    );
  });

  it("should reset rate limit counter after the time window", async () => {
    // Arrange
    const testIp = "192.168.1.3";

    // Act - First, exhaust the rate limit
    for (let i = 0; i < 3; i++) {
      await request(app).get("/test").set("X-Forwarded-For", testIp);
    }

    // Advance time to after the window
    advanceTime(61000); // 61 seconds, just past the 60-second window

    // Make another request after the window
    const response = await request(app)
      .get("/test")
      .set("X-Forwarded-For", testIp);

    // Assert - The request should now be allowed again
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify the reset was logged
    expect(mockLoggerInstance.info).toHaveBeenCalledWith(
      expect.stringContaining("Rate limit status"),
      expect.objectContaining({
        ip: testIp,
        requestCount: 1, // Counter reset to 1
        limit: 3,
      })
    );
  });

  it("should identify different clients by IP address", async () => {
    // Arrange
    const firstIp = "192.168.1.4";
    const secondIp = "192.168.1.5";

    // Act & Assert - First client exhausts their limit
    for (let i = 0; i < 3; i++) {
      const response = await request(app)
        .get("/test")
        .set("X-Forwarded-For", firstIp);

      expect(response.status).toBe(200);
    }

    // First client is now blocked
    const blockedResponse = await request(app)
      .get("/test")
      .set("X-Forwarded-For", firstIp);

    expect(blockedResponse.status).toBe(429);

    // Second client should still be allowed
    for (let i = 0; i < 3; i++) {
      const response = await request(app)
        .get("/test")
        .set("X-Forwarded-For", secondIp);

      expect(response.status).toBe(200);
    }
  });

  it("should extract client IP correctly from various header formats", async () => {
    // Different IP formats to test
    const testCases = [
      { header: "192.168.1.10", expected: "192.168.1.10" },
      { header: "192.168.1.11, 10.0.0.1", expected: "192.168.1.11" }, // With proxy
      { header: "  192.168.1.12  ", expected: "192.168.1.12" }, // With whitespace
    ];

    for (const testCase of testCases) {
      // Make a request with the specific IP format
      const response = await request(app)
        .get("/test")
        .set("X-Forwarded-For", testCase.header);

      // Assert it was accepted
      expect(response.status).toBe(200);

      // Check if the IP was extracted correctly in the logs
      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        expect.stringContaining("Rate limit status"),
        expect.objectContaining({
          ip: testCase.expected,
        })
      );
    }
  });

  it("should use default values when options are not provided", async () => {
    // Create a new app with minimal options
    const minimalApp = express();
    minimalApp.use(rateLimitMiddleware({})); // No options specified
    minimalApp.get("/test", (req, res) =>
      res.status(200).json({ success: true })
    );

    // Make a request
    const response = await request(minimalApp)
      .get("/test")
      .set("X-Forwarded-For", "192.168.1.20");

    // Assert the request was allowed (with default settings)
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify defaults were used in logging
    expect(mockLoggerInstance.info).toHaveBeenCalledWith(
      expect.stringContaining("Rate limit status"),
      expect.objectContaining({
        limit: 60, // Default limit should be 60
      })
    );

    // Verify setInterval was called for cleanup
    expect(setInterval).toHaveBeenCalled();
  });

  it("should setup cleanup interval with provided configuration", async () => {
    // Ensure setInterval is mocked
    const setIntervalMock = vi.fn();
    vi.stubGlobal("setInterval", setIntervalMock);

    // Create app with custom cleanup interval
    const app = express();
    app.use(
      rateLimitMiddleware({
        windowMs: 30000, // 30 seconds
        maxRequests: 5,
        cleanupInterval: 300000, // 5 minutes
      })
    );

    // Verify setInterval was called with correct parameters
    expect(setIntervalMock).toHaveBeenCalledWith(expect.any(Function), 300000);
  });
});
