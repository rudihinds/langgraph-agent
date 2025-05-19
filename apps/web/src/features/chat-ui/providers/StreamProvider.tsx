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
import { v4 as uuidv4 } from "uuid";
import { recordNewProposalThread } from "@/lib/api";
import { User } from "@supabase/supabase-js";

// Import the Supabase client creation utility
// Trying path alias based on project structure
import { createClient } from "@/lib/supabase/client";

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
  // URL for general API calls (e.g., workflow init)
  const generalApiUrl = process.env.NEXT_PUBLIC_API_URL || "";
  // Specific URL for the LangGraph SDK
  const langGraphSdkApiUrl = process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "";

  // Create the Supabase client instance (runs only on the client)
  const supabase = useMemo(() => createClient(), []); // Memoize client creation

  // State to track if the thread initialization API call is in progress
  const [isInitializing, setIsInitializing] = useState(false);
  // State to track initialization errors
  const [initError, setInitError] = useState<string | null>(null);

  // Use query state for threadId, only if rfpId is present
  const [threadId, setThreadId] = useQueryState("threadId", {
    history: "replace",
  });

  // Log environment variables
  console.log(
    "[StreamProvider] NEXT_PUBLIC_API_URL (for general calls):",
    process.env.NEXT_PUBLIC_API_URL
  );
  console.log(
    "[StreamProvider] NEXT_PUBLIC_LANGGRAPH_API_URL (for SDK):",
    process.env.NEXT_PUBLIC_LANGGRAPH_API_URL
  );
  console.log(
    "[StreamProvider] NEXT_PUBLIC_ASSISTANT_ID:",
    process.env.NEXT_PUBLIC_ASSISTANT_ID
  );

  const assistantId = process.env.NEXT_PUBLIC_ASSISTANT_ID;

  // Log the URLs being used
  if (generalApiUrl) {
    console.log(
      "[StreamProvider] Using General API URL (e.g., init):",
      generalApiUrl
    );
  } else {
    console.warn(
      "[StreamProvider] NEXT_PUBLIC_API_URL is not set for general calls!"
    );
  }
  if (langGraphSdkApiUrl) {
    console.log(
      "[StreamProvider] Using LangGraph SDK API URL:",
      langGraphSdkApiUrl
    );
  } else {
    console.warn("[StreamProvider] NEXT_PUBLIC_LANGGRAPH_API_URL is not set!");
  }

  if (assistantId) {
    console.log("[StreamProvider] Using Assistant ID:", assistantId);
  } else {
    console.warn("[StreamProvider] NEXT_PUBLIC_ASSISTANT_ID is not set!");
  }

  console.log(
    `[StreamProvider] Initial state - rfpId: ${rfpId}, threadId: ${threadId}`
  );

  // Effect to initialize thread: if rfpId is present but threadId is not,
  // generate a new threadId, record association, and set it.
  useEffect(() => {
    const initializeNewThreadForRfp = async () => {
      if (rfpId && !threadId && !isInitializing && supabase) {
        console.log(
          `[StreamProvider] rfpId ${rfpId} present, but no threadId. Initializing new thread.`
        );
        setIsInitializing(true);
        setInitError(null);
        try {
          const { data: sessionData, error: sessionError } =
            await supabase.auth.getSession();

          if (sessionError || !sessionData?.session?.access_token) {
            throw new Error(
              sessionError?.message ||
                "User session not found or token missing."
            );
          }
          const token = sessionData.session.access_token;

          const newAppGeneratedThreadId = uuidv4();
          console.log(
            `[StreamProvider] Generated new appGeneratedThreadId: ${newAppGeneratedThreadId} for rfpId: ${rfpId}`
          );

          // Persist this new threadId association via our Express backend
          await recordNewProposalThread(
            {
              rfpId,
              appGeneratedThreadId: newAppGeneratedThreadId,
              // proposalTitle can be added here if a default is desired or comes from rfpId context
            },
            token
          );
          toast.success(
            `New proposal chat initialized and associated with RFP.`
          );

          // Set this new threadId in the URL query state
          // This will trigger the useStream hook to use this new threadId
          setThreadId(newAppGeneratedThreadId, {
            shallow: true,
            history: "replace",
          });
          console.log(
            `[StreamProvider] Set new threadId in query state: ${newAppGeneratedThreadId}`
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          console.error(
            "[StreamProvider] Error during new thread initialization and association:",
            message
          );
          setInitError(message);
          toast.error(`Error initializing chat: ${message}`);
        } finally {
          setIsInitializing(false);
        }
      }
    };

    initializeNewThreadForRfp();
  }, [rfpId, threadId, isInitializing, setThreadId, supabase]);

  // Effect to handle missing rfpId - This clears the threadId
  useEffect(() => {
    if (!rfpId) {
      console.log("[StreamProvider] No rfpId provided. Resetting thread.");
      if (threadId) setThreadId(null); // Clear threadId if rfpId is removed
      setInitError(null); // Clear errors if rfpId is removed
    }
  }, [rfpId, threadId, setThreadId]);

  console.log(
    `[StreamProvider] Before useStream - rfpId: ${rfpId}, threadId: ${threadId}`
  );

  // Always call useStream, passing the current threadId from state/URL
  // The hook will use this threadId if provided, or potentially create one
  // if initialization hasn't happened yet (though our effect above handles primary init).
  const streamValue = useTypedStream({
    apiUrl: langGraphSdkApiUrl, // Pass the specific LangGraph SDK URL
    assistantId: assistantId as string, // Pass directly (might be undefined)
    threadId: threadId || undefined, // Pass the threadId obtained from URL/API
  });

  // Log updates from useStream - simplified, removed internal threadId logic
  useEffect(() => {
    console.log(
      "[StreamProvider] useStream update:",
      `isLoading: ${streamValue.isLoading},`,
      `error: ${streamValue.error},`,
      `messages count: ${streamValue.messages?.length ?? 0}`
    );

    // Handle errors from useStream
    if (streamValue.error) {
      let message = "Unknown stream error"; // Default error message
      if (streamValue.error instanceof Error) {
        message = streamValue.error.message;
      } else if (typeof streamValue.error === "string") {
        message = streamValue.error;
      } else {
        try {
          message = JSON.stringify(streamValue.error);
        } catch (e) {
          // Fallback if stringify fails
          message = "An unknown stream error occurred.";
        }
      }

      console.error("[StreamProvider] useStream error:", message);
      // Avoid spamming toasts if it's the same error
      if (message !== initError) {
        toast.error(`Chat stream error: ${message}`);
        // Ensure a non-empty string is always set
        setInitError(message || "An unknown stream error occurred.");
      }
    }
  }, [
    streamValue.isLoading,
    streamValue.error,
    streamValue.messages,
    initError,
  ]);

  // Create the context value
  const contextValue: StreamContextType = useMemo(
    () => ({
      messages: rfpId ? streamValue.messages : [],
      // Combine initialization loading state with stream loading state
      isLoading: isInitializing || streamValue.isLoading,
      error: initError // Prioritize init error, then stream error
        ? new Error(initError)
        : streamValue.error instanceof Error
          ? streamValue.error
          : undefined,
      submit: streamValue.submit,
      stop: streamValue.stop,
      threadId: rfpId ? threadId : null, // Use threadId directly from useQueryState
    }),
    [
      rfpId,
      threadId, // Use threadId from useQueryState
      isInitializing, // Add dependency
      initError, // Add dependency
      streamValue.messages,
      streamValue.isLoading,
      streamValue.error,
      streamValue.submit,
      streamValue.stop,
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
  const canRenderChat =
    rfpId && generalApiUrl && langGraphSdkApiUrl && assistantId;

  return (
    <StreamContext.Provider value={contextValue}>
      {canRenderChat ? (
        children
      ) : (
        <div className="flex items-center justify-center h-full">
          <p className="text-lg text-gray-500">
            {isInitializing
              ? "Initializing chat..."
              : initError
                ? `Initialization failed: ${initError}`
                : !rfpId
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
