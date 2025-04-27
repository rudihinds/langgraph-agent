"use server";

import { ProposalStatus } from "@/types";
import { createClient } from "@/features/auth/utils/server";

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

    return data || [];
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

/**
 * Calculate proposal progress based on section statuses
 */
export function calculateProgress(
  sectionStatus: Record<string, string>
): number {
  if (!sectionStatus || Object.keys(sectionStatus).length === 0) {
    return 0;
  }

  const sections = Object.values(sectionStatus);
  const totalSections = sections.length;

  if (totalSections === 0) return 0;

  const completedSections = sections.filter(
    (status) => status === "completed"
  ).length;
  const inProgressSections = sections.filter(
    (status) => status === "in_progress"
  ).length;

  // Completed sections count fully, in progress ones count as half-completed
  const progress =
    (completedSections + inProgressSections * 0.5) / totalSections;

  return Math.round(progress * 100);
}
