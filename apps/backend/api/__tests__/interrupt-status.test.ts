import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import { OrchestratorService } from "../../services/orchestrator.service.js";
import rfpRouter from "../rfp/index.js";
import { getOrchestrator } from "../../services/orchestrator-factory.js";

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

describe("Interrupt Status API", () => {
  let app: express.Application;
  let mockOrchestrator: {
    getInterruptStatus: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Create a mock orchestrator instance with just the methods we need
    mockOrchestrator = {
      getInterruptStatus: vi.fn(),
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

  describe("GET /rfp/interrupt-status", () => {
    it("should return 400 if proposalId is missing", async () => {
      const response = await request(app)
        .get("/rfp/interrupt-status")
        .query({});
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    it("should return correct interrupt status when not interrupted", async () => {
      // Mock the getInterruptStatus method to return a not interrupted status
      mockOrchestrator.getInterruptStatus.mockResolvedValue({
        interrupted: false,
        state: null,
      });

      const response = await request(app)
        .get("/rfp/interrupt-status")
        .query({ proposalId: "test-proposal-123" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        interrupted: false,
        state: null,
      });
      expect(mockOrchestrator.getInterruptStatus).toHaveBeenCalledWith(
        "test-proposal-123"
      );
    });

    it("should return correct interrupt status when interrupted", async () => {
      // Mock the getInterruptStatus method to return an interrupted status
      const mockState = {
        interrupted: true,
        state: {
          status: "awaiting_review",
          section: "solution",
        },
      };
      mockOrchestrator.getInterruptStatus.mockResolvedValue(mockState);

      const response = await request(app)
        .get("/rfp/interrupt-status")
        .query({ proposalId: "test-proposal-123" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockState);
      expect(mockOrchestrator.getInterruptStatus).toHaveBeenCalledWith(
        "test-proposal-123"
      );
    });

    it("should return 500 if orchestrator throws an error", async () => {
      // Mock an error in the orchestrator
      mockOrchestrator.getInterruptStatus.mockRejectedValue(
        new Error("Test error")
      );

      const response = await request(app)
        .get("/rfp/interrupt-status")
        .query({ proposalId: "test-proposal-123" });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty("error");
    });
  });
});
