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
  useMemo,
} from "react";
import { useSearchParams } from "next/navigation";
import { useStream, type UseStream } from "@langchain/langgraph-sdk/react";
import { toast } from "sonner";
import { useQueryState } from "nuqs";
import { Message } from "@langchain/langgraph-sdk";

// Define the StateType *without* the optional 'ui' channel initially
export type StateType = { messages: Message[] };

// Use the standard useStream hook, typed only for messages
// Explicitly provide BagTemplate to avoid potential generic issues
const useTypedStream = useStream<StateType>;

// Context Type remains largely the same, but uses the standard hook's return type
// export type StreamContextType = ReturnType<typeof useTypedStream>; // <<< REMOVE THIS LINE

// Define the context type explicitly with known properties from useStream
export interface StreamContextType {
  messages: Message[];
  isLoading: boolean;
  error: Error | null | undefined;
  submit: (
    values: Partial<StateType>,
    options?:
      | {
          config?: Record<string, unknown>;
          toolChoice?: string | undefined;
        }
      | undefined
  ) => void;
  stop: () => void;
  // We will manage threadId separately via useQueryState for now
  threadId: string | null; // Keep this for context consumers, but populate from useQueryState
  // isStreaming might be implicitly handled by isLoading or not directly exposed
}

// Create context with default values matching the explicit interface
const StreamContext = createContext<StreamContextType | undefined>(undefined);

// Props for the provider component
export interface StreamProviderProps {
  children: ReactNode;
}

