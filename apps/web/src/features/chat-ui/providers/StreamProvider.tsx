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
    // history: "push", // Consider adding history management if needed
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

  // Effect to initialize thread via backend API when rfpId is present but threadId is not
  useEffect(() => {
    const initializeThread = async () => {
      if (rfpId && !threadId && !isInitializing && supabase) {
        // Check if supabase client is available
        console.log(
          `[StreamProvider] Initializing thread via API for rfpId: ${rfpId}`
        );
        setIsInitializing(true);
        setInitError(null);
        try {
          // Get the current session and access token
          const { data: sessionData, error: sessionError } =
            await supabase.auth.getSession();

          if (sessionError || !sessionData?.session) {
            throw new Error(sessionError?.message || "User session not found.");
          }

          const token = sessionData.session.access_token;

          // Make the API call with the Authorization header
          // Ensure this uses the generalApiUrl for calls outside the LangGraph SDK prefix
          const response = await fetch(
            `${generalApiUrl}/api/rfp/workflow/init`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`, // Add the bearer token
              },
              body: JSON.stringify({ rfpId }),
            }
          );

          const responseText = await response.text();
          console.log("[StreamProvider] Raw API response text:", responseText);

          if (!response.ok) {
            let errorDetails = response.statusText;
            try {
              const errorData = JSON.parse(responseText);
              errorDetails =
                errorData?.details || errorData?.error || response.statusText;
            } catch (e) {
              /* Ignore parsing error */
            }

            // Specific check for 401 Unauthorized
            if (response.status === 401) {
              errorDetails = `Authentication failed: ${errorDetails}. Please ensure you are logged in.`;
            }

            throw new Error(`Failed to initialize workflow: ${errorDetails}`);
          }

          const { threadId: newThreadId } = JSON.parse(responseText);
          if (newThreadId) {
            console.log(
              `[StreamProvider] Received new threadId from API: ${newThreadId}`
            );
            setThreadId(newThreadId, { shallow: true });
          } else {
            throw new Error("Backend did not return a threadId");
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          console.error(
            "[StreamProvider] Thread initialization error:",
            message
          );
          setInitError(message);
          toast.error(`Error initializing chat: ${message}`);
        } finally {
          setIsInitializing(false);
        }
      }
    };

    initializeThread();
  }, [
    rfpId,
    threadId,
    generalApiUrl, // Use generalApiUrl here for the init call dependency
    isInitializing,
    setThreadId,
    setInitError,
    supabase,
  ]);

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
