"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { Thread } from "@/features/chat-ui/components/Thread";
import AgentProvidersWrapper from "@/features/chat-ui/providers/AgentProvidersWrapper.js";
import DashboardLayout from "@/features/layout/components/DashboardLayout.js";
import { Toaster } from "sonner";

export default function ChatPage(): React.ReactNode {
  const searchParams = useSearchParams();
  const rfpId = searchParams.get("rfpId");

  console.log("[ChatPage] Rendering with rfpId:", rfpId);

  return (
    <DashboardLayout>
      <AgentProvidersWrapper>
        <div className="flex flex-col h-full p-4">
          <Toaster />
          <Thread />
        </div>
      </AgentProvidersWrapper>
    </DashboardLayout>
  );
}
