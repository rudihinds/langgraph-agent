/**
 * Tests for server action error handling
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { withErrorHandling, createServerAction } from "../server-action";
import { ErrorCodes } from "../types";
import { logger } from "@/lib/logger";

// Mock the logger
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }
}));

// Mock process.env.NODE_ENV
vi.stubEnv('NODE_ENV', 'test');

describe("Server Action Error Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  describe("withErrorHandling", () => {
    it("should handle successful actions", async () => {
      const mockHandler = vi.fn().mockResolvedValue({ id: 1, name: "Test" });
      const wrappedHandler = withErrorHandling(mockHandler, {
        actionName: "testAction",
      });
      
      const result = await wrappedHandler({ input: "test" });
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 1, name: "Test" });
      expect(mockHandler).toHaveBeenCalledWith({ input: "test" });
      expect(logger.info).toHaveBeenCalledWith("Starting server action: testAction");
      expect(logger.info).toHaveBeenCalledWith("Server action testAction completed successfully");
    });
    
    it("should handle validation errors", async () => {
      const schema = z.object({
        name: z.string().min(3),
        email: z.string().email(),
      });
      
      const mockHandler = vi.fn().mockResolvedValue({ success: true });
      const wrappedHandler = withErrorHandling(mockHandler, {
        actionName: "validationTest",
        schema,
      });
      
      const result = await wrappedHandler({ name: "a", email: "invalid" });
      
      expect(result.success).toBe(false);
      expect(result.error.code).toBe(ErrorCodes.FORM_ERROR);
      expect(result.error.details.fields.name).toBeDefined();
      expect(result.error.details.fields.email).toBeDefined();
      expect(mockHandler).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });
    
    it("should handle thrown errors", async () => {
      const mockHandler = vi.fn().mockImplementation(() => {
        throw new Error("Test error");
      });
      
      const wrappedHandler = withErrorHandling(mockHandler, {
        actionName: "errorTest",
      });
      
      const result = await wrappedHandler({ input: "test" });
      
      expect(result.success).toBe(false);
      expect(result.error.message).toBe("Test error");
      expect(result.error.code).toBe(ErrorCodes.SERVER_ERROR);
      expect(result.error.details.action).toBe("errorTest");
      expect(mockHandler).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });
    
    it("should handle returned API error responses", async () => {
      const errorResponse = {
        success: false,
        error: {
          message: "API error",
          code: ErrorCodes.AUTHENTICATION,
        }
      };
      
      const mockHandler = vi.fn().mockImplementation(() => {
        return Promise.resolve(errorResponse);
      });
      
      const wrappedHandler = withErrorHandling(mockHandler, {
        actionName: "errorResponseTest",
      });
      
      const result = await wrappedHandler({ input: "test" });
      
      expect(result).toEqual(errorResponse);
    });
    
    it("should handle FormData with transformInput", async () => {
      const formData = new FormData();
      formData.append("name", "Test Name");
      formData.append("email", "test@example.com");
      
      const mockHandler = vi.fn().mockResolvedValue({ success: true });
      const transformInput = vi.fn().mockImplementation((formData: FormData) => {
        return {
          name: formData.get("name") as string,
          email: formData.get("email") as string,
        };
      });
      
      const wrappedHandler = withErrorHandling(mockHandler, {
        actionName: "formDataTest",
        transformInput,
      });
      
      await wrappedHandler(formData);
      
      expect(transformInput).toHaveBeenCalledWith(formData);
      expect(mockHandler).toHaveBeenCalledWith({
        name: "Test Name",
        email: "test@example.com",
      });
    });
  });
  
  describe("createServerAction", () => {
    it("should create a wrapped server action", async () => {
      const mockHandler = vi.fn().mockResolvedValue({ id: 1 });
      const serverAction = createServerAction(mockHandler, {
        actionName: "createTest",
      });
      
      const result = await serverAction({ input: "test" });
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 1 });
      expect(mockHandler).toHaveBeenCalledWith({ input: "test" });
    });
  });
});