import { SupabaseClient } from "@supabase/supabase-js";
import { serverSupabase as supabase } from "../lib/supabase/client.js";
import { Database } from "../lib/supabase/types/database.types.js";

export interface UserProposalThreadType {
  rfpId: string;
  appGeneratedThreadId: string;
  proposalTitle: string | null;
  createdAt: string;
  updatedAt: string;
  associationId: string; // id of the association record itself
}

type ProposalThreadInsert =
  Database["public"]["Tables"]["user_rfp_proposal_threads"]["Insert"];
type ProposalThreadRow =
  Database["public"]["Tables"]["user_rfp_proposal_threads"]["Row"];

export class ProposalThreadAssociationService {
  private supabase: SupabaseClient<Database>;

  constructor() {
    // Ensure the Supabase client is initialized.
    // If your Supabase client is a singleton or accessed differently, adjust this.
    if (!supabase) {
      throw new Error("Supabase client is not initialized.");
    }
    this.supabase = supabase;
  }

  /**
   * Records a new proposal thread association in the database.
   * @param data - The data for the new proposal thread.
   * @returns An object containing the associationId and a boolean indicating if a new record was created.
   *          If the appGeneratedThreadId already exists, it returns the existing record's ID and newRecord as false.
   */
  async recordNewProposalThread(data: {
    userId: string;
    rfpId: string;
    appGeneratedThreadId: string;
    proposalTitle?: string;
  }): Promise<{ associationId: string; newRecord: boolean; error?: string }> {
    const { userId, rfpId, appGeneratedThreadId, proposalTitle } = data;

    // Check if the appGeneratedThreadId already exists
    const { data: existingThread, error: selectError } = await this.supabase
      .from("user_rfp_proposal_threads")
      .select("id")
      .eq("app_generated_thread_id", appGeneratedThreadId)
      .single();

    if (selectError && selectError.code !== "PGRST116") {
      // PGRST116: 'single' row not found
      console.error("Error checking for existing thread:", selectError);
      return {
        associationId: "",
        newRecord: false,
        error: "Failed to check for existing thread.",
      };
    }

    if (existingThread) {
      return { associationId: existingThread.id, newRecord: false };
    }

    // If not, insert the new record
    const insertData: ProposalThreadInsert = {
      user_id: userId,
      rfp_id: rfpId,
      app_generated_thread_id: appGeneratedThreadId,
      proposal_title: proposalTitle,
      // id, created_at, updated_at are handled by the database
    };

    const { data: newThreadData, error: insertError } = await this.supabase
      .from("user_rfp_proposal_threads")
      .insert(insertData)
      .select("id")
      .single();

    if (insertError) {
      console.error("Error inserting new proposal thread:", insertError);
      return {
        associationId: "",
        newRecord: false,
        error: "Failed to record new proposal thread.",
      };
    }

    if (!newThreadData) {
      return {
        associationId: "",
        newRecord: false,
        error: "Failed to retrieve new proposal thread ID after insert.",
      };
    }

    return { associationId: newThreadData.id, newRecord: true };
  }

  /**
   * Lists proposal thread associations for a given user, optionally filtered by rfpId.
   * @param userId - The ID of the user.
   * @param rfpId - Optional. The ID of the RFP to filter by.
   * @returns A promise that resolves to an array of UserProposalThreadType.
   */
  async listUserProposalThreads(
    userId: string,
    rfpId?: string
  ): Promise<UserProposalThreadType[] | null> {
    let query = this.supabase
      .from("user_rfp_proposal_threads")
      .select(
        "id, rfp_id, app_generated_thread_id, proposal_title, created_at, updated_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (rfpId) {
      query = query.eq("rfp_id", rfpId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error listing user proposal threads:", error);
      return null;
    }

    return data.map((row) => ({
      associationId: row.id,
      rfpId: row.rfp_id,
      appGeneratedThreadId: row.app_generated_thread_id,
      proposalTitle: row.proposal_title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }
}
