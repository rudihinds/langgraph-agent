/**
 * Tests for form error handling utilities
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { 
  formatZodError, 
  createFormErrorResponse, 
  extractFieldErrors,
  hasFieldError,
  getFieldError
} from "../form-errors";
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

describe("Form Error Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  describe("formatZodError", () => {
    it("should format Zod errors correctly", () => {
      // Create a test schema
      const schema = z.object({
        name: z.string().min(3, "Name must be at least 3 characters"),
        email: z.string().email("Invalid email format"),
      });
      
      // Create a validation error
      let error;
      try {
        schema.parse({ name: "ab", email: "not-an-email" });
      } catch (e) {
        error = e;
      }
      
      // Format the error
      const formatted = formatZodError(error);
      
      // Check the result
      expect(formatted.code).toBe(ErrorCodes.FORM_ERROR);
      expect(formatted.message).toBe("Validation failed");
      expect(formatted.details.fields.name).toBe("Name must be at least 3 characters");
      expect(formatted.details.fields.email).toBe("Invalid email format");
    });
  });
  
  describe("createFormErrorResponse", () => {
    it("should handle ZodError correctly", () => {
      // Create a test schema
      const schema = z.object({
        name: z.string().min(3),
      });
      
      // Create a validation error
      let error;
      try {
        schema.parse({ name: "ab" });
      } catch (e) {
        error = e;
      }
      
      // Format the error
      const response = createFormErrorResponse(error, "test-form");
      
      // Check the result
      expect(response.success).toBe(false);
      expect(response.error.code).toBe(ErrorCodes.FORM_ERROR);
      expect(response.error.details.fields.name).toBeDefined();
      expect(logger.error).toHaveBeenCalledWith(
        "Form error in test-form",
        expect.any(Object),
        error
      );
    });
    
    it("should handle standard Error objects", () => {
      const error = new Error("Test error");
      const response = createFormErrorResponse(error);
      
      expect(response.success).toBe(false);
      expect(response.error.message).toBe("Test error");
      expect(response.error.code).toBe(ErrorCodes.FORM_ERROR);
      expect(response.error.details.fields._form).toBe("Test error");
    });
    
    it("should handle existing ApiErrorResponse objects", () => {
      const errorResponse = {
        success: false,
        error: {
          message: "API error",
          code: ErrorCodes.AUTHENTICATION,
        }
      };
      
      const response = createFormErrorResponse(errorResponse);
      
      expect(response).toEqual(errorResponse);
    });
    
    it("should handle unknown error types", () => {
      const error = "String error message";
      const response = createFormErrorResponse(error);
      
      expect(response.success).toBe(false);
      expect(response.error.message).toBe("String error message");
      expect(response.error.details.fields._form).toBe("String error message");
    });
  });
  
  describe("extractFieldErrors", () => {
    it("should extract field errors from a form error response", () => {
      const errorResponse = {
        success: false,
        error: {
          message: "Validation failed",
          code: ErrorCodes.FORM_ERROR,
          details: {
            fields: {
              name: "Name is required",
              email: "Email is invalid"
            }
          }
        }
      };
      
      const fieldErrors = extractFieldErrors(errorResponse);
      
      expect(fieldErrors.name).toBe("Name is required");
      expect(fieldErrors.email).toBe("Email is invalid");
    });
    
    it("should handle validation errors without field details", () => {
      const errorResponse = {
        success: false,
        error: {
          message: "Validation failed",
          code: ErrorCodes.VALIDATION,
        }
      };
      
      const fieldErrors = extractFieldErrors(errorResponse);
      
      expect(fieldErrors._form).toBe("Validation failed");
    });
    
    it("should handle general errors", () => {
      const errorResponse = {
        success: false,
        error: {
          message: "Server error",
          code: ErrorCodes.SERVER_ERROR,
        }
      };
      
      const fieldErrors = extractFieldErrors(errorResponse);
      
      expect(fieldErrors._form).toBe("Server error");
    });
    
    it("should return empty object for undefined error", () => {
      const fieldErrors = extractFieldErrors(undefined);
      
      expect(fieldErrors).toEqual({});
    });
  });
  
  describe("hasFieldError and getFieldError", () => {
    it("should check and get field errors correctly", () => {
      const errors = {
        name: "Name is required",
        email: "Email is invalid"
      };
      
      expect(hasFieldError("name", errors)).toBe(true);
      expect(hasFieldError("age", errors)).toBe(false);
      
      expect(getFieldError("name", errors)).toBe("Name is required");
      expect(getFieldError("age", errors)).toBeUndefined();
    });
  });
});