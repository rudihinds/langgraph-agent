import { serverSupabase } from "../supabase/client.js";
import { Logger } from "../logger.js";
import { parseRfpFromBuffer } from "../parsers/rfp.js";

const logger = Logger.getInstance();
const BUCKET_NAME = "proposal-documents";

export interface ProposalDocument {
  id: string;
  proposal_id: string;
  file_name: string;
  file_path: string;
  file_type?: string;
  size_bytes?: number;
  storage_object_id?: string;
  parsed_text?: string;
  parsed_at?: string;
  parsing_status: "pending" | "success" | "failed";
  created_at: string;
  updated_at: string;
}

export class ProposalDocumentService {
  /**
   * Get document by proposal ID
   */
  static async getByProposalId(
    proposalId: string
  ): Promise<ProposalDocument | null> {
    const { data, error } = await serverSupabase
      .from("proposal_documents")
      .select("*")
      .eq("proposal_id", proposalId)
      .maybeSingle();

    if (error) {
      logger.error("Failed to get proposal document", {
        proposalId,
        error: error.message,
      });
      throw new Error(`Failed to get proposal document: ${error.message}`);
    }

    return data;
  }

  /**
   * Get document by document ID
   */
  static async getById(documentId: string): Promise<ProposalDocument | null> {
    const { data, error } = await serverSupabase
      .from("proposal_documents")
      .select("*")
      .eq("id", documentId)
      .maybeSingle();

    if (error) {
      logger.error("Failed to get document", {
        documentId,
        error: error.message,
      });
      throw new Error(`Failed to get document: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new document record (called on upload)
   */
  static async create(data: {
    proposal_id: string;
    file_name: string;
    file_path: string;
    file_type?: string;
    size_bytes?: number;
    storage_object_id?: string;
  }): Promise<ProposalDocument> {
    const { data: document, error } = await serverSupabase
      .from("proposal_documents")
      .insert(data)
      .select()
      .single();

    if (error) {
      logger.error("Failed to create document record", {
        data,
        error: error.message,
      });
      throw new Error(`Failed to create document record: ${error.message}`);
    }

    // Update the proposal's rfp_document_id
    await serverSupabase
      .from("proposals")
      .update({ rfp_document_id: document.id })
      .eq("id", data.proposal_id);

    return document;
  }

  /**
   * Download and parse document text
   */
  static async parseDocument(
    documentId: string
  ): Promise<{ text: string; metadata: any }> {
    const document = await this.getById(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    logger.info("Downloading document for parsing", {
      documentId,
      filePath: document.file_path,
    });

    // Download from storage
    const { data: fileData, error: downloadError } =
      await serverSupabase.storage
        .from(BUCKET_NAME)
        .download(document.file_path);

    if (downloadError || !fileData) {
      logger.error("Failed to download document", {
        documentId,
        filePath: document.file_path,
        error: downloadError?.message,
      });
      throw new Error(`Failed to download document: ${downloadError?.message}`);
    }

    // Convert to buffer and parse
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileExtension = document.file_name.split(".").pop() || "txt";
    const result = await parseRfpFromBuffer(
      buffer,
      fileExtension,
      document.file_name
    );

    return result;
  }

  /**
   * Update document with parsed text
   */
  static async updateParsedText(
    documentId: string,
    parsedText: string,
    metadata?: any
  ): Promise<void> {
    const { error } = await serverSupabase
      .from("proposal_documents")
      .update({
        parsed_text: parsedText,
        parsed_at: new Date().toISOString(),
        parsing_status: "success",
      })
      .eq("id", documentId);

    if (error) {
      logger.error("Failed to update parsed text", {
        documentId,
        error: error.message,
      });
      throw new Error(`Failed to update parsed text: ${error.message}`);
    }

    // Also update the proposals table for quick access
    const document = await this.getById(documentId);
    if (document) {
      await serverSupabase
        .from("proposals")
        .update({
          rfp_text: parsedText,
          rfp_parsed_at: new Date().toISOString(),
        })
        .eq("id", document.proposal_id);
    }

    logger.info("Successfully updated parsed text", {
      documentId,
      textLength: parsedText.length,
    });
  }

  /**
   * Mark document parsing as failed
   */
  static async markParsingFailed(
    documentId: string,
    error: string
  ): Promise<void> {
    await serverSupabase
      .from("proposal_documents")
      .update({
        parsing_status: "failed",
        parsed_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    logger.error("Document parsing failed", { documentId, error });
  }

  /**
   * Get document text (from parsed_text or parse on demand)
   */
  static async getDocumentText(documentId: string): Promise<string> {
    const document = await this.getById(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    // Return cached text if available
    if (document.parsed_text && document.parsing_status === "success") {
      return document.parsed_text;
    }

    // Parse on demand if not cached
    if (
      document.parsing_status === "pending" ||
      document.parsing_status === "failed"
    ) {
      try {
        const result = await this.parseDocument(documentId);
        await this.updateParsedText(documentId, result.text, result.metadata);
        return result.text;
      } catch (error) {
        await this.markParsingFailed(
          documentId,
          error instanceof Error ? error.message : "Unknown error"
        );
        throw error;
      }
    }

    throw new Error(`Document ${documentId} parsing failed`);
  }
}
