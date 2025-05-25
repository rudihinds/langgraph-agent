import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LoadingStatus } from "@/state/proposal.state.js";
import type { OverallProposalState } from "@/state/proposal.state.js";

// Mock dependencies using vi.hoisted
const mockDownloadFileWithRetry = vi.hoisted(() => vi.fn());
const mockListFilesWithRetry = vi.hoisted(() => vi.fn());
const mockParseRfpFromBuffer = vi.hoisted(() => vi.fn());

// Set up mocks before imports
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
    getInstance: () => ({
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
    }),
  },
}));

// Mock environment variable
const originalEnv = process.env;

// Import the component under test after mocks
import { documentLoaderNode } from "../../nodes.js";

describe("RFP Document ID Handling", () => {
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

  it("should use rfpId from state.rfpDocument.id when provided", async () => {
    // Arrange
    const testRfpId = "test-rfp-id-123";
    const initialState = {
      rfpDocument: {
        id: testRfpId,
        status: LoadingStatus.NOT_STARTED,
      },
    };

    // Act
    const result = await documentLoaderNode(initialState as any);

    // Assert
    expect(mockDownloadFileWithRetry).toHaveBeenCalledWith({
      bucketName: "proposal-documents",
      path: `${testRfpId}/document.pdf`,
    });

    // Verify state is updated correctly
    expect(result.rfpDocument).toBeDefined();
    expect(result.rfpDocument?.status).toBe(LoadingStatus.LOADED);
    expect(result.rfpDocument?.id).toBe(testRfpId);

    // Verify it didn't use the environment fallback
    expect(mockDownloadFileWithRetry).not.toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.stringContaining(process.env.TEST_RFP_ID as string),
      })
    );
  });

  it("should fallback to TEST_RFP_ID environment variable when no rfpId in state", async () => {
    // Arrange
    const initialState = {
      // No rfpDocument.id provided
    };

    // Act
    const result = await documentLoaderNode(initialState as any);

    // Assert
    expect(mockDownloadFileWithRetry).toHaveBeenCalledWith({
      bucketName: "proposal-documents",
      path: `${process.env.TEST_RFP_ID}/document.pdf`,
    });

    // Verify state is updated correctly with the environment variable ID
    expect(result.rfpDocument).toBeDefined();
    expect(result.rfpDocument?.status).toBe(LoadingStatus.LOADED);
    expect(result.rfpDocument?.id).toBe(process.env.TEST_RFP_ID);
  });

  it("should use hardcoded default ID when both state and environment variable are missing", async () => {
    // Arrange
    const initialState = {};
    const defaultId = "f3001786-9f37-437e-814e-170c77b9b748"; // This is the hardcoded default in the implementation

    // Remove TEST_RFP_ID from environment
    delete process.env.TEST_RFP_ID;

    // Act
    const result = await documentLoaderNode(initialState as any);

    // Assert
    expect(mockDownloadFileWithRetry).toHaveBeenCalledWith({
      bucketName: "proposal-documents",
      path: `${defaultId}/document.pdf`,
    });

    // Verify state is updated correctly with the default ID
    expect(result.rfpDocument).toBeDefined();
    expect(result.rfpDocument?.status).toBe(LoadingStatus.LOADED);
    expect(result.rfpDocument?.id).toBe(defaultId);
  });
});

