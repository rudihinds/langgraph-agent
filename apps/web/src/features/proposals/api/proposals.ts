"use server";

import { createClient } from "@/lib/supabase/server";
import { calculateProgress } from "@/features/proposals/utils/calculations";

// Define the status type here to avoid external dependencies
export type ProposalStatus =
  | "draft"
  | "submitted"
  | "in_progress"
  | "completed"
  | "rejected";

export type Proposal = {
  id: string;
  title: string;
  organization?: string;
  status: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
  phase?: string;
  dueDate?: string;
  associatedThreadId?: string | null;
};

/**
 * Get all proposals for the current user
 */
export async function getUserProposals(
  status?: ProposalStatus,
  page: number = 1,
  limit: number = 10
) {
  try {
    // Use the createClient without directly passing cookieStore
    // This ensures it follows Supabase SSR best practices internally
    const supabase = await createClient();

    // Get the user's session
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError || !sessionData?.session) {
      throw new Error(sessionError?.message || "User is not authenticated");
    }

    // Construct the query
    let query = supabase
      .from("proposals")
      .select("*")
      .eq("user_id", sessionData.session.user.id)
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    // Filter by status if provided
    if (status) {
      query = query.eq("status", status);
    }

    // Execute the query
    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // For each proposal, fetch the latest associated thread_id
    const proposalsWithThreads = await Promise.all(
      (data || []).map(async (proposal) => {
        const { data: threadData, error: threadError } = await supabase
          .from("user_rfp_proposal_threads")
          .select("app_generated_thread_id")
          .eq("rfp_id", proposal.id)
          .eq("user_id", sessionData.session.user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single(); // Expecting one or null

        if (threadError && threadError.code !== "PGRST116") {
          // PGRST116: 'single' row not found, which is fine
          console.error(
            `Error fetching thread for proposal ${proposal.id}:`,
            threadError
          );
          // Decide if you want to throw, or just return proposal without threadId
        }
        return {
          ...proposal,
          associatedThreadId: threadData?.app_generated_thread_id || null,
        };
      })
    );

    console.log(
      "[getUserProposals] Proposals with threads:",
      JSON.stringify(proposalsWithThreads, null, 2)
    );
    return proposalsWithThreads;
  } catch (error) {
    console.error("Error fetching user proposals:", error);
    throw error;
  }
}

/**
 * Get a proposal by ID, ensuring it belongs to the current user
 */
export async function getProposalById(id: string) {
  try {
    // Use the createClient without directly passing cookieStore
    const supabase = await createClient();

    // Get the user's session
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError || !sessionData?.session) {
      throw new Error(sessionError?.message || "User is not authenticated");
    }

    // Get the proposal with the given ID, ensuring it belongs to the current user
    const { data, error } = await supabase
      .from("proposals")
      .select("*")
      .eq("id", id)
      .eq("user_id", sessionData.session.user.id)
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Error fetching proposal by ID:", error);
    throw error;
  }
}

/**
 * Create a new proposal
 * @param proposal The proposal data to create
 */
export async function createProposal(proposal: Partial<Proposal>) {
  try {
    const supabase = await createClient();

    // Get the user's session
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError || !sessionData?.session) {
      throw new Error(sessionError?.message || "User is not authenticated");
    }

    const newProposal = {
      ...proposal,
      user_id: sessionData.session.user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("proposals")
      .insert(newProposal)
      .select("id, title, created_at, status")
      .single();

    if (error) {
      throw new Error(`Failed to create proposal: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error("Error creating proposal:", error);
    throw error;
  }
}

/**
 * Update an existing proposal
 * @param proposalId The ID of the proposal to update
 * @param updates The fields to update
 */
export async function updateProposal(
  proposalId: string,
  updates: Partial<Proposal>
) {
  try {
    const supabase = await createClient();

    // Get the user's session
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError || !sessionData?.session) {
      throw new Error(sessionError?.message || "User is not authenticated");
    }

    const { data, error } = await supabase
      .from("proposals")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", proposalId)
      .eq("user_id", sessionData.session.user.id)
      .select("id, title, updated_at, status")
      .single();

    if (error) {
      throw new Error(`Failed to update proposal: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error("Error updating proposal:", error);
    throw error;
  }
}

/**
 * Delete a proposal
 * @param proposalId The ID of the proposal to delete
 */
export async function deleteProposal(proposalId: string) {
  try {
    const supabase = await createClient();

    // Get the user's session
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError || !sessionData?.session) {
      throw new Error(sessionError?.message || "User is not authenticated");
    }

    const { error } = await supabase
      .from("proposals")
      .delete()
      .eq("id", proposalId)
      .eq("user_id", sessionData.session.user.id);

    if (error) {
      throw new Error(`Failed to delete proposal: ${error.message}`);
    }

    return true;
  } catch (error) {
    console.error("Error deleting proposal:", error);
    throw error;
  }
}

/**
 * Upload a document for a proposal
 * @param file The file to upload
 * @param proposalId The ID of the proposal
 */
export async function uploadProposalDocument(file: File, proposalId: string) {
  try {
    const supabase = await createClient();

    // Get the user's session
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError || !sessionData?.session) {
      throw new Error(sessionError?.message || "User is not authenticated");
    }

    const userId = sessionData.session.user.id;

    // Create a unique file path using proposal ID and original filename
    const filePath = `${userId}/${proposalId}/${file.name}`;

    // Upload the file to Supabase Storage
    const { data, error } = await supabase.storage
      .from("proposal-documents")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (error) {
      throw new Error(`Failed to upload document: ${error.message}`);
    }

    // Get the public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from("proposal-documents")
      .getPublicUrl(filePath);

    // Update the proposal with the document information
    await updateProposal(proposalId, {
      rfp_document: {
        name: file.name,
        url: urlData.publicUrl,
        size: file.size,
        type: file.type,
      },
    } as unknown as Partial<Proposal>);

    return {
      path: filePath,
      url: urlData.publicUrl,
      name: file.name,
      size: file.size,
      type: file.type,
    };
  } catch (error) {
    console.error("Error uploading proposal document:", error);
    throw error;
  }
}
