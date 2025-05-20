"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { StreamProvider } from "./StreamProvider.js";
import { InterruptProvider } from "./InterruptProvider.js";
import ProposalThreadsList from "../../thread/components/ProposalThreadsList.js";

export default function AgentProvidersWrapper({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

  // Determine needsChatProviders synchronously
  const chatPaths = [
    "/chat",
    "/proposal",
    "/rfp",
    "/generate",
    "/dashboard/chat",
  ];
  const needsChatProviders = chatPaths.some(
    (path) => pathname === path || pathname?.startsWith(`${path}/`)
  );

  // Only wrap with StreamProvider/InterruptProvider if on a chat-related page
  if (!needsChatProviders) {
    return <>{children}</>;
  }

  // Layout for chat-related pages with sidebar
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <div
        style={{
          width: "300px",
          borderRight: "1px solid #ccc",
          padding: "10px",
          overflowY: "auto",
        }}
      >
        <ProposalThreadsList />
      </div>
      <div style={{ flexGrow: 1, padding: "10px", overflowY: "auto" }}>
        <StreamProvider>
          <InterruptProvider>{children}</InterruptProvider>
        </StreamProvider>
      </div>
    </div>
  );
}
