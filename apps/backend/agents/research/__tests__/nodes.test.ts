import { documentLoaderNode } from "../nodes";
import { DocumentService } from "../../../lib/db/documents";
import { parseRfpDocument } from "../../../lib/parsers/rfp";
import { ResearchState } from "../state";

// Mock dependencies
jest.mock("../../../lib/db/documents", () => {
  return {
    DocumentService: jest.fn().mockImplementation(() => ({
      downloadDocument: jest.fn().mockResolvedValue({
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

jest.mock("../../../lib/parsers/rfp", () => {
  return {
    parseRfpDocument: jest
      .fn()
      .mockImplementation((buffer, fileType) =>
        Promise.resolve(`Parsed content from ${fileType}`)
      ),
  };
});

jest.mock("../../../logger", () => {
  return {
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    },
  };
});

describe("Document Loader Node", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    const mockDocService = (DocumentService as jest.Mock).mock.results[0].value;
    expect(mockDocService.downloadDocument).toHaveBeenCalledWith("test-doc-id");
    expect(parseRfpDocument).toHaveBeenCalledWith(
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
    jest.mocked(DocumentService).mockImplementationOnce(() => ({
      downloadDocument: jest.fn().mockRejectedValue(mockError),
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
    jest
      .mocked(parseRfpDocument)
      .mockRejectedValueOnce(new Error("Parser error"));

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
