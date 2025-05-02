/**
 * StreamProvider Component
 *
 * This provides the LangGraph streaming context to the chat UI.
 * It handles thread initialization and authentication.
 */

"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useRef,
  useCallback,
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
import { useRfpThread } from "@/features/rfp/hooks/useRfpThread"; // Import our thread hook
import { usePathname } from "next/navigation";
import { getApiKey } from "@/lib/api-key";
import { useSession } from "@/hooks/useSession";

// Number of milliseconds to wait before refreshing
const REFRESH_INTERVAL = 60000;

// Maximum number of initialization attempts
const MAX_INIT_ATTEMPTS = 3;

// Token refresh buffer in seconds (refresh if less than 5 minutes left)
const TOKEN_REFRESH_BUFFER = 300;

export type StateType = {
  messages: Message[];
  ui?: UIMessage[];
  rfpId?: string | null;
};

// Helper for typed stream
function useTypedStream({
  apiUrl,
  assistantId,
  apiKey,
  threadId,
  onThreadId,
}: {
  apiUrl: string;
  assistantId: string;
  apiKey: string | null;
  threadId: string | null;
  onThreadId?: (id: string) => void;
}) {
  return useStream<StateType>({
    apiUrl,
    assistantId,
    threadId,
    apiKey: apiKey ?? undefined,
    onThreadId,
  });
}

type StreamContextType = ReturnType<typeof useTypedStream> & {
  setInitialRfpId?: (id: string | null) => void;
};

const StreamContext = createContext<StreamContextType | undefined>(undefined);

