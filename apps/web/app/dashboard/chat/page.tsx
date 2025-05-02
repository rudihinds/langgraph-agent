"use client";

import { Thread, StreamProvider, ThreadProvider } from "@/features/chat-ui";
import { ThreadHistory } from "@/features/chat-ui/components/ThreadHistory";
import { Toaster } from "sonner";
import React from "react";
import { useSearchParams } from "next/navigation";

export default function ChatPage(): React.ReactNode {
  const searchParams = useSearchParams();
  const rfpId = searchParams.get("rfpId");

  return (
    <div className="flex h-screen overflow-hidden">
      <Toaster />
      <ThreadProvider>
        <StreamProvider initialRfpId={rfpId}>
          <ThreadHistory />
          <div className="flex-1 overflow-hidden">
            <Thread />
          </div>
        </StreamProvider>
      </ThreadProvider>
    </div>
  );
}
