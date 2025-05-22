import React, { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useThreads } from "@/features/chat-ui/providers/ThreadProvider"; // Adjusted import path
import ProposalListItem from "@/features/thread/components/ProposalListItem";
import { Button } from "@/features/ui/components/button"; // Assuming Button component exists
import { UserProposalThreadType } from "@/lib/api.js"; // Import the type

// Placeholder for a UI component that might show loading state
// Styled with Tailwind for now
const LoadingSpinner = () => (
  <p className="p-4 text-center text-muted-foreground">Loading threads...</p>
);

const ProposalThreadsList: React.FC = () => {
  const {
    applicationThreads,
    getApplicationThreads,
    appThreadsLoading,
    error, // Destructure error state
  } = useThreads();
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

  // Handle error state
  if (error && !appThreadsLoading) {
    return (
      <div className="p-4 text-center text-destructive-foreground bg-destructive/10 border border-destructive/30 rounded-md">
        <p className="mb-2">Could not load your proposal sessions.</p>
        <p className="mb-4 text-sm">Error: {error.message}</p>
        <Button
          variant="outline"
          onClick={() => getApplicationThreads(rfpIdFromParams || undefined)}
        >
          Try Again
        </Button>
      </div>
    );
  }

  const threadsToDisplay = rfpIdFromParams
    ? applicationThreads.filter((thread) => thread.rfpId === rfpIdFromParams)
    : applicationThreads;

  return (
    <div className="flex flex-col h-full">
      {" "}
      {/* Removed inline styles, added flex layout */}
      <div className="px-4 mb-4">
        {" "}
        {/* Replaced inline style with Tailwind margin */}
        <Button
          onClick={handleStartNewProposal}
          disabled={!rfpIdFromParams}
          className="w-full"
        >
          {" "}
          {/* Added w-full for better sidebar appearance */}
          Start New Proposal
        </Button>
      </div>
      {threadsToDisplay.length === 0 && !appThreadsLoading && (
        <p className="p-4 text-center text-muted-foreground">
          {" "}
          {/* Styled with Tailwind */}
          No proposal threads found{rfpIdFromParams ? " for this RFP" : ""}.
        </p>
      )}
      {/* Optionally, wrap list in a scrollable div if content exceeds height */}
      <div className="flex-grow space-y-2 overflow-y-auto">
        {" "}
        {/* Added for scrolling and item spacing */}
        {threadsToDisplay.map((thread: UserProposalThreadType) => (
          <ProposalListItem
            key={thread.appGeneratedThreadId}
            threadId={thread.appGeneratedThreadId}
            title={thread.proposalTitle}
            createdAt={thread.createdAt}
            rfpId={thread.rfpId}
            onSelect={handleSelectThread}
          />
        ))}
      </div>
    </div>
  );
};

export default ProposalThreadsList;
