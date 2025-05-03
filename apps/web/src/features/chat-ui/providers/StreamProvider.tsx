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
} from "react";
import { useQueryState } from "nuqs"; // Assuming nuqs is used for URL state
import { Message, Interrupt } from "@langchain/langgraph-sdk";
import { useStream, type UseStream } from "@langchain/langgraph-sdk/react";
import { toast } from "sonner";
// Removed UI message imports for now, focus on core streaming

// Define the StateType *without* the optional 'ui' channel initially
export type StateType = { messages: Message[] };

// Use the standard useStream hook, typed only for messages
const useTypedStream = useStream<StateType>;

// Context Type remains largely the same, but uses the standard hook's return type
export type StreamContextType = ReturnType<typeof useTypedStream>;

// Create context with default values matching the hook's return shape
const StreamContext = createContext<StreamContextType | undefined>(undefined);

// Props for the provider component
export interface StreamProviderProps {
  children: ReactNode;
}

export function StreamProvider({ children }: StreamProviderProps) {
  // Use rfpId from URL as the primary key
  const [rfpId] = useQueryState("rfpId");
  // threadId is specific to a LangGraph conversation for a given rfpId
  const [threadId, setThreadId] = useQueryState("threadId");

  const [isThreadInitialized, setIsThreadInitialized] = useState(!!threadId); // Initial state depends only on threadId presence
  const [initError, setInitError] = useState<string | null>(null);

  // *** Use DIRECT environment variables ***
  const directApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const assistantId = process.env.NEXT_PUBLIC_ASSISTANT_ID || "proposal-agent"; // Default if not set

  // Effect to find or create the LangGraph thread based on rfpId
  useEffect(() => {
    // Case 1: No rfpId selected - reset state
    if (!rfpId) {
      console.log("[StreamProvider] No rfpId provided. Resetting thread.");
      if (threadId) setThreadId(null); // Clear threadId if rfpId is removed
      setIsThreadInitialized(false);
      setInitError(null);
      return; // Stop further processing
    }

    // Case 2: rfpId exists, but threadId is missing OR initialization hasn't occurred/failed
    if (rfpId && (!threadId || (!isThreadInitialized && !initError))) {
      console.log(
        `[StreamProvider] rfpId ${rfpId} present, but no threadId. Attempting fetch/creation...`
      );
      setIsThreadInitialized(false); // Ensure we show loading state
      setInitError(null); // Clear previous errors

      if (!directApiUrl) {
        const errorMessage = "NEXT_PUBLIC_API_URL is not configured.";
        console.error(`[StreamProvider] ${errorMessage}`);
        setInitError(errorMessage);
        toast.error("Chat Configuration Error", {
          description: errorMessage,
        });
        return;
      }

      const findOrCreateThread = async () => {
        console.log(`[StreamProvider] Creating new thread for rfpId: ${rfpId}`);
        try {
          // *** Use DIRECT API URL ***
          const response = await fetch(`${directApiUrl}/threads`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            // Include assistant_id and potentially rfpId in metadata
            body: JSON.stringify({
              assistant_id: assistantId, // Use configured assistant ID
              metadata: { rfpId: rfpId }, // Pass rfpId in metadata
            }),
          });

          if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(
              `Failed to create thread (${response.status}): ${errorBody || response.statusText}`
            );
          }

          const newThreadData = await response.json();
          if (newThreadData?.thread_id) {
            console.log(
              "[StreamProvider] Thread creation successful, new threadId:",
              newThreadData.thread_id,
              "for rfpId:",
              rfpId
            );
            setThreadId(newThreadData.thread_id); // Update URL state
            setIsThreadInitialized(true);
          } else {
            throw new Error("Thread ID not found in creation response");
          }
        } catch (error: any) {
          console.error(
            "[StreamProvider] Error during thread fetch/creation:",
            error
          );
          setInitError(error.message || "Failed to initialize thread for RFP");
          toast.error("Chat Initialization Failed", {
            description:
              error.message ||
              "Could not create/find chat thread for this RFP.",
            duration: 7000,
          });
        }
      };

      findOrCreateThread();
    }
    // Case 3: Both rfpId and threadId exist, ensure initialized state is set
    else if (rfpId && threadId && !isThreadInitialized && !initError) {
      console.log(
        `[StreamProvider] Initializing with existing rfpId ${rfpId} and threadId ${threadId}`
      );
      setIsThreadInitialized(true);
      setInitError(null); // Clear error if we successfully got IDs
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rfpId,
    threadId,
    isThreadInitialized,
    initError,
    directApiUrl, // Add dependency
    assistantId, // Add dependency
    setThreadId,
  ]); // Rerun if rfpId/threadId changes

  // Initialize the useStream hook with DIRECT values
  const thread = useTypedStream({
    apiUrl: directApiUrl || "", // Use direct API URL, fallback to empty string if unset
    assistantId: assistantId,
    messagesKey: "messages",
    // Only pass threadId if it's known and the thread is initialized
    threadId: isThreadInitialized ? threadId || undefined : undefined,
  });

  // Effect to handle missing API URL *after* hook initialization attempt
  useEffect(() => {
    if (!directApiUrl) {
      const errorMessage = "NEXT_PUBLIC_API_URL is not configured.";
      console.error(`[StreamProvider] ${errorMessage}`);
      // Don't set initError here again if already set during thread creation attempt
      if (!initError) {
        setInitError(errorMessage);
        toast.error("Chat Configuration Error", {
          description: errorMessage,
        });
      }
    }
  }, [directApiUrl, initError]);

  // Logging for the API URL being used
  useEffect(() => {
    if (directApiUrl) {
      console.log(
        "[StreamProvider] Using Direct LangGraph API URL:",
        directApiUrl
      );
    } else {
      console.warn("[StreamProvider] NEXT_PUBLIC_API_URL is not set!");
    }
    if (threadId) {
      console.log(
        "[StreamProvider] Initializing with threadId from URL:",
        threadId
      );
    } else {
      console.log(
        "[StreamProvider] No threadId in URL, useStream will attempt to create one if API URL is set."
      );
    }
  }, [directApiUrl, threadId]);

  // Handle operational errors from the hook (after initialization)
  useEffect(() => {
    if (thread.error) {
      console.error("[StreamProvider] Operational Error:", thread.error);
      toast.error("Chat Error", {
        description:
          thread.error instanceof Error
            ? thread.error.message
            : String(thread.error),
      });
    }
  }, [thread.error]);

  const contextValue = thread;

  // Logging for context value updates
  useEffect(() => {
    const currentThreadId =
      "threadId" in contextValue && contextValue.threadId
        ? contextValue.threadId
        : threadId;
    console.log(
      "[StreamProvider] Context Value updated - isLoading:",
      contextValue.isLoading,
      "messages count:",
      contextValue.messages?.length,
      "threadId:",
      currentThreadId || "(Not set yet)",
      "rfpId:",
      rfpId || "(Not set)"
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    contextValue.isLoading,
    contextValue.messages,
    contextValue,
    threadId,
    rfpId,
  ]);

  // Render loading/error/prompt state during initialization or if no RFP
  if (!rfpId) {
    return <div>Please select an RFP to start chatting.</div>; // Prompt user
  }
  if (!isThreadInitialized && !initError) {
    return <div>Initializing Chat for RFP {rfpId}...</div>; // Show loading specific to RFP
  }
  if (initError) {
    return (
      <div>
        Error initializing chat for RFP {rfpId}: {initError}
      </div>
    );
  }

  // Render children only after thread is initialized for the current rfpId
  return (
    <StreamContext.Provider value={contextValue}>
      {children}
    </StreamContext.Provider>
  );
}

// Export the hook for accessing the context
export function useStreamContext() {
  const context = useContext(StreamContext);
  if (!context) {
    throw new Error("useStreamContext must be used within a StreamProvider");
  }
  return context;
}
