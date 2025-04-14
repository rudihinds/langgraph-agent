import { createClient, PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";
import { serverSupabase } from "../supabase/client.js";
import { getFileExtension, getMimeTypeFromExtension } from "../utils/files.js";
import { parseRfpFromBuffer } from "../parsers/rfp.js";
import { Logger } from "@/lib/logger.js";

/**
 * Schema for document metadata validation based on actual database schema
 */
export const DocumentMetadataSchema = z.object({
  id: z.string().uuid(),
  proposal_id: z.string().uuid(),
  document_type: z.enum([
    "rfp",
    "generated_section",
    "final_proposal",
    "supplementary",
  ]),
  file_name: z.string(),
  file_path: z.string(),
  file_type: z.string().optional(),
  size_bytes: z.number().optional(),
  created_at: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>;

// Custom type for storage errors since Supabase doesn't export this directly
interface StorageError {
  message: string;
  status?: number;
}

// Initialize logger
const logger = Logger.getInstance();

// Storage bucket name
const DOCUMENTS_BUCKET = "proposal-documents";

/**
 * Document data interface
 */
export interface Document {
  id: string;
  text: string;
  metadata: DocumentMetadata;
}

/**
 * Service for handling document operations
 */
export class DocumentService {
  private supabase;
  private bucket: string;

  constructor(
    supabaseUrl = process.env.SUPABASE_URL || "",
    supabaseKey = process.env.SUPABASE_SERVICE_KEY || "",
    bucket = "proposal-documents"
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.bucket = bucket;
  }

  /**
   * Fetch document metadata from the database
   * @param documentId - The ID of the document to retrieve
   * @returns Document metadata
   */
  async getDocumentMetadata(documentId: string): Promise<DocumentMetadata> {
    const { data, error } = await this.supabase
      .from("proposal_documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (error) {
      throw new Error(
        `Failed to retrieve document metadata: ${error.message} (${(error as PostgrestError).code || "unknown"})`
      );
    }

    return DocumentMetadataSchema.parse(data);
  }

  /**
   * Download document from Supabase storage
   * @param documentId - The ID of the document to download
   * @returns Buffer containing document data and metadata
   */
  async downloadDocument(documentId: string): Promise<{
    buffer: Buffer;
    metadata: DocumentMetadata;
  }> {
    // Fetch metadata to get file path
    const metadata = await this.getDocumentMetadata(documentId);

    // Download the file using the file_path from metadata
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .download(metadata.file_path);

    if (error || !data) {
      throw new Error(
        `Failed to download document: ${error?.message || "Unknown error"} (${(error as StorageError)?.status || "unknown"})`
      );
    }

    // Convert blob to buffer
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return { buffer, metadata };
  }

  /**
   * List documents for a specific proposal
   * @param proposalId - The ID of the proposal
   * @returns Array of document metadata
   */
  async listProposalDocuments(proposalId: string): Promise<DocumentMetadata[]> {
    const { data, error } = await this.supabase
      .from("proposal_documents")
      .select("*")
      .eq("proposal_id", proposalId);

    if (error) {
      throw new Error(
        `Failed to list proposal documents: ${error.message} (${(error as PostgrestError).code || "unknown"})`
      );
    }

    return z.array(DocumentMetadataSchema).parse(data || []);
  }

  /**
   * Get a specific document by type for a proposal
   * @param proposalId - The ID of the proposal
   * @param documentType - The type of document to retrieve
   * @returns Document metadata if found
   */
  async getProposalDocumentByType(
    proposalId: string,
    documentType:
      | "rfp"
      | "generated_section"
      | "final_proposal"
      | "supplementary"
  ): Promise<DocumentMetadata | null> {
    const { data, error } = await this.supabase
      .from("proposal_documents")
      .select("*")
      .eq("proposal_id", proposalId)
      .eq("document_type", documentType)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to get proposal document by type: ${error.message} (${(error as PostgrestError).code || "unknown"})`
      );
    }

    return data ? DocumentMetadataSchema.parse(data) : null;
  }

  /**
   * Retrieves a document by ID from storage and parses its contents.
   *
   * @param documentId - The document ID to retrieve
   * @returns The parsed document with text and metadata
   * @throws Error if the document cannot be retrieved or parsed
   */
  public static async getDocumentById(documentId: string): Promise<Document> {
    logger.info("Retrieving document by ID", { documentId });

    // Construct the document path
    const documentPath = `documents/${documentId}.pdf`;

    try {
      // First try to get file metadata
      let fileMetadata = null;
      try {
        const { data, error } = await serverSupabase.storage
          .from(DOCUMENTS_BUCKET)
          .list(`documents/`, {
            limit: 1,
            offset: 0,
            search: `${documentId}.pdf`,
          });

        if (error) {
          logger.warn("Failed to get file metadata", {
            documentId,
            error: error.message,
          });
        } else if (data && data.length > 0) {
          fileMetadata = data[0];
        }
      } catch (error: any) {
        logger.warn("Error listing file metadata", {
          documentId,
          error: error.message,
        });
      }

      // Download the document
      const { data, error } = await serverSupabase.storage
        .from(DOCUMENTS_BUCKET)
        .download(documentPath);

      if (error) {
        logger.error("Failed to download document", {
          documentId,
          error: error.message,
        });
        throw new Error(`Failed to retrieve document: ${error.message}`);
      }

      if (!data) {
        logger.error("Document data is null", { documentId });
        throw new Error("Document data is null");
      }

      // Determine file type from metadata or extension
      const mimeType = fileMetadata?.metadata?.mimetype;
      const extension = getFileExtension(documentPath);
      const fileType = mimeType?.split("/").pop() || extension || "txt";

      // Parse the document
      const documentBuffer = Buffer.from(await data.arrayBuffer());
      const result = await parseRfpFromBuffer(
        documentBuffer,
        fileType,
        documentPath
      );

      return {
        id: documentId,
        text: result.text,
        metadata: {
          ...result.metadata,
          ...(fileMetadata?.metadata || {}),
        },
      };
    } catch (error: any) {
      logger.error("Error in getDocumentById", {
        documentId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Uploads a document to storage and returns its metadata.
   *
   * @param file - The file Buffer to upload
   * @param filename - The filename to use
   * @param metadata - Optional additional metadata
   * @returns The document metadata including the generated ID
   */
  public static async uploadDocument(
    file: Buffer,
    filename: string,
    metadata: Partial<DocumentMetadata> = {}
  ): Promise<{ id: string; metadata: DocumentMetadata }> {
    // Generate a unique document ID
    const documentId = crypto.randomUUID();

    // Get file extension and format
    const extension = getFileExtension(filename) || "txt";
    const mimeType = getMimeTypeFromExtension(extension);

    // Create document path
    const documentPath = `documents/${documentId}.${extension}`;

    logger.info("Uploading document", {
      documentId,
      filename,
      size: file.length,
      mimeType,
    });

    try {
      // Upload to Supabase storage
      const { error } = await serverSupabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(documentPath, file, {
          contentType: mimeType,
          upsert: false,
        });

      if (error) {
        logger.error("Failed to upload document", {
          documentId,
          error: error.message,
        });
        throw new Error(`Failed to upload document: ${error.message}`);
      }

      // Parse document to extract text and metadata
      const result = await parseRfpFromBuffer(file, extension);

      // Combine metadata
      const documentMetadata: DocumentMetadata = {
        format: extension,
        size: file.length,
        createdAt: new Date().toISOString(),
        ...result.metadata,
        ...metadata,
      };

      return {
        id: documentId,
        metadata: documentMetadata,
      };
    } catch (error: any) {
      logger.error("Error in uploadDocument", {
        filename,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Deletes a document from storage.
   *
   * @param documentId - The document ID to delete
   * @returns True if successful
   */
  public static async deleteDocument(documentId: string): Promise<boolean> {
    logger.info("Deleting document", { documentId });

    try {
      const { error } = await serverSupabase.storage
        .from(DOCUMENTS_BUCKET)
        .remove([`documents/${documentId}.pdf`]);

      if (error) {
        logger.error("Failed to delete document", {
          documentId,
          error: error.message,
        });
        return false;
      }

      return true;
    } catch (error: any) {
      logger.error("Error in deleteDocument", {
        documentId,
        error: error.message,
      });
      return false;
    }
  }
}
