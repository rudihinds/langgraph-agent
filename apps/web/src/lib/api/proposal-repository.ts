import { SupabaseClient } from "@supabase/supabase-js";
import { ProposalType } from "../schemas/proposal-schema";

/**
 * Repository for managing proposal data in Supabase
 */
export class ProposalRepository {
  private client: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    this.client = supabaseClient;
  }

  /**
   * Create a new proposal
   * @param proposal The proposal data to create
   * @param userId The ID of the user creating the proposal
   */
  async createProposal(proposal: ProposalType, userId: string) {
    const newProposal = {
      ...proposal,
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.client
      .from("proposals")
      .insert(newProposal)
      .select("id, title, proposal_type, created_at, status")
      .single();

    if (error) {
      throw new Error(`Failed to create proposal: ${error.message}`);
    }

    return data;
  }

  /**
   * Get a proposal by ID
   * @param proposalId The ID of the proposal to retrieve
   * @param userId The ID of the user who owns the proposal
   */
  async getProposal(proposalId: string, userId: string) {
    const { data, error } = await this.client
      .from("proposals")
      .select("*")
      .eq("id", proposalId)
      .eq("user_id", userId)
      .single();

    if (error) {
      throw new Error(`Failed to get proposal: ${error.message}`);
    }

    return data;
  }

  /**
   * Get all proposals for a user
   * @param userId The ID of the user
   * @param type Optional filter by proposal type
   * @param status Optional filter by status
   * @param limit Maximum number of results to return
   * @param offset Pagination offset
   */
  async getProposals(
    userId: string,
    type?: string,
    status?: string,
    limit = 50,
    offset = 0
  ) {
    let query = this.client
      .from("proposals")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)
      .offset(offset);

    if (type) {
      query = query.eq("proposal_type", type);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get proposals: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update an existing proposal
   * @param proposalId The ID of the proposal to update
   * @param updates The fields to update
   * @param userId The ID of the user who owns the proposal
   */
  async updateProposal(
    proposalId: string,
    updates: Partial<ProposalType>,
    userId: string
  ) {
    const { data, error } = await this.client
      .from("proposals")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", proposalId)
      .eq("user_id", userId)
      .select("id, title, proposal_type, updated_at, status")
      .single();

    if (error) {
      throw new Error(`Failed to update proposal: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a proposal
   * @param proposalId The ID of the proposal to delete
   * @param userId The ID of the user who owns the proposal
   */
  async deleteProposal(proposalId: string, userId: string) {
    const { error } = await this.client
      .from("proposals")
      .delete()
      .eq("id", proposalId)
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to delete proposal: ${error.message}`);
    }

    return true;
  }

  /**
   * Upload a document for an RFP proposal
   * @param file The file to upload
   * @param proposalId The ID of the proposal
   * @param userId The ID of the user
   */
  async uploadProposalDocument(
    file: File,
    proposalId: string,
    userId: string
  ) {
    // Create a unique file path using proposal ID and original filename
    const filePath = `${userId}/${proposalId}/${file.name}`;

    // Upload the file to Supabase Storage
    const { data, error } = await this.client.storage
      .from("proposal-documents")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (error) {
      throw new Error(`Failed to upload document: ${error.message}`);
    }

    // Get the public URL for the uploaded file
    const { data: urlData } = this.client.storage
      .from("proposal-documents")
      .getPublicUrl(filePath);

    // Update the proposal with the document information
    await this.updateProposal(
      proposalId,
      {
        rfp_document: {
          name: file.name,
          url: urlData.publicUrl,
          size: file.size,
          type: file.type,
        },
      } as Partial<ProposalType>,
      userId
    );

    return {
      path: filePath,
      url: urlData.publicUrl,
      name: file.name,
      size: file.size,
      type: file.type,
    };
  }
}