export function StreamProvider({ children }: StreamProviderProps) {
  const searchParams = useSearchParams();
  const rfpId = searchParams.get("rfpId");

  // State to track if the thread is initialized (has messages or a valid ID)
  const [isThreadInitialized, setIsThreadInitialized] = useState(false);

  // Use query state for threadId, only if rfpId is present
  const [threadId, setThreadId] = useQueryState("threadId", {
    // history: "push", // Consider adding history management if needed
  });

  // Log environment variables
  console.log(
    "[StreamProvider] NEXT_PUBLIC_API_URL:",
    process.env.NEXT_PUBLIC_API_URL
  );
  console.log(
    "[StreamProvider] NEXT_PUBLIC_ASSISTANT_ID:",
    process.env.NEXT_PUBLIC_ASSISTANT_ID
  );

  // Use the direct API URL from env
  const directApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const assistantId = process.env.NEXT_PUBLIC_ASSISTANT_ID;

  // Log the URLs being used
  if (directApiUrl) {
    console.log(
      "[StreamProvider] Using Direct LangGraph API URL:",
      directApiUrl
    );
  } else {
    console.warn("[StreamProvider] NEXT_PUBLIC_API_URL is not set!");
    // Consider throwing an error or showing a persistent warning in the UI
  }
  if (assistantId) {
    console.log("[StreamProvider] Using Assistant ID:", assistantId);
  } else {
    console.warn("[StreamProvider] NEXT_PUBLIC_ASSISTANT_ID is not set!");
  }

  console.log(
    `[StreamProvider] Initial state - rfpId: ${rfpId}, threadId: ${threadId}`
  );

  // Effect to handle missing rfpId - This is the primary flow control
  useEffect(() => {
    if (!rfpId) {
      console.log("[StreamProvider] No rfpId provided. Resetting thread.");
      if (threadId) setThreadId(null); // Clear threadId if rfpId is removed
      setIsThreadInitialized(false);
    }
    // Mark as initialized if we have rfpId and threadId from the start
    else if (rfpId && threadId && !isThreadInitialized) {
      console.log(
        "[StreamProvider] Initializing with existing rfpId and threadId."
      );
      setIsThreadInitialized(true);
    }
  }, [rfpId, threadId, setThreadId, isThreadInitialized]); // Added threadId and isThreadInitialized dependencies

  console.log(
    `[StreamProvider] Before useStream - rfpId: ${rfpId}, threadId: ${threadId}, isThreadInitialized: ${isThreadInitialized}`
  );

  // Always call useStream, passing potentially undefined values
  // The hook should handle missing apiUrl/assistantId internally
  const streamValue = useTypedStream({
    apiUrl: directApiUrl, // Pass directly (might be undefined)
    assistantId: assistantId, // Pass directly (might be undefined)
    streamMode: "values", // Explicitly set streamMode
    // Only pass threadId if it's known (from URL) and we have an rfpId
    // The hook handles thread creation if threadId is omitted or invalid
    // threadId: rfpId && threadId ? threadId : undefined, // <<< Let useStream handle thread ID internally based on config
  });

  // State for the effective threadId (from URL or hook response if needed later)
  const [effectiveThreadId, setEffectiveThreadId] = useState<string | null>(
    threadId
  );

  // Log updates from useStream
  useEffect(() => {
    console.log(
      "[StreamProvider] useStream update:",
      `isLoading: ${streamValue.isLoading},`,
      // `isStreaming: ${streamValue.isStreaming},`, // <<< REMOVE isStreaming if not available
      `error: ${streamValue.error},`,
      // `threadId: ${streamValue.threadId},`, // <<< REMOVE threadId if not available directly
      `messages count: ${streamValue.messages?.length ?? 0}`
    );

    // Update threadId in URL if useStream provides one and it differs
    // THIS LOGIC MIGHT NEED REVISITING - useStream might not directly expose threadId
    // if (rfpId && streamValue.threadId && streamValue.threadId !== threadId) {
    //   console.log(
    //     `[StreamProvider] Updating threadId in URL to: ${streamValue.threadId}`
    //   );
    //   setThreadId(streamValue.threadId);
    //   setEffectiveThreadId(streamValue.threadId);
    // } else {
    // Ensure effectiveThreadId tracks the URL threadId
    if (threadId !== effectiveThreadId) {
      setEffectiveThreadId(threadId);
    }
    // }

    // Mark thread as initialized if we receive messages or have a threadId
    if (
      !isThreadInitialized &&
      (effectiveThreadId ||
        (streamValue.messages && streamValue.messages.length > 0))
    ) {
      console.log("[StreamProvider] Marking thread as initialized.");
      setIsThreadInitialized(true);
    }
  }, [
    rfpId,
    streamValue.isLoading,
    // streamValue.isStreaming,
    streamValue.error,
    // streamValue.threadId,
    streamValue.messages,
    threadId, // From useQueryState
    setThreadId,
    isThreadInitialized,
    effectiveThreadId, // Add dependency
  ]);

  // Create the context value, ensuring defaults match useStream's return type
  const contextValue: StreamContextType = useMemo(
    () => ({
      // Pass through known properties from useStream
      messages: rfpId ? streamValue.messages : [],
      isLoading: streamValue.isLoading,
      // Safely handle the error type
      error: streamValue.error instanceof Error ? streamValue.error : undefined,
      submit: streamValue.submit,
      stop: streamValue.stop,
      // Provide the effectiveThreadId (from URL state)
      threadId: rfpId ? effectiveThreadId : null,
    }),
    [
      rfpId,
      effectiveThreadId, // Depend on effectiveThreadId
      streamValue.messages,
      streamValue.isLoading,
      streamValue.error,
      streamValue.submit,
      streamValue.stop,
      // No longer depend on the whole streamValue object if parts are unused/unstable
    ]
  );

  // Log the final context value being provided
  useEffect(() => {
    console.log(
      "[StreamProvider] Context Value updated -",
      `isLoading: ${contextValue.isLoading},`,
      `messages count: ${contextValue.messages?.length ?? 0},`,
      `threadId: ${contextValue.threadId ?? "(Not set)"},`,
      `rfpId: ${rfpId ?? "(Not set)"}`
    );
  }, [contextValue, rfpId]);

  // Render children only if rfpId is present, otherwise show placeholder
  // Also check if API URL AND assistantId are configured before rendering chat
  const canRenderChat = rfpId && directApiUrl && assistantId;

  return (
    <StreamContext.Provider value={contextValue}>
      {canRenderChat ? (
        children
      ) : (
        <div className="flex items-center justify-center h-full">
          <p className="text-lg text-gray-500">
            {!rfpId
              ? "Please select an RFP to start chatting."
              : "Chat service is not configured. Please check environment variables."}
          </p>
        </div>
      )}
    </StreamContext.Provider>
  );
}

// Removed useStreamCondition helper

// Custom hook to use the stream context
export function useStreamContext() {
  const context = useContext(StreamContext);
  if (context === undefined) {
    throw new Error("useStreamContext must be used within a StreamProvider");
  }
  return context;
}
