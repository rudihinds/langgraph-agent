"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { PostgresCheckpointer } from "@/lib/checkpoint/PostgresCheckpointer";
import { ProposalStateType } from "@/lib/state/proposalState";

export type Proposal = {
  id: string;
  title: string;
  organization?: string;
  status: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
  phase?: string;
};

export async function getProposals(): Promise<Proposal[]> {
  try {
    console.log("[Proposals] Starting getProposals function");

    // Use our server Supabase client with proper await
    const supabase = await createServerSupabaseClient();

    // Get current user session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      console.log(
        "[Proposals] No user session found, returning empty proposals"
      );
      return [];
    }

    console.log("[Proposals] Got session for user:", session.user.email);

    try {
      // Using the checkpointer to get proposal data
      const checkpointer = new PostgresCheckpointer({
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseKey: process.env.SUPABASE_SERVICE_KEY!,
        userId: session.user.id,
      });

      // Query checkpoints directly
      const { data, error } = await supabase
        .from("proposal_checkpoints")
        .select("proposal_id, namespace, state, created_at, updated_at")
        .eq("user_id", session.user.id)
        .not("namespace", "like", "proposal_sessions:%")
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("[Proposals] Error fetching proposals:", error);
        return [];
      }

      if (!data || data.length === 0) {
        console.log("[Proposals] No proposals found for user");
        return [];
      }

      console.log(`[Proposals] Found ${data.length} raw checkpoint records`);

      // Process proposals
      const proposals: Proposal[] = data.map((item) => {
        let state: Partial<ProposalStateType> = {};

        try {
          // Try to deserialize state
          if (typeof item.state === "object") {
            state = item.state;
          }
        } catch (e) {
          console.error(
            "[Proposals] Error deserializing state for proposal:",
            item.proposal_id,
            e
          );
        }

        // Calculate progress from section status
        const progress = calculateProgress(state?.sectionStatus || {});

        return {
          id: item.proposal_id,
          title: state?.metadata?.proposalTitle || "Untitled Proposal",
          organization: state?.metadata?.organization,
          status: state?.metadata?.status || "in_progress",
          progress,
          phase: state?.currentPhase,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        };
      });

      console.log(
        `[Proposals] Successfully processed ${proposals.length} proposals`
      );
      return proposals;
    } catch (dbError) {
      console.error("[Proposals] Database error:", dbError);
      return [];
    }
  } catch (error) {
    console.error("[Proposals] Error in getProposals:", error);
    return [];
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
