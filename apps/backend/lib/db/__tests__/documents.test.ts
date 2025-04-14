import { DocumentService, DocumentMetadata } from "../documents";

// Mock Supabase client
jest.mock("@supabase/supabase-js", () => {
  const mockSingle = jest.fn();
  const mockMaybeSingle = jest.fn();
  const mockSelect = jest.fn(() => ({
    eq: jest.fn(() => ({
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
    })),
  }));

  const mockDownload = jest.fn();
  const mockFromStorage = jest.fn(() => ({
    download: mockDownload,
  }));

  return {
    createClient: jest.fn(() => ({
      from: jest.fn(() => ({
        select: mockSelect,
        eq: jest.fn(() => ({
          select: mockSelect,
          eq: jest.fn(() => ({
            single: mockSingle,
            maybeSingle: mockMaybeSingle,
          })),
        })),
      })),
      storage: {
        from: mockFromStorage,
      },
    })),
    PostgrestError: class PostgrestError extends Error {
      code?: string;
      constructor(message: string, code?: string) {
        super(message);
        this.code = code;
      }
    },
  };
});

// Mock implementation dependencies for testing
const mockSingleImpl = (mockData: any, mockError: any = null) => {
  const from = require("@supabase/supabase-js").createClient().from();
  const select = from.select();
  const eq = select.eq();
  eq.single.mockImplementationOnce(() =>
    Promise.resolve({ data: mockData, error: mockError })
  );
};

const mockMaybeSingleImpl = (mockData: any, mockError: any = null) => {
  const from = require("@supabase/supabase-js").createClient().from();
  const select = from.select();
  const eq = select.eq();
  eq.maybeSingle.mockImplementationOnce(() =>
    Promise.resolve({ data: mockData, error: mockError })
  );
};

const mockSelectImpl = (mockData: any, mockError: any = null) => {
  const from = require("@supabase/supabase-js").createClient().from();
  const select = from.select();
  select.eq.mockImplementationOnce(() =>
    Promise.resolve({ data: mockData, error: mockError })
  );
};

const mockDownloadImpl = (mockData: any, mockError: any = null) => {
  const storage = require("@supabase/supabase-js").createClient().storage;
  const from = storage.from();
  from.download.mockImplementationOnce(() =>
    Promise.resolve({ data: mockData, error: mockError })
  );
};

