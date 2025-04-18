import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import { OrchestratorService } from "../../services/orchestrator.service.js";
import rfpRouter from "../rfp/index.js";
import { getOrchestrator } from "../../services/orchestrator-factory.js";
import { FeedbackType } from "../../lib/types/feedback.js";

// Mock the getOrchestrator factory function
vi.mock("../../services/orchestrator-factory.js");

// Mock the Logger
vi.mock("../../lib/logger.js", () => {
  // Create a mock logger instance that we'll return from both the constructor and getInstance
  const mockLoggerInstance = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    setLogLevel: vi.fn(),
  };

  // Create a class with getInstance method to match our actual Logger
  const MockLogger = vi.fn().mockImplementation(() => mockLoggerInstance);
  MockLogger.getInstance = vi.fn().mockReturnValue(mockLoggerInstance);

  return {
    Logger: MockLogger,
    LogLevel: {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
    },
  };
});

describe("Feedback API", () => {
  let app: express.Application;
  let mockOrchestrator: {
    submitFeedback: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Create a mock orchestrator instance with just the methods we need
    mockOrchestrator = {
      submitFeedback: vi.fn(),
    };

    // Configure the mock factory function to return our mock orchestrator
    vi.mocked(getOrchestrator).mockReturnValue(
      mockOrchestrator as unknown as OrchestratorService
    );

    // Create an express app with the rfp router
    app = express();
    app.use(express.json());
    app.use("/rfp", rfpRouter);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /rfp/feedback", () => {
    it("should return 400 if proposalId is missing", async () => {
      const response = await request(app).post("/rfp/feedback").send({
        feedbackType: FeedbackType.APPROVE,
        content: "Looks good!",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    it("should return 400 if feedbackType is missing", async () => {
      const response = await request(app).post("/rfp/feedback").send({
        proposalId: "test-proposal-123",
        content: "Missing feedback type",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    it("should process approval feedback successfully", async () => {
      // Mock the submitFeedback method to return a success response
      mockOrchestrator.submitFeedback.mockResolvedValue({ success: true });

      const response = await request(app).post("/rfp/feedback").send({
        proposalId: "test-proposal-123",
        feedbackType: FeedbackType.APPROVE,
        content: "This looks great!",
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });

      // Check that submitFeedback was called with correct parameters
      expect(mockOrchestrator.submitFeedback).toHaveBeenCalledWith(
        "test-proposal-123",
        expect.objectContaining({
          type: FeedbackType.APPROVE,
          comments: "This looks great!",
          timestamp: expect.any(String),
          contentReference: expect.any(String),
        })
      );
    });

    it("should process revision feedback successfully", async () => {
      // Mock the submitFeedback method to return a success response
      mockOrchestrator.submitFeedback.mockResolvedValue({ success: true });

      const response = await request(app).post("/rfp/feedback").send({
        proposalId: "test-proposal-123",
        feedbackType: FeedbackType.REVISE,
        content: "Please revise the solution section",
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });

      // Check that submitFeedback was called with correct parameters
      expect(mockOrchestrator.submitFeedback).toHaveBeenCalledWith(
        "test-proposal-123",
        expect.objectContaining({
          type: FeedbackType.REVISE,
          comments: "Please revise the solution section",
          timestamp: expect.any(String),
          contentReference: expect.any(String),
        })
      );
    });

    it("should process regenerate feedback successfully", async () => {
      // Mock the submitFeedback method to return a success response
      mockOrchestrator.submitFeedback.mockResolvedValue({ success: true });

      const response = await request(app).post("/rfp/feedback").send({
        proposalId: "test-proposal-123",
        feedbackType: FeedbackType.REGENERATE,
        content: "Please regenerate this completely",
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });

      // Check that submitFeedback was called with correct parameters
      expect(mockOrchestrator.submitFeedback).toHaveBeenCalledWith(
        "test-proposal-123",
        expect.objectContaining({
          type: FeedbackType.REGENERATE,
          comments: "Please regenerate this completely",
          timestamp: expect.any(String),
          contentReference: expect.any(String),
        })
      );
    });

    it("should return 500 if orchestrator throws an error", async () => {
      // Mock an error in the orchestrator
      mockOrchestrator.submitFeedback.mockRejectedValue(
        new Error("Test error")
      );

      const response = await request(app).post("/rfp/feedback").send({
        proposalId: "test-proposal-123",
        feedbackType: FeedbackType.APPROVE,
        content: "Error test",
      });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty("error");
    });
  });
});
