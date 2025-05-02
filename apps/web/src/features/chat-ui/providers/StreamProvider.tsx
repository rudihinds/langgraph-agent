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

// Maximum attempts to initialize a thread before failing
const MAX_INIT_ATTEMPTS = 3;

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
  const [isInitializing, setIsInitializing] = useState(false);
  const [threadInitialized, setThreadInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Refs to prevent infinite re-renders and dependency issues
  const initializationAttemptedRef = useRef(false);
  const initializationCompletedRef = useRef(false);
  const initAttemptCountRef = useRef(0);
  const clientRef = useRef<ReturnType<typeof useTypedStream> | null>(null);
  const initialRfpIdRef = useRef<string | null | undefined>(initialRfpId);

  // Get our thread management hook
  const {
    getOrCreateThread,
    generateDummyThreadId,
    isLoading: isThreadLoading,
    error: threadError,
  } = useRfpThread();

  // Get environment variables for API URL and agent ID
  const apiUrl: string =
    process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "/api/langgraph";
  const assistantId: string =
    process.env.NEXT_PUBLIC_ASSISTANT_ID || "proposal_agent";

  // Check if LangGraph server is available
  async function checkStatus() {
    try {
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`${apiUrl}/info`, {
        headers,
        signal: AbortSignal.timeout(3000), // 3 second timeout
      });
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
          description: "Using fallback mode with limited functionality.",
          duration: 5000,
        });
      }
    });
  }, []);

  // Handle thread initialization - using useCallback to stabilize function reference
  const initializeThread = useCallback(async () => {
    console.log("Initialize thread called", {
      isInitializing,
      threadInitialized,
      initialRfpId: initialRfpIdRef.current,
      attemptedBefore: initializationAttemptedRef.current,
      completedBefore: initializationCompletedRef.current,
      attemptCount: initAttemptCountRef.current,
    });

    // Prevent multiple initialization attempts
    if (
      isInitializing ||
      initializationCompletedRef.current ||
      !initialRfpIdRef.current ||
      initAttemptCountRef.current >= MAX_INIT_ATTEMPTS
    ) {
      return;
    }

    try {
      setIsInitializing(true);
      setInitError(null);
      initializationAttemptedRef.current = true;
      initAttemptCountRef.current++;

      // Try to get or create a thread
      let threadResult;
      try {
        // Get or create a thread for this RFP
        threadResult = await getOrCreateThread(initialRfpIdRef.current);
      } catch (error) {
        console.warn("Backend thread API unavailable, using fallback:", error);

        // Fallback to a dummy thread ID for development when backend is unavailable
        const dummyThreadId = generateDummyThreadId(initialRfpIdRef.current);
        threadResult = {
          threadId: dummyThreadId,
          isNew: true,
        };

        toast.warning("Using development mode", {
          description: "Connected to LangGraph with a temporary thread ID.",
          duration: 5000,
        });
      }

      // Update the thread ID (will trigger stream setup)
      await setThreadId(threadResult.threadId);

      // Set initial input for the thread in localStorage
      localStorage.setItem("agent-init-rfp", initialRfpIdRef.current);

      // Show notification based on thread status
      if (threadResult.isNew) {
        toast.info("Started a new conversation", {
          description: "You can now chat with the proposal agent.",
          duration: 3000,
        });
      } else {
        toast.info("Resuming existing conversation", {
          duration: 3000,
        });
      }

      setThreadInitialized(true);
      initializationCompletedRef.current = true;
    } catch (error) {
      console.error("Failed to initialize thread:", error);
      setInitError("Failed to initialize chat thread. Please try again.");

      // If we haven't maxed out attempts, try again after a delay
      if (initAttemptCountRef.current < MAX_INIT_ATTEMPTS) {
        setTimeout(initializeThread, 2000);
      } else {
        toast.error("Failed to initialize chat thread", {
          description:
            "Maximum attempts reached. Please refresh the page to try again.",
          duration: 5000,
        });
      }
    } finally {
      setIsInitializing(false);
    }
  }, [getOrCreateThread, generateDummyThreadId, setThreadId]);

  // Initialize thread when we have all the necessary data - using stable condition logic
  useEffect(() => {
    const shouldInitialize =
      Boolean(session?.access_token) && // Have an authenticated session
      Boolean(initialRfpId) && // Have an RFP ID
      !threadId && // Don't have a thread ID yet
      !threadInitialized && // Haven't already initialized
      !isInitializing && // Not in the process of initializing
      !initializationCompletedRef.current && // Haven't completed initialization
      initAttemptCountRef.current < MAX_INIT_ATTEMPTS; // Haven't maxed out attempts

    if (shouldInitialize) {
      console.log("Triggering thread initialization...");
      initializeThread();
    }
  }, [
    session,
    initialRfpId,
    threadId,
    threadInitialized,
    isInitializing,
    initializeThread,
  ]);

  // Show errors from thread initialization if they occur
  useEffect(() => {
    if (threadError && !initError) {
      setInitError(threadError);
      toast.error("Thread error", {
        description: threadError,
        duration: 5000,
      });
    }
  }, [threadError, initError]);

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
    onError: (error) => {
      console.error("LangGraph stream error:", error);
      toast.error("Error connecting to agent", {
        description:
          error instanceof Error ? error.message : "Please try again later",
        duration: 5000,
      });
    },
  });

  // Store reference to the client for potential re-initialization after token refresh
  useEffect(() => {
    clientRef.current = streamValue;
  }, [streamValue]);

  return (
    <StreamContext.Provider value={streamValue}>
      {isInitializing || isThreadLoading ? (
        <div className="flex items-center justify-center h-full w-full">
          <div className="animate-pulse text-primary">
            Initializing chat thread...
          </div>
        </div>
      ) : initError ? (
        <div className="flex flex-col items-center justify-center h-full w-full gap-4">
          <div className="text-red-500">{initError}</div>
          <button
            onClick={() => {
              initAttemptCountRef.current = 0;
              initializationAttemptedRef.current = false;
              initializationCompletedRef.current = false;
              setInitError(null);
              initializeThread();
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
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
