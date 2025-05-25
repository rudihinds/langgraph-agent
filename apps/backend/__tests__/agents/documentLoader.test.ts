import { describe, it, expect, vi, beforeEach } from "vitest";
import { Buffer } from "buffer";
import type { OverallProposalState } from "@/state/proposal.state.js";

// Use vi.hoisted() to ensure these variables are properly hoisted
const mockDownload = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() =>
  vi.fn().mockReturnValue({ download: mockDownload })
);
const parseRfpFromBufferMock = vi.hoisted(() => vi.fn());
const writeFileMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const unlinkMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockJoin = vi.hoisted(() => vi.fn((...args) => args.join("/")));
const mockTmpdir = vi.hoisted(() => vi.fn().mockReturnValue("/tmp"));

// Mock modules explicitly with vi.mock()
vi.mock("@/lib/supabase/client.js", () => ({
  serverSupabase: {
    storage: {
      from: mockFrom,
    },
  },
}));

vi.mock("@/lib/parsers/rfp.js", () => ({
  parseRfpFromBuffer: parseRfpFromBufferMock,
}));

vi.mock("@/lib/logger.js", () => ({
  Logger: {
    getInstance: () => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    }),
  },
}));

// Mock fs module correctly
vi.mock("fs", () => {
  return {
    default: {
      promises: {
        writeFile: writeFileMock,
        unlink: unlinkMock,
      },
    },
    promises: {
      writeFile: writeFileMock,
      unlink: unlinkMock,
    },
  };
});

// Mock path module correctly
vi.mock("path", () => {
  return {
    default: {
      join: mockJoin,
    },
    join: mockJoin,
  };
});

// Mock os module correctly
vi.mock("os", () => {
  return {
    default: {
      tmpdir: mockTmpdir,
    },
    tmpdir: mockTmpdir,
  };
});

// Import the module under test after mocks
import { documentLoaderNode } from "../documentLoader.js";

// Mock data for Blob
class MockBlob {
  private data: Uint8Array;
  public type: string;

  constructor(data: Uint8Array, type: string) {
    this.data = data;
    this.type = type;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return Promise.resolve(this.data.buffer as ArrayBuffer);
  }
}

// Helper function to create test state
function createTestState(documentId?: string): Partial<OverallProposalState> {
  return {
    userId: "test-user",
    rfpDocument: {
      id: documentId ?? "test-document-id",
      fileName: "test-document.pdf",
      status: "not_started",
      metadata: {},
    },
    errors: [],
  };
}

