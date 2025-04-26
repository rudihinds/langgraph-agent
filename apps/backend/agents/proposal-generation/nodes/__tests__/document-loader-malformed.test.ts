import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LoadingStatus } from "@/state/proposal.state.js";

// Mock dependencies
const mockDownloadFileWithRetry = vi.hoisted(() => vi.fn());
const mockListFilesWithRetry = vi.hoisted(() => vi.fn());
const mockParseRfpFromBuffer = vi.hoisted(() => vi.fn());
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
}));

// Set up mocks
vi.mock("@/lib/supabase/supabase-runnable.js", () => ({
  downloadFileWithRetry: {
    invoke: mockDownloadFileWithRetry,
  },
  listFilesWithRetry: {
    invoke: mockListFilesWithRetry,
  },
}));

vi.mock("@/lib/parsers/rfp.js", () => ({
  parseRfpFromBuffer: mockParseRfpFromBuffer,
}));

vi.mock("@/lib/logger.js", () => ({
  Logger: {
    getInstance: () => mockLogger,
  },
}));

// Mock environment variable
const originalEnv = process.env;

// Import after mocks
import { documentLoaderNode } from "../../nodes.js";

describe("Document Loader - Malformed RFP ID Tests", () => {
  // Create mock blob for testing
  const mockArrayBuffer = async () => {
    return new Uint8Array([1, 2, 3, 4]).buffer;
  };

  const mockBlob = {
    arrayBuffer: mockArrayBuffer,
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Default successful responses
    mockDownloadFileWithRetry.mockResolvedValue(mockBlob);
    mockParseRfpFromBuffer.mockResolvedValue({
      text: "Extracted text from PDF",
      metadata: { format: "pdf" },
    });

    // Set test environment variable
    process.env = { ...originalEnv, TEST_RFP_ID: "env-test-rfp-id" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should handle empty string rfpId gracefully", async () => {
    // Arrange
    const initialState = {
      rfpDocument: {
        id: "", // Empty string
        status: LoadingStatus.NOT_STARTED,
      },
    };

    // Act
    const result = await documentLoaderNode(initialState as any);

    // Assert
    // Should use the fallback ID
    expect(mockDownloadFileWithRetry).not.toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.stringContaining(""),
      })
    );

    // Should use environment variable or default ID
    expect(mockDownloadFileWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.stringMatching(
          /(env-test-rfp-id|f3001786-9f37-437e-814e-170c77b9b748)\/document\.pdf/
        ),
      })
    );

    // Should log warning about empty ID
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it("should handle null rfpId by using fallbacks", async () => {
    // Arrange
    const initialState = {
      rfpDocument: {
        id: null, // Null value
        status: LoadingStatus.NOT_STARTED,
      },
    };

    // Act
    const result = await documentLoaderNode(initialState as any);

    // Assert
    // Should use environment variable ID
    expect(mockDownloadFileWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.stringContaining(process.env.TEST_RFP_ID as string),
      })
    );

    // Verify state is updated correctly with the environment variable ID
    expect(result.rfpDocument).toBeDefined();
    expect(result.rfpDocument?.status).toBe(LoadingStatus.LOADED);
    expect(result.rfpDocument?.id).toBe(process.env.TEST_RFP_ID);
  });

  it("should sanitize malformed rfpId containing path traversal attempts", async () => {
    // Arrange
    const maliciousId = "../../../etc/passwd";
    const initialState = {
      rfpDocument: {
        id: maliciousId,
        status: LoadingStatus.NOT_STARTED,
      },
    };

    // Act
    const result = await documentLoaderNode(initialState as any);

    // Assert
    // Should not use the malicious path directly
    expect(mockDownloadFileWithRetry).not.toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.stringContaining("../"),
      })
    );

    // Should sanitize or reject the malicious ID
    expect(mockLogger.error).toHaveBeenCalled();
    expect(result.rfpDocument?.status).toBe(LoadingStatus.ERROR);
    expect(result.rfpDocument?.metadata?.error).toBeDefined();
  });

  it("should handle special characters in rfpId", async () => {
    // Arrange
    const specialCharsId = "test@#$%^&*()_+";
    const initialState = {
      rfpDocument: {
        id: specialCharsId,
        status: LoadingStatus.NOT_STARTED,
      },
    };

    // Mocking storage error due to invalid characters
    const storageError = new Error("Invalid characters in storage path");
    mockDownloadFileWithRetry.mockRejectedValue(storageError);

    // Act
    const result = await documentLoaderNode(initialState as any);

    // Assert
    // Should have attempted to use the ID even with special chars
    expect(mockDownloadFileWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.stringContaining(specialCharsId),
      })
    );

    // Should handle the error gracefully
    expect(result.rfpDocument?.status).toBe(LoadingStatus.ERROR);
    expect(result.rfpDocument?.metadata?.error).toBeDefined();

    // Should include helpful error message
    if (result.rfpDocument?.metadata?.error) {
      const errorMsg = result.rfpDocument.metadata.error as string;
      expect(errorMsg).toContain("Invalid characters");
    }
  });

  it("should handle excessively long rfpId values", async () => {
    // Arrange
    const longId = "a".repeat(1000); // Very long ID
    const initialState = {
      rfpDocument: {
        id: longId,
        status: LoadingStatus.NOT_STARTED,
      },
    };

    // Mock storage error due to path length
    const storageError = new Error("Path too long");
    mockDownloadFileWithRetry.mockRejectedValue(storageError);

    // Act
    const result = await documentLoaderNode(initialState as any);

    // Assert
    // Should handle the error gracefully
    expect(result.rfpDocument?.status).toBe(LoadingStatus.ERROR);
    expect(result.rfpDocument?.metadata?.error).toBeDefined();

    // Should log helpful message
    expect(mockLogger.error).toHaveBeenCalled();

    // Should include helpful error information
    if (result.rfpDocument?.metadata?.error) {
      const errorMsg = result.rfpDocument.metadata.error as string;
      expect(errorMsg).toContain("error");
    }
  });
});
 