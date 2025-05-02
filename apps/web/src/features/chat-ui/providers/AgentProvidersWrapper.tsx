"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { StreamProvider } from "./StreamProvider";
import { InterruptProvider } from "./InterruptProvider";

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
    const chatPaths = ["/chat", "/proposal", "/rfp", "/generate"];

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

  // For chat-related pages, wrap with the providers
  return (
    <StreamProvider initialRfpId={null}>
      <InterruptProvider>{children}</InterruptProvider>
    </StreamProvider>
  );
}