describe("Document Loader Node (Supabase)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default successful response
    mockDownload.mockResolvedValue({
      data: new MockBlob(new Uint8Array([1, 2, 3, 4]), "application/pdf"),
      error: null,
    });

    // Default successful parsing
    parseRfpFromBufferMock.mockResolvedValue({
      text: "Test document content",
      metadata: {
        fileName: "test-document.pdf",
        format: "pdf",
        pageCount: 10,
      },
    });
  });

  it("should handle non-existent document ID (404)", async () => {
    // Arrange
    const mockState = createTestState();
    mockDownload.mockResolvedValue({
      data: null,
      error: { message: "Document not found", status: 404 },
    });

    // Act
    const result = await documentLoaderNode(mockState as OverallProposalState);

    // Assert
    expect(mockFrom).toHaveBeenCalledWith("proposal-documents");
    expect(result.rfpDocument?.status).toBe("error");
    expect(result.errors?.[0]).toContain("not found");
  });

  it("should handle unauthorized access (403)", async () => {
    // Arrange
    const mockState = createTestState();
    mockDownload.mockResolvedValue({
      data: null,
      error: { message: "Unauthorized access", status: 403 },
    });

    // Act
    const result = await documentLoaderNode(mockState as OverallProposalState);

    // Assert
    expect(result.rfpDocument?.status).toBe("error");
    expect(result.errors?.[0]).toContain("Permission denied");
  });

  it("should validate document ID and return error if missing", async () => {
    // Arrange
    const mockState = createTestState("");

    // Act
    const result = await documentLoaderNode(mockState as OverallProposalState);

    // Assert
    expect(result.rfpDocument?.status).toBe("error");
    expect(result.errors?.[0]).toBe(
      "No document ID provided for document loading"
    );
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("should handle Supabase service unavailability", async () => {
    // Arrange
    const mockState = createTestState();
    mockDownload.mockRejectedValue(new Error("Service unavailable"));

    // Act
    const result = await documentLoaderNode(mockState as OverallProposalState);

    // Assert
    expect(result.rfpDocument?.status).toBe("error");
    expect(result.errors?.[0]).toContain("Failed to process document");
  });

  it("should load a PDF document successfully", async () => {
    // Arrange
    const mockState = createTestState();
    const pdfBlob = new MockBlob(
      new Uint8Array([1, 2, 3, 4]),
      "application/pdf"
    );
    mockDownload.mockResolvedValue({
      data: pdfBlob,
      error: null,
    });

    parseRfpFromBufferMock.mockResolvedValue({
      text: "Parsed PDF content",
      metadata: { format: "pdf", fileName: "document.pdf" },
    });

    // Act
    const result = await documentLoaderNode(mockState as OverallProposalState);

    // Assert
    expect(result.rfpDocument?.status).toBe("loaded");
    expect(parseRfpFromBufferMock).toHaveBeenCalled();
    expect(writeFileMock).toHaveBeenCalled();
    expect(unlinkMock).toHaveBeenCalled();
    expect(result.rfpDocument?.metadata?.mimeType).toBe("application/pdf");
  });

  it("should handle parsing errors", async () => {
    // Arrange
    const mockState = createTestState();
    const pdfBlob = new MockBlob(
      new Uint8Array([1, 2, 3, 4]),
      "application/pdf"
    );
    mockDownload.mockResolvedValue({
      data: pdfBlob,
      error: null,
    });

    // Mock parser to throw an error with a name that indicates parsing error
    const parsingError = new Error("Corrupted file content");
    parsingError.name = "ParsingError";
    parseRfpFromBufferMock.mockRejectedValue(parsingError);

    // Act
    const result = await documentLoaderNode(mockState as OverallProposalState);

    // Assert
    expect(result.rfpDocument?.status).toBe("error");
    expect(result.errors?.[0]).toContain("Parsing error");
  });

  it("should handle cleanup failures gracefully", async () => {
    // Arrange
    const mockState = createTestState();
    const pdfBlob = new MockBlob(
      new Uint8Array([1, 2, 3, 4]),
      "application/pdf"
    );
    mockDownload.mockResolvedValue({
      data: pdfBlob,
      error: null,
    });

    // Setup success for main operations
    parseRfpFromBufferMock.mockResolvedValue({
      text: "Parsed PDF content",
      metadata: { format: "pdf", fileName: "document.pdf" },
    });

    // But simulate a failure during cleanup
    unlinkMock.mockRejectedValueOnce(new Error("Failed to delete temp file"));

    // Act
    const result = await documentLoaderNode(mockState as OverallProposalState);

    // Assert - Should not affect result
    expect(result.rfpDocument?.status).toBe("loaded");
    expect(unlinkMock).toHaveBeenCalled();
  });

  it("should incorporate MIME type into metadata", async () => {
    // Arrange
    const mockState = createTestState();
    const pdfBlob = new MockBlob(
      new Uint8Array([1, 2, 3, 4]),
      "application/pdf"
    );
    mockDownload.mockResolvedValue({
      data: pdfBlob,
      error: null,
    });

    // Act
    const result = await documentLoaderNode(mockState as OverallProposalState);

    // Assert
    expect(result.rfpDocument?.metadata?.mimeType).toBe("application/pdf");
  });
});
