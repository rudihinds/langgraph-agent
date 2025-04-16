"use server";

import { ProposalStatus } from "@/types";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

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
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

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
async function getProposalById(id: string) {
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

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

function calculateProgress(sectionStatus: Record<string, string>): number {
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
