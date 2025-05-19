import React, { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useThreads } from "../../chat-ui/providers/ThreadProvider.js"; // Adjusted import path
import ProposalListItem from "./ProposalListItem.js";
import { Button } from "@/features/ui/components/button.js"; // Assuming Button component exists
import { UserProposalThreadType } from "@/lib/api.js"; // Import the type

// Placeholder for a UI component that might show loading state
const LoadingSpinner = () => <p>Loading threads...</p>;

const ProposalThreadsList: React.FC = () => {
  const { applicationThreads, getApplicationThreads, appThreadsLoading } =
    useThreads();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = "/chat"; // Assuming chat page is at /chat

  const rfpIdFromParams = searchParams.get("rfpId");

  useEffect(() => {
    // Fetch threads when rfpIdFromParams changes or initially if present
    // The ThreadProvider itself also calls this on session change, so this might be slightly redundant
    // but ensures it's called if rfpId changes specifically for this list.
    if (rfpIdFromParams) {
      getApplicationThreads(rfpIdFromParams);
    } else {
      // If no rfpId, fetch all user threads (or handle as per desired UX)
      getApplicationThreads();
    }
  }, [rfpIdFromParams, getApplicationThreads]);

  const handleSelectThread = (threadId: string, rfpId: string | null) => {
    const newParams = new URLSearchParams();
    if (rfpId) {
      newParams.set("rfpId", rfpId);
    }
    newParams.set("threadId", threadId);
    router.push(`${pathname}?${newParams.toString()}`);
  };

  const handleStartNewProposal = () => {
    if (rfpIdFromParams) {
      // Navigate to chat page with rfpId, StreamProvider will handle new thread creation
      const newParams = new URLSearchParams();
      newParams.set("rfpId", rfpIdFromParams);
      router.push(`${pathname}?${newParams.toString()}`);
    } else {
      // Handle case where no rfpId is in context - e.g., prompt user or navigate to RFP selection
      alert("Please select an RFP first or ensure rfpId is in the URL.");
    }
  };

  if (appThreadsLoading) {
    return <LoadingSpinner />;
  }

  const threadsToDisplay = rfpIdFromParams
    ? applicationThreads.filter((thread) => thread.rfpId === rfpIdFromParams)
    : applicationThreads;

  return (
    <div style={{ padding: "10px", border: "1px solid #eee", height: "100%" }}>
      <div style={{ marginBottom: "10px" }}>
        <Button onClick={handleStartNewProposal} disabled={!rfpIdFromParams}>
          Start New Proposal for Current RFP
        </Button>
      </div>
      {threadsToDisplay.length === 0 && !appThreadsLoading && (
        <p>
          No proposal threads found{rfpIdFromParams ? " for this RFP" : ""}.
        </p>
      )}
      {threadsToDisplay.map((thread: UserProposalThreadType) => (
        <ProposalListItem
          key={thread.appGeneratedThreadId}
          threadId={thread.appGeneratedThreadId}
          title={thread.proposalTitle}
          createdAt={thread.createdAt}
          rfpId={thread.rfpId} // Pass rfpId to item for selection logic
          onSelect={handleSelectThread}
        />
      ))}
    </div>
  );
};

export default ProposalThreadsList;
