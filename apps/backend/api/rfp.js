// Simple placeholder file for the RFP API module
import { serverSupabase } from "@/lib/supabase/server.js";

export async function continueProposal(req, res) {
  const { proposalId } = req.params;
  const { userId } = req.query;

  if (!proposalId) {
    return res.status(400).json({ error: "Missing proposal ID" });
  }

  try {
    // Check if user has access to this proposal
    const { data, error } = await serverSupabase
      .from("proposals")
      .select("*")
      .eq("id", proposalId)
      .eq("user_id", userId)
      .single();

    if (error) {
      // Check if this is a database error or just no results
      if (error.code && error.code.startsWith("PGRST")) {
        return res
          .status(500)
          .json({ error: `Database error: ${error.message}` });
      }

      // Not found or permission denied
      return res.status(404).json({ error: "Proposal not found" });
    }

    if (!data) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    return res.json({
      success: true,
      threadId: proposalId,
      proposalId,
      status: data.status,
    });
  } catch (err) {
    return res.status(500).json({ error: `Database error: ${err.message}` });
  }
}
