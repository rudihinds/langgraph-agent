"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
} from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import { type Message } from "@langchain/langgraph-sdk";
import {
  uiMessageReducer,
  type UIMessage,
  type RemoveUIMessage,
} from "@langchain/langgraph-sdk/react-ui";
import { useQueryState } from "nuqs";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/hooks/useAuth"; // Our auth hook

export type StateType = { messages: Message[]; ui?: UIMessage[] };

const useTypedStream = useStream<
  StateType,
  {
    UpdateType: {
      messages?: Message[] | Message | string;
      ui?: (UIMessage | RemoveUIMessage)[] | UIMessage | RemoveUIMessage;
    };
    CustomEventType: UIMessage | RemoveUIMessage;
  }
>;

type StreamContextType = ReturnType<typeof useTypedStream>;
const StreamContext = createContext<StreamContextType | undefined>(undefined);

export function StreamProvider({
  children,
  initialRfpId,
}: {
  children: ReactNode;
  initialRfpId?: string | null;
}) {
  // Integrate with our auth system
  const { session } = useAuth();
  const [threadId, setThreadId] = useQueryState("threadId");

  // Get environment variables for API URL and agent ID
  const apiUrl: string =
    process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "/api/langgraph";
  const assistantId: string =
    process.env.NEXT_PUBLIC_ASSISTANT_ID || "proposal_agent";

  async function checkStatus() {
    try {
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`${apiUrl}/info`, { headers });
      return res.ok;
    } catch (e) {
      console.error("Error checking LangGraph server status:", e);
      return false;
    }
  }

  // Check status on mount
  useEffect(() => {
    checkStatus().then((ok) => {
      if (!ok) {
        toast.error("Failed to connect to LangGraph server", {
          description: "Make sure the server is running and try again.",
          duration: 5000,
        });
      }
    });
  }, []);

  // Initialize with RFP ID if provided
  useEffect(() => {
    if (initialRfpId && !threadId) {
      // Set initial input for the thread in localStorage
      localStorage.setItem("agent-init-rfp", initialRfpId);
    }
  }, [initialRfpId, threadId]);

  // Setup the stream context with authentication
  const streamValue = useTypedStream({
    apiUrl,
    assistantId,
    threadId: threadId ?? null,
    defaultHeaders: session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : undefined,
    onCustomEvent: (event, options) => {
      options.mutate((prev) => {
        const ui = uiMessageReducer(prev.ui ?? [], event);
        return { ...prev, ui };
      });
    },
    onThreadId: (id) => {
      setThreadId(id);
    },
  });

  return (
    <StreamContext.Provider value={streamValue}>
      {children}
    </StreamContext.Provider>
  );
}

export function useStreamContext(): StreamContextType {
  const context = useContext(StreamContext);
  if (context === undefined) {
    throw new Error("useStreamContext must be used within a StreamProvider");
  }
  return context;
}
