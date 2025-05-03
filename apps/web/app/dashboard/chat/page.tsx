"use client";

import { Thread } from "@/features/chat-ui";
import { Toaster } from "sonner";
import React, { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useStreamContext } from "@/features/chat-ui/providers/StreamProvider";

export default function ChatPage(): React.ReactNode {
  const searchParams = useSearchParams();
  const rfpId = searchParams.get("rfpId");
  const streamContext = useStreamContext();

  // Log connection status for debugging
  useEffect(() => {
    console.log("[ChatPage] Connection status:", {
      context: streamContext,
      hasRfpId: Boolean(rfpId),
    });
  }, [streamContext, rfpId]);

  // Set the RFP ID for the StreamProvider from the URL parameter
  useEffect(() => {
    if (rfpId && streamContext?.setInitialRfpId) {
      console.log("[ChatPage] Setting RFP ID from URL:", rfpId);
      streamContext.setInitialRfpId(rfpId);
    }
  }, [rfpId, streamContext]);

  return (
    <main className="flex flex-col h-[calc(100vh-4rem)] p-4">
      <Toaster />
      <Thread />
    </main>
  );
}
