/**
 * Tests for the documentLoaderNode with authenticated client context
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoadingStatus } from "@/state/proposal.state.js";
import type { OverallProposalState } from "@/state/proposal.state.js";
import type { SupabaseClient } from "@supabase/supabase-js";

// Mock the logger - define this first since other mocks might use it
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

// Mock the document parser
const mockParseRfpFromBuffer = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    text: "Parsed RFP text from authenticated client",
    metadata: { format: "pdf" },
  })
);

// Mock Supabase client and serverSupabase
const mockStorageFrom = vi.hoisted(() => vi.fn());
const mockDownload = vi.hoisted(() => vi.fn());
const mockAuthSupabase = vi.hoisted(() => ({
  storage: {
    from: mockStorageFrom.mockReturnValue({
      download: mockDownload,
    }),
  },
  // Add missing required properties for SupabaseClient
  supabaseUrl: "https://test.supabase.co",
  supabaseKey: "test-key",
  auth: {} as any,
  realtime: {} as any,
  rest: {} as any,
  from: vi.fn(),
}));

const mockServerSupabase = vi.hoisted(() => ({
  storage: {
    from: vi.fn().mockReturnValue({
      download: vi.fn(),
    }),
  },
  // Add missing required properties for SupabaseClient
  supabaseUrl: "https://test.supabase.co",
  supabaseKey: "test-key",
  auth: {} as any,
  realtime: {} as any,
  rest: {} as any,
  from: vi.fn(),
}));

// Mock dependencies
vi.mock("@/lib/supabase/client.js", () => ({
  serverSupabase: mockServerSupabase,
}));

vi.mock("@/lib/parsers/rfp.js", () => ({
  parseRfpFromBuffer: mockParseRfpFromBuffer,
}));

vi.mock("@/lib/logger.js", () => ({
  Logger: {
    getInstance: () => mockLogger,
  },
}));

// Import the documentLoaderNode after all mocks are set up
import { documentLoaderNode } from "../document_loader.js";

// Helper function to create mock ArrayBuffer
async function createMockArrayBuffer() {
  return new Uint8Array([1, 2, 3, 4]).buffer;
}

describe("Document Loader Node - Authenticated Context", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default response for authenticated client
    mockDownload.mockResolvedValue({
      data: {
        arrayBuffer: createMockArrayBuffer,
      },
      error: null,
    });
  });

  it("should use the authenticated client from context when available", async () => {
    // Arrange
    const mockState: Partial<OverallProposalState> = {
      rfpDocument: {
        id: "auth-test-doc-id",
        status: LoadingStatus.NOT_STARTED,
      },
    };

    const mockContext = {
      supabase: mockAuthSupabase,
    };

    // Act
    const result = await documentLoaderNode(
      mockState as OverallProposalState,
      mockContext
    );

    // Assert
    expect(mockStorageFrom).toHaveBeenCalledWith("proposal-documents");
    expect(mockDownload).toHaveBeenCalledWith("auth-test-doc-id/document.pdf");
    expect(mockServerSupabase.storage.from).not.toHaveBeenCalled();
    expect(result.rfpDocument?.status).toBe(LoadingStatus.LOADED);
  });

  it("should fall back to server client when context doesn't provide a client", async () => {
    // Arrange
    const mockState: Partial<OverallProposalState> = {
      rfpDocument: {
        id: "server-test-doc-id",
        status: LoadingStatus.NOT_STARTED,
      },
    };

    // Set up serverSupabase mock for this test
    const mockServerDownload = mockServerSupabase.storage.from().download;
    mockServerDownload.mockResolvedValue({
      data: {
        arrayBuffer: createMockArrayBuffer,
      },
      error: null,
    });

    // Act - call without context parameter
    const result = await documentLoaderNode(mockState as OverallProposalState);

    // Assert
    expect(mockServerSupabase.storage.from).toHaveBeenCalledWith(
      "proposal-documents"
    );
    expect(mockServerDownload).toHaveBeenCalledWith(
      "server-test-doc-id/document.pdf"
    );
    expect(mockStorageFrom).not.toHaveBeenCalled();
    expect(result.rfpDocument?.status).toBe(LoadingStatus.LOADED);
  });

  it("should handle authorization errors from authenticated client", async () => {
    // Arrange
    const mockState: Partial<OverallProposalState> = {
      rfpDocument: {
        id: "auth-denied-doc-id",
        status: LoadingStatus.NOT_STARTED,
      },
    };

    const mockContext = {
      supabase: mockAuthSupabase,
    };

    // Set up auth error response
    mockDownload.mockResolvedValue({
      data: null,
      error: {
        message: "Access denied due to permissions",
        status: 403,
      },
    });

    // Act
    const result = await documentLoaderNode(
      mockState as OverallProposalState,
      mockContext
    );

    // Assert
    expect(mockStorageFrom).toHaveBeenCalledWith("proposal-documents");
    expect(mockDownload).toHaveBeenCalledWith(
      "auth-denied-doc-id/document.pdf"
    );
    expect(result.rfpDocument?.status).toBe(LoadingStatus.ERROR);
    expect(result.rfpDocument?.metadata?.errorType).toBe("authorization");
  });

  it("should identify that authenticated client was used in document metadata", async () => {
    // Arrange
    const mockState: Partial<OverallProposalState> = {
      rfpDocument: {
        id: "auth-test-doc-id",
        status: LoadingStatus.NOT_STARTED,
      },
    };

    const mockContext = {
      supabase: mockAuthSupabase,
      user: { id: "test-user-123" },
    };

    // Set up successful response
    mockDownload.mockResolvedValue({
      data: {
        arrayBuffer: createMockArrayBuffer,
      },
      error: null,
    });

    // Act
    const result = await documentLoaderNode(
      mockState as OverallProposalState,
      mockContext
    );

    // Assert
    expect(result.rfpDocument?.status).toBe(LoadingStatus.LOADED);
    expect(result.rfpDocument?.metadata?.clientType).toBe("authenticated");
  });

  // New Test: Handle missing rfpId
  it("should handle missing rfpId in state", async () => {
    // Arrange
    const mockState: Partial<OverallProposalState> = {
      rfpDocument: {
        // Using a partial state without id to test missing id
        status: LoadingStatus.NOT_STARTED,
      } as any, // Using 'any' to bypass the required id for testing
    };

    // Act
    const result = await documentLoaderNode(mockState as OverallProposalState);

    // Assert
    expect(result.rfpDocument?.status).toBe(LoadingStatus.ERROR);
    expect(result.rfpDocument?.metadata?.errorType).toBe("missing_input");
    // Storage client shouldn't be called
    expect(mockServerSupabase.storage.from).not.toHaveBeenCalled();
    expect(mockStorageFrom).not.toHaveBeenCalled();
    // Error should be logged
    expect(mockLogger.error).toHaveBeenCalled();
  });

  // New Test: Handle document not found error
  it("should handle document not found errors", async () => {
    // Arrange
    const mockState: Partial<OverallProposalState> = {
      rfpDocument: {
        id: "missing-doc-id",
        status: LoadingStatus.NOT_STARTED,
      },
    };

    // Set up not found error response
    mockDownload.mockResolvedValue({
      data: null,
      error: {
        message: "The resource does not exist",
        status: 404,
      },
    });

    // Act
    const result = await documentLoaderNode(mockState as OverallProposalState, {
      supabase: mockAuthSupabase,
    });

    // Assert
    expect(result.rfpDocument?.status).toBe(LoadingStatus.ERROR);
    expect(result.rfpDocument?.metadata?.errorType).toBe("document_not_found");
    expect(mockLogger.error).toHaveBeenCalled();
  });

  // New Test: Handle parsing errors
  it("should handle document parsing errors", async () => {
    // Arrange
    const mockState: Partial<OverallProposalState> = {
      rfpDocument: {
        id: "corrupt-doc-id",
        status: LoadingStatus.NOT_STARTED,
      },
    };

    // Set up successful download but failed parsing
    mockDownload.mockResolvedValue({
      data: {
        arrayBuffer: createMockArrayBuffer,
      },
      error: null,
    });

    // Make parser throw an error
    mockParseRfpFromBuffer.mockRejectedValueOnce(
      new Error("Failed to parse document: corrupt data")
    );

    // Act
    const result = await documentLoaderNode(mockState as OverallProposalState, {
      supabase: mockAuthSupabase,
    });

    // Assert
    expect(result.rfpDocument?.status).toBe(LoadingStatus.ERROR);
    expect(result.rfpDocument?.metadata?.errorType).toBe("parsing_error");
    expect(mockLogger.error).toHaveBeenCalled();
  });

  // New Test: Handle empty data with no error
  it("should handle empty data response with no error", async () => {
    // Arrange
    const mockState: Partial<OverallProposalState> = {
      rfpDocument: {
        id: "empty-doc-id",
        status: LoadingStatus.NOT_STARTED,
      },
    };

    // Set up empty data response but no error
    mockDownload.mockResolvedValue({
      data: null,
      error: null,
    });

    // Act
    const result = await documentLoaderNode(mockState as OverallProposalState, {
      supabase: mockAuthSupabase,
    });

    // Assert
    expect(result.rfpDocument?.status).toBe(LoadingStatus.ERROR);
    expect(result.rfpDocument?.metadata?.errorType).toBe("document_not_found");
    expect(mockStorageFrom).toHaveBeenCalled();
    expect(mockDownload).toHaveBeenCalled();
  });
});
