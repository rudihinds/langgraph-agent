/**
 * Tests for resume.ts route handler token refresh awareness
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { Response } from "express";
import request from "supertest";
import {
  AuthenticatedRequest,
  AUTH_CONSTANTS,
} from "../../../lib/types/auth.js";

// Mock dependencies
const mockLoggerInstance = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
}));

const mockResumeAfterFeedback = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    success: true,
    message: "Graph execution resumed successfully",
    status: "running",
  })
);

const mockGetOrchestrator = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    resumeAfterFeedback: mockResumeAfterFeedback,
  })
);

// Mock the dependencies
vi.mock("../../../services/orchestrator-factory.js", () => ({
  getOrchestrator: mockGetOrchestrator,
}));

vi.mock("../../../lib/logger.js", () => ({
  Logger: {
    getInstance: () => mockLoggerInstance,
  },
}));

// Import the route handler after mocks are set up
import resumeRouter from "../resume.js";

describe("Resume Route Token Refresh Header", () => {
  let app;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create express app for testing with JSON middleware
    app = express();
    app.use(express.json());
  });

  it("should include token refresh header when token is nearing expiration", async () => {
    // Arrange
    // Create middleware that simulates auth middleware with expiring token
    app.use((req: AuthenticatedRequest, res, next) => {
      req.user = { id: "test-user-123", email: "test@example.com" };
      req.supabase = {
        // Minimal mock of SupabaseClient to satisfy TypeScript
        supabaseUrl: "https://test.supabase.co",
        supabaseKey: "test-key",
        auth: {} as any,
        from: () => ({ select: vi.fn() }),
      } as any;
      req.tokenExpiresIn = 300; // 5 minutes left (below threshold)
      req.tokenRefreshRecommended = true;
      next();
    });

    // Mount the resume router
    app.use("/api/rfp/resume", resumeRouter);

    // Act
    const response = await request(app)
      .post("/api/rfp/resume")
      .send({ proposalId: "test-proposal-id" });

    // Assert
    expect(response.status).toBe(200);
    expect(response.headers).toHaveProperty(
      AUTH_CONSTANTS.REFRESH_HEADER.toLowerCase()
    );
    expect(response.headers[AUTH_CONSTANTS.REFRESH_HEADER.toLowerCase()]).toBe(
      "true"
    );
    expect(mockResumeAfterFeedback).toHaveBeenCalledWith("test-proposal-id");
  });

  it("should not include token refresh header when token is not nearing expiration", async () => {
    // Arrange
    // Create middleware that simulates auth middleware with valid token
    app.use((req: AuthenticatedRequest, res, next) => {
      req.user = { id: "test-user-123", email: "test@example.com" };
      req.supabase = {
        // Minimal mock of SupabaseClient to satisfy TypeScript
        supabaseUrl: "https://test.supabase.co",
        supabaseKey: "test-key",
        auth: {} as any,
        from: () => ({ select: vi.fn() }),
      } as any;
      req.tokenExpiresIn = 1800; // 30 minutes left (above threshold)
      req.tokenRefreshRecommended = false;
      next();
    });

    // Mount the resume router
    app.use("/api/rfp/resume", resumeRouter);

    // Act
    const response = await request(app)
      .post("/api/rfp/resume")
      .send({ proposalId: "test-proposal-id" });

    // Assert
    expect(response.status).toBe(200);
    expect(response.headers).not.toHaveProperty(
      AUTH_CONSTANTS.REFRESH_HEADER.toLowerCase()
    );
    expect(mockResumeAfterFeedback).toHaveBeenCalledWith("test-proposal-id");
  });

  it("should handle missing token expiration metadata gracefully", async () => {
    // Arrange
    // Create middleware that simulates auth middleware without expiration info
    app.use((req: AuthenticatedRequest, res, next) => {
      req.user = { id: "test-user-123", email: "test@example.com" };
      req.supabase = {
        // Minimal mock of SupabaseClient to satisfy TypeScript
        supabaseUrl: "https://test.supabase.co",
        supabaseKey: "test-key",
        auth: {} as any,
        from: () => ({ select: vi.fn() }),
      } as any;
      // No tokenExpiresIn or tokenRefreshRecommended set
      next();
    });

    // Mount the resume router
    app.use("/api/rfp/resume", resumeRouter);

    // Act
    const response = await request(app)
      .post("/api/rfp/resume")
      .send({ proposalId: "test-proposal-id" });

    // Assert
    expect(response.status).toBe(200);
    expect(response.headers).not.toHaveProperty(
      AUTH_CONSTANTS.REFRESH_HEADER.toLowerCase()
    );
    expect(mockResumeAfterFeedback).toHaveBeenCalledWith("test-proposal-id");
  });
});