describe("DocumentService", () => {
  let documentService: DocumentService;

  beforeEach(() => {
    jest.clearAllMocks();
    documentService = new DocumentService("test-url", "test-key");
  });

  describe("getDocumentMetadata", () => {
    const mockDocument: DocumentMetadata = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      proposal_id: "123e4567-e89b-12d3-a456-426614174001",
      document_type: "rfp",
      file_name: "test-document.pdf",
      file_path: "proposals/123/test-document.pdf",
      file_type: "application/pdf",
      size_bytes: 1024,
      created_at: "2023-01-01T00:00:00.000Z",
    };

    it("should retrieve document metadata successfully", async () => {
      mockSingleImpl(mockDocument);

      const result = await documentService.getDocumentMetadata(mockDocument.id);

      expect(result).toEqual(mockDocument);
    });

    it("should throw an error when document not found", async () => {
      const PostgrestError = require("@supabase/supabase-js").PostgrestError;
      mockSingleImpl(
        null,
        new PostgrestError("Document not found", "PGRST116")
      );

      await expect(
        documentService.getDocumentMetadata("non-existent-id")
      ).rejects.toThrow(
        "Failed to retrieve document metadata: Document not found (PGRST116)"
      );
    });

    it("should throw an error when metadata validation fails", async () => {
      mockSingleImpl({
        id: "123",
        proposal_id: "not-a-uuid",
        document_type: "invalid-type",
        file_name: "test.pdf",
        file_path: "/path/to/file",
      });

      await expect(
        documentService.getDocumentMetadata("123")
      ).rejects.toThrow(); // Zod validation error
    });

    it("should handle empty response with error", async () => {
      mockSingleImpl(undefined, { message: "Failed to retrieve" });

      await expect(
        documentService.getDocumentMetadata("some-id")
      ).rejects.toThrow(
        "Failed to retrieve document metadata: Failed to retrieve (unknown)"
      );
    });

    it("should validate document with minimal required fields", async () => {
      const minimalDocument = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        proposal_id: "123e4567-e89b-12d3-a456-426614174001",
        document_type: "rfp",
        file_name: "minimal.pdf",
        file_path: "proposals/123/minimal.pdf",
      };

      mockSingleImpl(minimalDocument);

      const result = await documentService.getDocumentMetadata(
        minimalDocument.id
      );

      expect(result).toEqual(minimalDocument);
    });
  });

  describe("downloadDocument", () => {
    const mockDocument: DocumentMetadata = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      proposal_id: "123e4567-e89b-12d3-a456-426614174001",
      document_type: "rfp",
      file_name: "test-document.pdf",
      file_path: "proposals/123/test-document.pdf",
    };

    it("should download document successfully", async () => {
      // Mock getDocumentMetadata response
      mockSingleImpl(mockDocument);

      // Mock the file download
      const mockBlob = new Blob(["test file content"], {
        type: "application/pdf",
      });
      mockBlob.arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(16));
      mockDownloadImpl(mockBlob);

      const result = await documentService.downloadDocument(mockDocument.id);

      expect(result.metadata).toEqual(mockDocument);
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
    });

    it("should throw an error when download fails", async () => {
      // Mock getDocumentMetadata response
      mockSingleImpl(mockDocument);

      // Mock the file download error
      mockDownloadImpl(null, { message: "Storage error", status: 404 });

      await expect(
        documentService.downloadDocument(mockDocument.id)
      ).rejects.toThrow("Failed to download document: Storage error (404)");
    });

    it("should throw an error when metadata retrieval fails", async () => {
      const PostgrestError = require("@supabase/supabase-js").PostgrestError;
      mockSingleImpl(
        null,
        new PostgrestError("Document not found", "PGRST116")
      );

      await expect(
        documentService.downloadDocument("non-existent-id")
      ).rejects.toThrow(
        "Failed to retrieve document metadata: Document not found (PGRST116)"
      );
    });

    it("should handle undefined data response", async () => {
      // Mock getDocumentMetadata response
      mockSingleImpl(mockDocument);

      // Mock undefined data response
      mockDownloadImpl(undefined, null);

      await expect(
        documentService.downloadDocument(mockDocument.id)
      ).rejects.toThrow("Failed to download document: Unknown error (unknown)");
    });

    it("should handle empty file content", async () => {
      // Mock getDocumentMetadata response
      mockSingleImpl(mockDocument);

      // Mock empty file content
      const emptyBlob = new Blob([], { type: "application/pdf" });
      emptyBlob.arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(0));
      mockDownloadImpl(emptyBlob);

      const result = await documentService.downloadDocument(mockDocument.id);

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer.length).toBe(0);
    });
  });

  describe("listProposalDocuments", () => {
    const mockDocuments: DocumentMetadata[] = [
      {
        id: "123e4567-e89b-12d3-a456-426614174000",
        proposal_id: "123e4567-e89b-12d3-a456-426614174001",
        document_type: "rfp",
        file_name: "rfp-document.pdf",
        file_path: "proposals/123/rfp-document.pdf",
      },
      {
        id: "223e4567-e89b-12d3-a456-426614174000",
        proposal_id: "123e4567-e89b-12d3-a456-426614174001",
        document_type: "supplementary",
        file_name: "supplementary.pdf",
        file_path: "proposals/123/supplementary.pdf",
      },
    ];

    it("should list all documents for a proposal", async () => {
      mockSelectImpl(mockDocuments);

      const result = await documentService.listProposalDocuments(
        "123e4567-e89b-12d3-a456-426614174001"
      );

      expect(result).toEqual(mockDocuments);
      expect(result.length).toBe(2);
    });

    it("should return empty array when no documents found", async () => {
      mockSelectImpl([]);

      const result =
        await documentService.listProposalDocuments("non-existent-id");

      expect(result).toEqual([]);
      expect(result.length).toBe(0);
    });

    it("should throw an error when database query fails", async () => {
      const PostgrestError = require("@supabase/supabase-js").PostgrestError;
      mockSelectImpl(null, new PostgrestError("Database error", "DB001"));

      await expect(
        documentService.listProposalDocuments("some-id")
      ).rejects.toThrow(
        "Failed to list proposal documents: Database error (DB001)"
      );
    });

    it("should handle null data in response", async () => {
      mockSelectImpl(null);

      const result = await documentService.listProposalDocuments("some-id");

      expect(result).toEqual([]);
    });

    it("should validate all documents in the array", async () => {
      const mixedDocuments = [
        {
          id: "123e4567-e89b-12d3-a456-426614174000",
          proposal_id: "123e4567-e89b-12d3-a456-426614174001",
          document_type: "rfp",
          file_name: "valid.pdf",
          file_path: "proposals/123/valid.pdf",
        },
        {
          id: "invalid-uuid",
          proposal_id: "123e4567-e89b-12d3-a456-426614174001",
          document_type: "invalid-type", // Invalid enum value
          file_name: "invalid.pdf",
          file_path: "proposals/123/invalid.pdf",
        },
      ];

      mockSelectImpl(mixedDocuments);

      await expect(
        documentService.listProposalDocuments("some-id")
      ).rejects.toThrow(); // Zod validation error
    });
  });

  describe("getProposalDocumentByType", () => {
    const mockDocument: DocumentMetadata = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      proposal_id: "123e4567-e89b-12d3-a456-426614174001",
      document_type: "rfp",
      file_name: "rfp-document.pdf",
      file_path: "proposals/123/rfp-document.pdf",
    };

    it("should retrieve document by type successfully", async () => {
      mockMaybeSingleImpl(mockDocument);

      const result = await documentService.getProposalDocumentByType(
        "123e4567-e89b-12d3-a456-426614174001",
        "rfp"
      );

      expect(result).toEqual(mockDocument);
    });

    it("should return null when document type not found", async () => {
      mockMaybeSingleImpl(null);

      const result = await documentService.getProposalDocumentByType(
        "123e4567-e89b-12d3-a456-426614174001",
        "final_proposal"
      );

      expect(result).toBeNull();
    });

    it("should throw an error when database query fails", async () => {
      const PostgrestError = require("@supabase/supabase-js").PostgrestError;
      mockMaybeSingleImpl(null, new PostgrestError("Database error", "DB001"));

      await expect(
        documentService.getProposalDocumentByType("some-id", "rfp")
      ).rejects.toThrow(
        "Failed to get proposal document by type: Database error (DB001)"
      );
    });

    it("should validate returned document data", async () => {
      mockMaybeSingleImpl({
        id: "invalid-uuid",
        proposal_id: "123e4567-e89b-12d3-a456-426614174001",
        document_type: "generated_section",
        file_name: "section.docx",
        file_path: "path/to/file",
      });

      await expect(
        documentService.getProposalDocumentByType(
          "some-id",
          "generated_section"
        )
      ).rejects.toThrow(); // Zod validation error
    });

    it("should accept all valid document types", async () => {
      // Test for 'final_proposal' type
      const finalProposal: DocumentMetadata = {
        id: "123e4567-e89b-12d3-a456-426614174002",
        proposal_id: "123e4567-e89b-12d3-a456-426614174001",
        document_type: "final_proposal",
        file_name: "final.pdf",
        file_path: "proposals/123/final.pdf",
      };

      mockMaybeSingleImpl(finalProposal);

      const result = await documentService.getProposalDocumentByType(
        "123e4567-e89b-12d3-a456-426614174001",
        "final_proposal"
      );

      expect(result).toEqual(finalProposal);
    });
  });

  describe("Custom configuration", () => {
    it("should use custom bucket name when provided", async () => {
      const customBucketService = new DocumentService(
        "test-url",
        "test-key",
        "custom-bucket"
      );

      const mockDocument: DocumentMetadata = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        proposal_id: "123e4567-e89b-12d3-a456-426614174001",
        document_type: "rfp",
        file_name: "test-document.pdf",
        file_path: "proposals/123/test-document.pdf",
      };

      // Mock getDocumentMetadata response
      mockSingleImpl(mockDocument);

      // Mock download response
      const mockBlob = new Blob(["test content"], { type: "application/pdf" });
      mockBlob.arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(16));
      mockDownloadImpl(mockBlob);

      await customBucketService.downloadDocument(mockDocument.id);

      // Check that storage.from was called with the custom bucket name
      const storage = require("@supabase/supabase-js").createClient().storage;
      expect(storage.from).toHaveBeenCalledWith("custom-bucket");
    });
  });
});
