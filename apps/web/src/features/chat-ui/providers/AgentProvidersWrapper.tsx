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
  const [needsChatProviders, setNeedsChatProviders] = useState(false);

  useEffect(() => {
    // Only include chat providers on specific routes that need chat functionality
    // For example: /chat, /proposal, /rfp, etc.
    const chatPaths = [
      "/chat",
      "/proposal",
      "/rfp",
      "/generate",
      "/dashboard/chat",
    ];

    // Check if current path matches or starts with any of the chat paths
    const needsChat = chatPaths.some(
      (path) => pathname === path || pathname?.startsWith(`${path}/`)
    );

    setNeedsChatProviders(needsChat);
  }, [pathname]);

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
