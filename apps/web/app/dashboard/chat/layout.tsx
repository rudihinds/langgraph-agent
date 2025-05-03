"use client";

import { StreamProvider } from "@/features/chat-ui/providers/StreamProvider";
import { InterruptProvider } from "@/features/chat-ui/providers/InterruptProvider";
import { ReactNode } from "react";

/**
 * Chat page layout
 *
 * This layout wraps the chat page with the StreamProvider
 * and InterruptProvider to enable communication with the LangGraph server
 * and support human-in-the-loop functionality.
 */
export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <StreamProvider>
      <InterruptProvider>{children}</InterruptProvider>
    </StreamProvider>
  );
}
