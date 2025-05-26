import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

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
    const supabase = await createClient(cookies());

    const { data: document, error } = await supabase
      .from("proposal_documents")
      .insert(data)
      .select()
      .single();

    if (error) {
      console.error("Failed to create document record", {
        data,
        error: error.message,
      });
      throw new Error(`Failed to create document record: ${error.message}`);
    }

    // Update the proposal's rfp_document_id
    await supabase
      .from("proposals")
      .update({ rfp_document_id: document.id })
      .eq("id", data.proposal_id);

    return document;
  }

  /**
   * Get document by proposal ID
   */
  static async getByProposalId(
    proposalId: string
  ): Promise<ProposalDocument | null> {
    const supabase = await createClient(cookies());

    const { data, error } = await supabase
      .from("proposal_documents")
      .select("*")
      .eq("proposal_id", proposalId)
      .maybeSingle();

    if (error) {
      console.error("Failed to get proposal document", {
        proposalId,
        error: error.message,
      });
      throw new Error(`Failed to get proposal document: ${error.message}`);
    }

    return data;
  }

  /**
   * Get storage object ID by file path
   */
  static async getStorageObjectId(filePath: string): Promise<string | null> {
    const supabase = await createClient(cookies());

    // Extract folder and filename from path
    const pathParts = filePath.split("/");
    const folder = pathParts[0];
    const filename = pathParts[1];

    const { data: objects } = await supabase.storage
      .from("proposal-documents")
      .list(folder);

    const storageObject = objects?.find((obj) => obj.name === filename);
    return storageObject?.id || null;
  }
}