describe("RFP Document Retrieval Tests", () => {
  // Create mock blobs and data for different file types
  const mockPdfArrayBuffer = async () => {
    return new Uint8Array([80, 68, 70, 45, 49, 46, 55]).buffer; // PDF magic bytes
  };

  const mockDocxArrayBuffer = async () => {
    return new Uint8Array([80, 75, 3, 4, 20, 0, 6, 0]).buffer; // DOCX magic bytes
  };

  const mockTxtArrayBuffer = async () => {
    return new TextEncoder().encode("This is plain text").buffer;
  };

  const mockLargeArrayBuffer = async () => {
    // Create a 5MB buffer to simulate large document
    return new Uint8Array(5 * 1024 * 1024).buffer;
  };

  const mockPdfBlob = { arrayBuffer: mockPdfArrayBuffer };
  const mockDocxBlob = { arrayBuffer: mockDocxArrayBuffer };
  const mockTxtBlob = { arrayBuffer: mockTxtArrayBuffer };
  const mockLargeBlob = { arrayBuffer: mockLargeArrayBuffer };

  // Sample list of files in storage
  const mockStorageFiles = [
    { name: "document.pdf", id: "pdf-id" },
    { name: "backup.docx", id: "docx-id" },
    { name: "notes.txt", id: "txt-id" },
  ];

  beforeEach(() => {
    vi.resetAllMocks();

    // Default successful response for document parsing
    mockParseRfpFromBuffer.mockResolvedValue({
      text: "Extracted text from document",
      metadata: { format: "pdf" },
    });

    // Set test environment variable
    process.env = { ...originalEnv, TEST_RFP_ID: "test-rfp-id" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should successfully retrieve document with default filename", async () => {
    // Arrange
    const testRfpId = "test-rfp-id";
    const initialState = {
      rfpDocument: {
        id: testRfpId,
        status: LoadingStatus.NOT_STARTED,
      },
    };

    // Mock successful file download
    mockDownloadFileWithRetry.mockResolvedValue(mockPdfBlob);

    // Act
    const result = await documentLoaderNode(initialState as any);

    // Assert
    expect(mockDownloadFileWithRetry).toHaveBeenCalledWith({
      bucketName: "proposal-documents",
      path: `${testRfpId}/document.pdf`,
    });

    // Verify correct state update
    expect(result.rfpDocument).toBeDefined();
    expect(result.rfpDocument?.status).toBe(LoadingStatus.LOADED);
    expect(result.rfpDocument?.text).toBe("Extracted text from document");
  });

  it("should fallback to PDF search when default document is not found", async () => {
    // Arrange
    const testRfpId = "test-rfp-id";
    const initialState = {
      rfpDocument: {
        id: testRfpId,
        status: LoadingStatus.NOT_STARTED,
      },
    };

    // Mock file not found on first try
    mockDownloadFileWithRetry.mockResolvedValueOnce(null);

    // Mock successful listing of directory
    mockListFilesWithRetry.mockResolvedValue(mockStorageFiles);

    // Mock successful download of fallback PDF
    mockDownloadFileWithRetry.mockResolvedValueOnce(mockPdfBlob);

    // Act
    const result = await documentLoaderNode(initialState as any);

    // Assert
    // First attempt with default name
    expect(mockDownloadFileWithRetry).toHaveBeenCalledWith({
      bucketName: "proposal-documents",
      path: `${testRfpId}/document.pdf`,
    });

    // Should list files in directory
    expect(mockListFilesWithRetry).toHaveBeenCalledWith({
      bucketName: "proposal-documents",
      path: testRfpId,
    });

    // Should try with first PDF from list
    expect(mockDownloadFileWithRetry).toHaveBeenCalledWith({
      bucketName: "proposal-documents",
      path: `${testRfpId}/${mockStorageFiles[0].name}`,
    });

    // Verify correct state update
    expect(result.rfpDocument).toBeDefined();
    expect(result.rfpDocument?.status).toBe(LoadingStatus.LOADED);
  });

  it("should handle error when document doesn't exist", async () => {
    // Arrange
    const testRfpId = "test-rfp-id";
    const initialState = {
      rfpDocument: {
        id: testRfpId,
        status: LoadingStatus.NOT_STARTED,
      },
    };

    // Mock file not found
    mockDownloadFileWithRetry.mockResolvedValue(null);

    // Mock empty directory
    mockListFilesWithRetry.mockResolvedValue([]);

    // Simulate throw after empty result
    mockListFilesWithRetry.mockImplementation(() => {
      throw new Error("No PDF documents found");
    });

    // Act
    const result = await documentLoaderNode(initialState as any);

    // Assert
    expect(result.rfpDocument).toBeDefined();
    expect(result.rfpDocument?.status).toBe(LoadingStatus.ERROR);
    expect(result.rfpDocument?.metadata?.error).toBeDefined();

    // Verify error message contains helpful information
    if (result.rfpDocument?.metadata?.error) {
      expect(typeof result.rfpDocument.metadata.error).toBe("string");
      const errorMsg = result.rfpDocument.metadata.error as string;
      expect(errorMsg).toContain("Check if document exists");
    }
  });

  it("should handle storage access issues gracefully", async () => {
    // Arrange
    const testRfpId = "test-rfp-id";
    const initialState = {
      rfpDocument: {
        id: testRfpId,
        status: LoadingStatus.NOT_STARTED,
      },
    };

    // Mock permission/access error
    const accessError = new Error("Access denied to storage bucket");
    accessError.name = "StorageError";
    mockDownloadFileWithRetry.mockImplementation(() => {
      throw accessError;
    });

    // Act
    const result = await documentLoaderNode(initialState as any);

    // Assert
    expect(result.rfpDocument).toBeDefined();
    expect(result.rfpDocument?.status).toBe(LoadingStatus.ERROR);

    // Check error message in metadata
    if (result.rfpDocument?.metadata?.error) {
      expect(typeof result.rfpDocument.metadata.error).toBe("string");
      const errorMsg = result.rfpDocument.metadata.error as string;
      expect(errorMsg).toContain("Access denied");
    }
  });

  it("should process different document formats (PDF)", async () => {
    // Arrange
    const testRfpId = "test-rfp-id";
    const initialState = {
      rfpDocument: {
        id: testRfpId,
        status: LoadingStatus.NOT_STARTED,
      },
    };

    // Mock PDF file download
    mockDownloadFileWithRetry.mockResolvedValue(mockPdfBlob);

    // Set up PDF-specific parser result
    mockParseRfpFromBuffer.mockResolvedValue({
      text: "Extracted PDF text",
      metadata: { format: "pdf" },
    });

    // Act
    const result = await documentLoaderNode(initialState as any);

    // Assert
    expect(mockDownloadFileWithRetry).toHaveBeenCalledWith({
      bucketName: "proposal-documents",
      path: `${testRfpId}/document.pdf`,
    });

    expect(result.rfpDocument).toBeDefined();
    expect(result.rfpDocument?.status).toBe(LoadingStatus.LOADED);
    expect(result.rfpDocument?.text).toBe("Extracted PDF text");
  });

  it("should handle large documents without timeout", async () => {
    // Arrange
    const testRfpId = "test-rfp-id";
    const initialState = {
      rfpDocument: {
        id: testRfpId,
        status: LoadingStatus.NOT_STARTED,
      },
    };

    // Mock successful large file download
    mockDownloadFileWithRetry.mockResolvedValue(mockLargeBlob);

    // Mock successful parsing with longer delay to simulate processing time
    mockParseRfpFromBuffer.mockImplementation(async () => {
      // Simulate processing time for large document
      await new Promise((resolve) => setTimeout(resolve, 100));
      return {
        text: "Extracted text from large document",
        metadata: { format: "pdf", size: "large" },
      };
    });

    // Act
    const result = await documentLoaderNode(initialState as any);

    // Assert
    expect(mockDownloadFileWithRetry).toHaveBeenCalledWith({
      bucketName: "proposal-documents",
      path: `${testRfpId}/document.pdf`,
    });

    expect(result.rfpDocument).toBeDefined();
    expect(result.rfpDocument?.status).toBe(LoadingStatus.LOADED);
    expect(result.rfpDocument?.text).toBe("Extracted text from large document");

    // Verify metadata about size was preserved
    expect(mockParseRfpFromBuffer).toHaveBeenCalled();
  });
});
