"use client";

import { StreamProvider } from "@/features/chat-ui/providers/StreamProvider";
import { InterruptProvider } from "@/features/chat-ui/providers/InterruptProvider";
import { ThreadProvider } from "@/features/chat-ui/providers/ThreadProvider";
import { ThreadHistory } from "@/features/chat-ui/components/ThreadHistory";
import { ReactNode } from "react";

/**
 * Chat page layout
 *
 * This layout wraps the chat page with the StreamProvider,
 * InterruptProvider, and ThreadProvider to enable communication 
 * with the LangGraph server, support human-in-the-loop functionality,
 * and manage thread history.
 */
export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <ThreadProvider>
      <StreamProvider>
        <InterruptProvider>
          <div className="flex h-full">
            <ThreadHistory />
            <div className="flex-1">
              {children}
            </div>
          </div>
        </InterruptProvider>
      </StreamProvider>
    </ThreadProvider>
  );
}
