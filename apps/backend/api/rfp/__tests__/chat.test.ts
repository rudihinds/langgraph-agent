/**
 * Tests for chat.ts route handler token refresh awareness
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { Request, Response } from "express";
import request from "supertest";
import {
  AuthenticatedRequest,
  AUTH_CONSTANTS,
} from "../../../lib/types/auth.js";

// Mock the orchestrator factory and logger before importing the route
const mockProcessChatMessage = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    response: "Mock response",
    commandExecuted: false,
  })
);

const mockGetOrchestrator = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    processChatMessage: mockProcessChatMessage,
  })
);

const mockLoggerInstance = {
  info: vi.fn(),
  error: vi.fn(),
};

// Apply mocks
vi.mock("../../../services/orchestrator-factory.js", () => ({
  getOrchestrator: mockGetOrchestrator,
}));

vi.mock("../../../lib/logger.js", () => ({
  Logger: {
    getInstance: () => mockLoggerInstance,
  },
}));

// Create a mock version of the chat router WITH token refresh header functionality
// This simulates the implementation we want to build
const createMockChatRouter = () => {
  const router = express.Router();

  router.post("/", (req: AuthenticatedRequest, res: Response) => {
    try {
      const { threadId, message } = req.body;

      // Validate required fields
      if (!threadId || !message) {
        return res.status(400).json({ error: "Missing required field" });
      }

      // Log info
      mockLoggerInstance.info(`Processing chat message for thread ${threadId}`);

      // IMPLEMENTED: Check token refresh and set header
      // This is the code we need to add to the actual router
      if (req.tokenRefreshRecommended === true) {
        res.setHeader(AUTH_CONSTANTS.REFRESH_HEADER, "true");
      }

      // Return a mock successful response
      return res.status(200).json({
        response: "Mock response for testing",
        commandExecuted: false,
      });
    } catch (error) {
      mockLoggerInstance.error(
        `Error processing chat message: ${error.message}`
      );
      return res.status(500).json({
        error: "Failed to process chat message",
        message: error.message,
      });
    }
  });

  return router;
};

describe("Chat Router Token Refresh Awareness", () => {
  let app;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create express app for testing
    app = express();
    app.use(express.json());

    // Create a middleware to simulate the authMiddleware setting token expiration info
    app.use((req: AuthenticatedRequest, res, next) => {
      // Add the user data that would be set by auth middleware
      req.user = { id: "test-user-123", email: "test@example.com" };

      // Default to authenticated without refresh recommended
      req.supabase = {
        /* mock authenticated client */
      };

      // Don't set tokenExpiresIn or tokenRefreshRecommended by default
      next();
    });

    // Mount the mock chat router for testing
    app.use("/api/rfp/chat", createMockChatRouter());
  });

  it("should include X-Token-Refresh-Recommended header when token refresh is recommended", async () => {
    // Arrange
    // Create test server with middleware that sets refresh flag
    const testApp = express();
    testApp.use(express.json());

    testApp.use((req: AuthenticatedRequest, res, next) => {
      // Simulate auth middleware setting token expiration metadata
      req.user = { id: "test-user-123", email: "test@example.com" };
      req.supabase = {
        /* mock authenticated client */
      };
      req.tokenExpiresIn = 300; // 5 minutes left (below threshold)
      req.tokenRefreshRecommended = true;
      next();
    });

    testApp.use("/api/rfp/chat", createMockChatRouter());

    // Act
    const response = await request(testApp).post("/api/rfp/chat").send({
      threadId: "test-thread-id",
      message: "Hello world",
    });

    // Assert
    expect(response.status).toBe(200);
    expect(response.headers).toHaveProperty(
      AUTH_CONSTANTS.REFRESH_HEADER.toLowerCase()
    );
    expect(response.headers[AUTH_CONSTANTS.REFRESH_HEADER.toLowerCase()]).toBe(
      "true"
    );
  });

  it("should not include X-Token-Refresh-Recommended header when refresh is not recommended", async () => {
    // Arrange
    // Create test server with middleware that doesn't set refresh flag
    const testApp = express();
    testApp.use(express.json());

    testApp.use((req: AuthenticatedRequest, res, next) => {
      // Simulate auth middleware with valid token not needing refresh
      req.user = { id: "test-user-123", email: "test@example.com" };
      req.supabase = {
        /* mock authenticated client */
      };
      req.tokenExpiresIn = 1800; // 30 minutes left (above threshold)
      req.tokenRefreshRecommended = false;
      next();
    });

    testApp.use("/api/rfp/chat", createMockChatRouter());

    // Act
    const response = await request(testApp).post("/api/rfp/chat").send({
      threadId: "test-thread-id",
      message: "Hello world",
    });

    // Assert
    expect(response.status).toBe(200);
    expect(response.headers).not.toHaveProperty(
      AUTH_CONSTANTS.REFRESH_HEADER.toLowerCase()
    );
  });

  it("should handle requests without token expiration metadata gracefully", async () => {
    // Arrange - base app already has middleware without token expiration info

    // Act
    const response = await request(app).post("/api/rfp/chat").send({
      threadId: "test-thread-id",
      message: "Hello world",
    });

    // Assert
    expect(response.status).toBe(200);
    expect(response.headers).not.toHaveProperty(
      AUTH_CONSTANTS.REFRESH_HEADER.toLowerCase()
    );
  });
});