export function StreamProvider({
  children,
  initialRfpId,
}: {
  children: ReactNode;
  initialRfpId?: string | null;
}) {
  // Add pathname check for chat pages
  const pathname = usePathname();
  const isChatPage =
    pathname?.includes("/chat") ||
    pathname?.includes("/proposal") ||
    pathname?.includes("/rfp");

  // Track the initialRfpId in state to allow updates from children
  const [rfpId, setRfpId] = useState<string | null>(initialRfpId ?? null);

  const { session } = useSession();
  const [apiUrl] = useQueryState("apiUrl");
  const [assistantId] = useQueryState("assistantId");
  const [threadId, setThreadId] = useQueryState("threadId");
  const [threadInitialized, setThreadInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const apiKey = getApiKey();

  // Refs to track initialization state
  const initialized = useRef(false);
  const initializationCompletedRef = useRef(false);
  const initAttemptCountRef = useRef(0);
  const lastRefreshRef = useRef<null | number>(null);
  const refresherRef = useRef<NodeJS.Timeout | null>(null);

  const stream = useTypedStream({
    apiUrl: apiUrl ?? window.location.origin,
    assistantId: assistantId ?? "agent",
    apiKey: apiKey,
    threadId: threadId || null,
    onThreadId: (id) => {
      if (id !== threadId) {
        console.log(`Setting thread ID to ${id}`);
        setThreadId(id);
      }
    },
  });

  async function checkStatus() {
    try {
      const url = apiUrl ?? window.location.origin;
      const res = await fetch(`${url}/info`, {
        method: "GET",
        headers: {
          ...(apiKey && {
            Authorization: `Bearer ${apiKey}`,
          }),
        },
      });
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const body = await res.json();
      console.log(`API status check: OK`, body);
      return true;
    } catch (error) {
      console.error("Error checking API status:", error);
      return false;
    }
  }

  async function initializeThread() {
    if (!isChatPage) {
      // Skip initialization for non-chat pages
      return;
    }

    if (!session?.access_token || !rfpId) {
      console.log(
        "Missing access token or RFP ID, skipping thread initialization"
      );
      return;
    }

    if (isInitializing) {
      console.log("Already initializing thread, skipping");
      return;
    }

    if (initializationCompletedRef.current) {
      console.log("Thread initialization already completed, skipping");
      return;
    }

    if (initAttemptCountRef.current >= MAX_INIT_ATTEMPTS) {
      console.log("Max initialization attempts reached, skipping");
      toast.error("Failed to initialize chat thread after multiple attempts.", {
        description: "Please try refreshing the page.",
      });
      return;
    }

    initAttemptCountRef.current += 1;
    setIsInitializing(true);

    try {
      console.log("Initializing chat thread...");
      const statusOk = await checkStatus();
      if (!statusOk) {
        throw new Error("API status check failed");
      }

      console.log("Initializing with RFP ID:", rfpId);
      const response = await stream.submit(
        { messages: [], rfpId: rfpId },
        {
          streamMode: ["values"],
        }
      );

      console.log("Thread initialized with response:", response);
      setThreadInitialized(true);
      initializationCompletedRef.current = true;
    } catch (error) {
      console.error("Error initializing thread:", error);
      toast.error("Failed to initialize chat thread.", {
        description: "Please try again or refresh the page.",
      });
    } finally {
      setIsInitializing(false);
    }
  }

  const setupRefreshTimer = () => {
    if (!isChatPage) {
      // Skip refresh timer for non-chat pages
      return;
    }

    if (refresherRef.current) {
      clearInterval(refresherRef.current);
    }

    refresherRef.current = setInterval(() => {
      const shouldRefresh =
        initialized.current &&
        initializationCompletedRef.current &&
        session?.access_token &&
        threadId && // Use the threadId from state instead of stream object
        (!lastRefreshRef.current ||
          Date.now() - lastRefreshRef.current > REFRESH_INTERVAL);

      if (shouldRefresh) {
        console.log("Auto-refreshing thread...");
        handleRefresh();
      }
    }, REFRESH_INTERVAL);

    return () => {
      if (refresherRef.current) {
        clearInterval(refresherRef.current);
        refresherRef.current = null;
      }
    };
  };

  const handleRefresh = async () => {
    if (!isChatPage) {
      // Skip refresh for non-chat pages
      return;
    }

    if (!session?.access_token || !threadId) {
      // Use the threadId from state
      console.log("Missing access token or thread ID, skipping refresh");
      return;
    }

    try {
      if (stream.isLoading) {
        console.log("Stream is already loading, skipping refresh");
        return;
      }

      console.log("Refreshing thread...");
      const response = await stream.submit(undefined);
      console.log("Thread refreshed with response:", response);
      lastRefreshRef.current = Date.now();
    } catch (error) {
      console.error("Error refreshing thread:", error);
    }
  };

  // Use rfpId instead of initialRfpIdRef.current in all useEffect dependencies
  useEffect(() => {
    const shouldInitialize =
      Boolean(session?.access_token) && // Have an authenticated session
      Boolean(rfpId) && // Have an RFP ID
      !threadId && // Don't have a thread ID yet
      !threadInitialized && // Haven't already initialized
      !isInitializing && // Not in the process of initializing
      !initializationCompletedRef.current && // Haven't completed initialization
      initAttemptCountRef.current < MAX_INIT_ATTEMPTS && // Haven't maxed out attempts
      isChatPage; // Only initialize on chat pages

    if (shouldInitialize) {
      console.log("Triggering thread initialization...");
      initializeThread();
    }
  }, [session, rfpId, threadId, threadInitialized, isInitializing, isChatPage]);

  useEffect(() => {
    if (!isChatPage) {
      return; // Skip for non-chat pages
    }

    if (
      !initialized.current &&
      typeof window !== "undefined" &&
      session?.access_token
    ) {
      initialized.current = true;
      initAttemptCountRef.current = 0;
      initializationCompletedRef.current = false;
      setupRefreshTimer();
    }

    return () => {
      if (refresherRef.current) {
        clearInterval(refresherRef.current);
        refresherRef.current = null;
      }
    };
  }, [session, isChatPage]);

  // Cleanup the thread refresher when the component unmounts
  useEffect(() => {
    return () => {
      if (refresherRef.current) {
        clearInterval(refresherRef.current);
        refresherRef.current = null;
      }
    };
  }, []);

  // Provide a method to update the RFP ID from child components
  const streamValue = {
    ...stream,
    setInitialRfpId: setRfpId,
  };

  // For non-chat pages, we won't show the "Initializing chat thread..." message
  // Just return the children wrapped in the context
  if (!isChatPage) {
    return (
      <StreamContext.Provider value={streamValue}>
        {children}
      </StreamContext.Provider>
    );
  }

  // For chat pages, conditionally show loading state only for chat UI
  return (
    <StreamContext.Provider value={streamValue}>
      {isInitializing && !threadInitialized ? (
        <div className="flex items-center justify-center w-full h-full">
          <p className="text-muted-foreground">Initializing chat thread...</p>
        </div>
      ) : (
        children
      )}
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
