"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useRef,
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

// Token refresh buffer in seconds (refresh if less than 5 minutes left)
const TOKEN_REFRESH_BUFFER = 300;

export function StreamProvider({
  children,
  initialRfpId,
}: {
  children: ReactNode;
  initialRfpId?: string | null;
}) {
  // Integrate with our auth system
  const { session, refreshSession } = useAuth();
  const [threadId, setThreadId] = useQueryState("threadId");
  const clientRef = useRef<ReturnType<typeof useTypedStream> | null>(null);

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

  // Handle token refresh for long sessions
  useEffect(() => {
    if (!session) return;

    let refreshTimer: NodeJS.Timeout;

    const setupRefreshTimer = () => {
      // Clear any existing timers
      if (refreshTimer) clearTimeout(refreshTimer);

      // Get expiration time from token if available
      const expiresAt = session.expires_at; // Assumes this is in seconds since epoch

      if (expiresAt) {
        const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
        const timeUntilExpiry = expiresAt - currentTime;

        // If token expires in less than buffer time, refresh immediately
        if (timeUntilExpiry < TOKEN_REFRESH_BUFFER) {
          handleRefresh();
        } else {
          // Otherwise, set timer to refresh just before expiration
          const refreshTime = (timeUntilExpiry - TOKEN_REFRESH_BUFFER) * 1000; // Convert to ms
          refreshTimer = setTimeout(handleRefresh, refreshTime);
        }
      }
    };

    const handleRefresh = async () => {
      try {
        await refreshSession();
        toast.success("Session refreshed", { duration: 2000 });

        // After refresh, setup the next refresh timer
        setupRefreshTimer();
      } catch (error) {
        console.error("Failed to refresh session:", error);
        toast.error("Session refresh failed", {
          description: "Please sign in again.",
          duration: 5000,
        });
      }
    };

    // Initial setup of refresh timer
    setupRefreshTimer();

    // Cleanup timer on component unmount
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [session, refreshSession]);

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

  // Store reference to the client for potential re-initialization after token refresh
  useEffect(() => {
    clientRef.current = streamValue;
  }, [streamValue]);

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
