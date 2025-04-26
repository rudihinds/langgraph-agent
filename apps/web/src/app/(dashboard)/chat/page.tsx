"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Toaster } from "sonner";
import { Thread } from "../../../components/chat-ui/thread/index.js";
import { ThreadProvider } from "../../../components/chat-ui/providers/Thread.js";
import { StreamProvider } from "../../../components/chat-ui/providers/Stream.js";

export default function ChatPage() {
  const searchParams = useSearchParams();
  const rfpId = searchParams.get("rfpId") || "";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Toaster position="top-right" />

      <Suspense
        fallback={
          <div
            className="flex items-center justify-center h-full"
            role="progressbar"
          >
            Loading conversation...
          </div>
        }
      >
        <ThreadProvider>
          <StreamProvider rfpId={rfpId}>
            <Thread />
          </StreamProvider>
        </ThreadProvider>
      </Suspense>
    </div>
  );
}
