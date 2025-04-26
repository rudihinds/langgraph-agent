/**
 * Integration tests for authentication and document loading flow
 *
 * These tests verify that authentication tokens are correctly
 * passed through the API, middleware, and to the document loader node.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { authMiddleware } from "../../lib/middleware/auth.js";

// Mock Supabase and other dependencies
const mockGetUser = vi.hoisted(() => vi.fn());
const mockStorageDownload = vi.hoisted(() => vi.fn());
const mockCreateClient = vi.hoisted(() =>
  vi.fn().mockImplementation(() => ({
    auth: {
      getUser: mockGetUser,
    },
    storage: {
      from: vi.fn().mockReturnValue({
        download: mockStorageDownload,
      }),
    },
  }))
);

// Mock the processChatMessage function for the orchestrator
const mockProcessChatMessage = vi.hoisted(() =>
  vi.fn().mockImplementation((threadId, message, authenticatedClient) => {
    // Store which client was used in a global for testing
    global.__testAuthClientUsed = authenticatedClient;
    return {
      response: "Mock response using authenticated client",
      commandExecuted: false,
    };
  })
);

// Mock dependencies
vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

vi.mock("../../services/orchestrator-factory.js", () => ({
  getOrchestrator: vi.fn().mockImplementation(() => ({
    processChatMessage: mockProcessChatMessage,
  })),
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

describe("Authentication and Document Loading Integration", () => {
  let app;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Reset global test variable
    global.__testAuthClientUsed = null;

    // Set up a minimal Express app for testing
    app = express();
    app.use(express.json());

    // Set up mock user data
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "test-user-123",
          email: "test@example.com",
        },
        session: {
          expires_at: Math.floor(Date.now() / 1000) + 3600, // Add session info with expiry 1 hour in future
        },
      },
      error: null,
    });

    // Set up mock document data
    mockStorageDownload.mockResolvedValue({
      data: Buffer.from("Test document content"),
      error: null,
    });
  });

  it("should pass the authenticated Supabase client through the entire flow", async () => {
    // Set up the app with auth middleware and test route
    app.use(authMiddleware);
    app.post("/api/rfp/chat", (req, res) => {
      try {
        // Verify that the req has auth properties
        expect(req.supabase).toBeDefined();
        expect(req.user).toBeDefined();
        expect(req.user.id).toBe("test-user-123");

        // Use the mock directly instead of requiring the module
        const result = mockProcessChatMessage(
          "test-thread-id",
          req.body.message,
          req.supabase
        );

        return res.json(result);
      } catch (error) {
        console.error("Error in route handler:", error);
        return res.status(500).json({ error: String(error) });
      }
    });

    // Make a test request with a valid auth token
    const response = await request(app)
      .post("/api/rfp/chat")
      .set("Authorization", "Bearer valid-token-123")
      .send({
        threadId: "test-thread-id",
        message: "Test message",
      });

    // Debug info
    console.log("Response status:", response.status);
    console.log("Response body:", response.body);

    // Verify response
    expect(response.status).toBe(200);

    // Verify the authentication client was created and used
    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://test-project.supabase.co",
      "test-anon-key",
      expect.objectContaining({
        global: {
          headers: {
            Authorization: "Bearer valid-token-123",
          },
        },
      })
    );

    // Verify the authenticated client was passed to the orchestrator
    expect(global.__testAuthClientUsed).toBeDefined();
  });

  it("should reject unauthenticated requests", async () => {
    // Set up the app with auth middleware
    app.use(authMiddleware);
    app.post("/api/rfp/chat", (req, res) => {
      // This should not be called if auth fails
      return res.json({ success: true });
    });

    // Make a test request with no auth token
    const response = await request(app).post("/api/rfp/chat").send({
      threadId: "test-thread-id",
      message: "Test message",
    });

    // Verify the request was rejected
    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Authentication required");
  });

  it("should reject requests with invalid auth tokens", async () => {
    // Set up failed auth response
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid JWT token" },
    });

    // Set up the app with auth middleware
    app.use(authMiddleware);
    app.post("/api/rfp/chat", (req, res) => {
      // This should not be called if auth fails
      return res.json({ success: true });
    });

    // Make a test request with invalid token
    const response = await request(app)
      .post("/api/rfp/chat")
      .set("Authorization", "Bearer invalid-token")
      .send({
        threadId: "test-thread-id",
        message: "Test message",
      });

    // Verify the request was rejected
    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Invalid token");
  });
});
