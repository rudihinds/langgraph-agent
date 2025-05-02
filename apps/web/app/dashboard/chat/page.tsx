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
    <div className="flex h-[calc(100vh-10rem)] w-full overflow-hidden -mt-6 -ml-6 -mr-6">
      <Toaster />
      <ThreadProvider>
        <div className="flex h-full w-full">
          <ThreadHistory />
          <div className="flex-1 h-full overflow-hidden">
            <Thread />
          </div>
        </div>
      </ThreadProvider>
    </div>
  );
}
