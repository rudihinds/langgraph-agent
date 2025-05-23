import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import { OrchestratorService } from "../../services/[dep]orchestrator.service.js";
import rfpRouter from "../rfp/index.js";
import { getOrchestrator } from "../../services/[dep]orchestrator-factory.js";

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

  // Create a class to match our actual Logger
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

describe("Resume API", () => {
  let app: express.Application;
  let mockOrchestrator: {
    resumeAfterFeedback: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Create a mock orchestrator instance with just the methods we need
    mockOrchestrator = {
      resumeAfterFeedback: vi.fn(),
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

  describe("POST /rfp/resume", () => {
    it("should return 400 if proposalId is missing", async () => {
      const response = await request(app).post("/rfp/resume").send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    it("should resume execution successfully", async () => {
      // Mock the resumeAfterFeedback method to return a success response
      mockOrchestrator.resumeAfterFeedback.mockResolvedValue({
        success: true,
        message: "Execution resumed successfully",
        status: "running",
      });

      const resumeData = {
        proposalId: "test-proposal-123",
      };

      const response = await request(app).post("/rfp/resume").send(resumeData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: "Execution resumed successfully",
        resumeStatus: {
          success: true,
          message: "Execution resumed successfully",
          status: "running",
        },
      });

      expect(mockOrchestrator.resumeAfterFeedback).toHaveBeenCalledWith(
        "test-proposal-123"
      );
    });

    it("should return 500 if orchestrator throws an error", async () => {
      // Mock an error in the orchestrator
      mockOrchestrator.resumeAfterFeedback.mockRejectedValue(
        new Error("Test error")
      );

      const response = await request(app).post("/rfp/resume").send({
        proposalId: "test-proposal-123",
      });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty("error");
    });
  });
});
