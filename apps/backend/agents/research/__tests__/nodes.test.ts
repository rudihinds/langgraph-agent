import { describe, it, expect, beforeEach, vi } from "vitest";
import { documentLoaderNode } from "../nodes";
import { DocumentService } from "../../../lib/db/documents";
import { parseRfpFromBuffer } from "../../../lib/parsers/rfp";
import { ResearchState } from "../state";

// Mock dependencies
vi.mock("../../../lib/db/documents", () => {
  return {
    DocumentService: vi.fn().mockImplementation(() => ({
      downloadDocument: vi.fn().mockResolvedValue({
        buffer: Buffer.from("Test RFP document content"),
        metadata: {
          id: "test-doc-id",
          proposal_id: "test-proposal-id",
          document_type: "rfp",
          file_name: "test-rfp.pdf",
          file_path: "path/to/test-rfp.pdf",
          file_type: "application/pdf",
        },
      }),
    })),
  };
});

vi.mock("../../../lib/parsers/rfp", () => {
  return {
    parseRfpFromBuffer: vi.fn().mockImplementation((buffer, fileType) =>
      Promise.resolve({
        text: `Parsed content from ${fileType}`,
        metadata: {},
      })
    ),
  };
});

vi.mock("../../../logger", () => {
  return {
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    },
  };
});

describe("Document Loader Node", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully load a document", async () => {
    // Setup
    const initialState: Partial<ResearchState> = {
      rfpDocument: {
        id: "test-doc-id",
        text: "",
        metadata: {},
      },
      status: {
        documentLoaded: false,
        researchComplete: false,
        solutionAnalysisComplete: false,
      },
      errors: [],
    };

    // Execute
    const result = await documentLoaderNode(initialState as ResearchState);

    // Verify
    expect(DocumentService).toHaveBeenCalled();
    const mockDocService = (DocumentService as any).mock.results[0].value;
    expect(mockDocService.downloadDocument).toHaveBeenCalledWith("test-doc-id");
    expect(parseRfpFromBuffer).toHaveBeenCalledWith(
      Buffer.from("Test RFP document content"),
      "application/pdf"
    );

    expect(result).toEqual({
      rfpDocument: {
        id: "test-doc-id",
        text: "Parsed content from application/pdf",
        metadata: {
          id: "test-doc-id",
          proposal_id: "test-proposal-id",
          document_type: "rfp",
          file_name: "test-rfp.pdf",
          file_path: "path/to/test-rfp.pdf",
          file_type: "application/pdf",
        },
      },
      status: {
        documentLoaded: true,
        researchComplete: false,
        solutionAnalysisComplete: false,
      },
    });
  });

  it("should handle errors when loading a document", async () => {
    // Setup
    const mockError = new Error("Test error");
    vi.mocked(DocumentService).mockImplementationOnce(() => ({
      downloadDocument: vi.fn().mockRejectedValue(mockError),
    }));

    const initialState: Partial<ResearchState> = {
      rfpDocument: {
        id: "error-doc-id",
        text: "",
        metadata: {},
      },
      status: {
        documentLoaded: false,
        researchComplete: false,
        solutionAnalysisComplete: false,
      },
      errors: [],
    };

    // Execute
    const result = await documentLoaderNode(initialState as ResearchState);

    // Verify
    expect(result).toEqual({
      errors: ["Failed to load document: Test error"],
      status: {
        documentLoaded: false,
        researchComplete: false,
        solutionAnalysisComplete: false,
      },
    });
  });

  it("should handle parser errors", async () => {
    // Setup
    vi.mocked(parseRfpFromBuffer).mockRejectedValueOnce(
      new Error("Parser error")
    );

    const initialState: Partial<ResearchState> = {
      rfpDocument: {
        id: "parser-error-doc-id",
        text: "",
        metadata: {},
      },
      status: {
        documentLoaded: false,
        researchComplete: false,
        solutionAnalysisComplete: false,
      },
      errors: [],
    };

    // Execute
    const result = await documentLoaderNode(initialState as ResearchState);

    // Verify
    expect(result).toEqual({
      errors: ["Failed to load document: Parser error"],
      status: {
        documentLoaded: false,
        researchComplete: false,
        solutionAnalysisComplete: false,
      },
    });
  });
});
