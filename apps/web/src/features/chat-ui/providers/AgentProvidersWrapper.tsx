"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { StreamProvider } from "./StreamProvider.js";
import { InterruptProvider } from "./InterruptProvider.js";
import { ThreadProvider } from "./ThreadProvider.js";

export default function AgentProvidersWrapper({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

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

  if (!needsChatProviders) {
    return <>{children}</>;
  }

  // Return providers without the wrapping div for sidebar
  return (
    <ThreadProvider>
      <StreamProvider>
        <InterruptProvider>{children}</InterruptProvider>
      </StreamProvider>
    </ThreadProvider>
  );
}
