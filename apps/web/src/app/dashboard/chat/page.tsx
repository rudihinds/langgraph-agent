"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { Thread } from "@/features/chat-ui/components/Thread";
// StreamProvider and InterruptProvider are no longer needed here
// import { StreamProvider } from "@/features/chat-ui/providers/StreamProvider";
// import { InterruptProvider } from "@/features/chat-ui/providers/InterruptProvider";
import { Toaster } from "sonner";

export default function ChatPage(): React.ReactNode {
  const searchParams = useSearchParams();
  const rfpId = searchParams.get("rfpId");

  console.log("[ChatPage] Rendering with rfpId:", rfpId);

  return (
    // Remove StreamProvider and InterruptProvider wrapping here
    <main className="flex flex-col h-[calc(100vh-4rem)] p-4">
      <Toaster />
      <Thread />
    </main>
  );
}
