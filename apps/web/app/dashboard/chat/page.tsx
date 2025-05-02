"use client";

import { Thread } from "@/features/chat-ui";
import { ThreadProvider } from "@/features/chat-ui";
import { ThreadHistory } from "@/features/chat-ui/components/ThreadHistory";
import { Toaster } from "sonner";
import React from "react";
import { useSearchParams } from "next/navigation";
import { useStreamContext } from "@/features/chat-ui/providers/StreamProvider";

export default function ChatPage(): React.ReactNode {
  const searchParams = useSearchParams();
  const rfpId = searchParams.get("rfpId");
  const { setInitialRfpId } = useStreamContext();

  // Set the RFP ID for the StreamProvider from the parent layout
  React.useEffect(() => {
    if (rfpId) {
      setInitialRfpId(rfpId);
    }
  }, [rfpId, setInitialRfpId]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Toaster />
      <ThreadProvider>
        <ThreadHistory />
        <div className="flex-1 overflow-hidden">
          <Thread />
        </div>
      </ThreadProvider>
    </div>
  );
}
