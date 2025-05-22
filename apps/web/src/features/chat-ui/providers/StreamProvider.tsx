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
  useRef,
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
  // const generalApiUrl = process.env.NEXT_PUBLIC_API_URL || ""; // Keep if used elsewhere, otherwise remove
  // Specific URL for the LangGraph SDK
  const langGraphSdkApiUrl = process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "";

  // Create the Supabase client instance (runs only on the client)
  const supabase = useMemo(() => createClient(), []); // Memoize client creation

  // Ref to track if we've already processed the SDK-generated threadId for the current rfpId session
  const sdkThreadIdProcessedRef = useRef(false);
  // Ref to store the rfpId for which we are awaiting an SDK threadId
  const expectingSdkThreadIdForRfpRef = useRef<string | null>(null);

  // Use query state for threadId
  const [urlThreadId, setUrlThreadId] = useQueryState("threadId", {
    history: "replace",
  });

  // Local state to hold the SDK-generated threadId before it's set in the URL
  // This helps bridge the gap if onThreadId is slightly delayed or if we need to react to it.
  const [localSdkThreadId, setLocalSdkThreadId] = useState<string | null>(null);

  // Log environment variables
  // console.log(
  //   "[StreamProvider] NEXT_PUBLIC_API_URL (for general calls):",
  //   process.env.NEXT_PUBLIC_API_URL
  // ); // Keep if used
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
  // if (generalApiUrl) {
  //   console.log(
  //     "[StreamProvider] Using General API URL (e.g., init):",
  //     generalApiUrl
  //   );
  // } else {
  //   console.warn(
  //     "[StreamProvider] NEXT_PUBLIC_API_URL is not set for general calls!"
  //   );
  // } // Keep if used
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
    `[StreamProvider] Initial state - rfpId: ${rfpId}, urlThreadId: ${urlThreadId}`
  );

  // Effect to manage the expectingSdkThreadIdForRfpRef and reset processor flag
  useEffect(() => {
    if (rfpId && !urlThreadId) {
      // Scenario: New proposal attempt for an rfpId, no threadId in URL yet.
      // We expect the SDK to generate a threadId after the first message.
      if (expectingSdkThreadIdForRfpRef.current !== rfpId) {
        // If the rfpId changed or was previously null, reset processing state.
        expectingSdkThreadIdForRfpRef.current = rfpId;
        sdkThreadIdProcessedRef.current = false;
        console.log(
          `[StreamProvider] Expecting SDK-generated threadId for new session with rfpId: ${rfpId}`
        );
      }
    } else if (!rfpId) {
      // Scenario: No rfpId, clear expectation.
      expectingSdkThreadIdForRfpRef.current = null;
      sdkThreadIdProcessedRef.current = false;
    }
    // If rfpId AND urlThreadId are present, it's an existing thread, no special expectation needed here.
  }, [rfpId, urlThreadId]);

  // Ensure assistantId is a string, as the hook seems to require it.
  // If NEXT_PUBLIC_ASSISTANT_ID is not set, this will cause a runtime error,
  // which is appropriate if it's a required configuration.
  if (!assistantId) {
    console.error(
      "[StreamProvider] CRITICAL: NEXT_PUBLIC_ASSISTANT_ID is not set!"
    );
    // Optionally, you could throw an error here or set a default, but an error is safer for required envs.
  }

  // Effect to capture SDK-generated threadId via onThreadId and persist association
  // This logic was previously in a useEffect dependent on a wrongly destructured threadId
  const handleSdkThreadIdGeneration = async (sdkGeneratedThreadId: string) => {
    setLocalSdkThreadId(sdkGeneratedThreadId); // Store it locally first

    if (
      rfpId && // Must have an rfpId
      expectingSdkThreadIdForRfpRef.current === rfpId && // We were expecting an SDK ID for *this* rfpId
      !sdkThreadIdProcessedRef.current && // We haven't processed it yet for this rfpId session
      supabase // Supabase client is available
    ) {
      sdkThreadIdProcessedRef.current = true; // Mark as processed *before* async operations

      console.log(
        `[StreamProvider onThreadId] Detected SDK-generated threadId: ${sdkGeneratedThreadId} for rfpId: ${rfpId}. Attempting to associate.`
      );

      try {
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();
        if (sessionError || !sessionData?.session?.access_token) {
          throw new Error(
            sessionError?.message ||
              "User session not found for SDK thread association."
          );
        }
        const token = sessionData.session.access_token;

        // Persist association to Express backend
        await recordNewProposalThread(
          {
            rfpId,
            appGeneratedThreadId: sdkGeneratedThreadId, // Use SDK-generated ID
            // proposalTitle: "New Proposal" // Optional: Derive from first message or use a default
          },
          token
        );
        toast.success("New chat session established and saved.");

        // Update URL with the new SDK-generated threadId
        // This should ideally be the primary way urlThreadId gets updated for new threads
        setUrlThreadId(sdkGeneratedThreadId, {
          shallow: true,
          history: "replace",
        });
        console.log(
          `[StreamProvider onThreadId] Set SDK-generated threadId in query state: ${sdkGeneratedThreadId}`
        );
        expectingSdkThreadIdForRfpRef.current = null; // Successfully processed, clear expectation.
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          "[StreamProvider onThreadId] Error associating SDK-generated threadId:",
          message
        );
        toast.error(`Error saving chat session: ${message}`);
        sdkThreadIdProcessedRef.current = false; // Allow reprocessing
      }
    } else if (sdkGeneratedThreadId && !urlThreadId) {
      // If rfpId conditions weren't met for association (e.g., not expecting for *this* rfpId)
      // but we got an SDK threadId and there's no URL threadId, still update the URL.
      // This handles cases where a thread might be generated without an RFP context initially.
      console.log(
        `[StreamProvider onThreadId] SDK-generated threadId ${sdkGeneratedThreadId} received, updating URL.`
      );
      setUrlThreadId(sdkGeneratedThreadId, {
        shallow: true,
        history: "replace",
      });
    }
  };

  const streamData = useTypedStream({
    threadId: urlThreadId, // Pass the threadId from URL (can be null for new threads)
    apiUrl: langGraphSdkApiUrl,
    assistantId: assistantId as string,
    onThreadId: handleSdkThreadIdGeneration, // Callback for when SDK sets/generates threadId
    // streamConfig: { ... }
    // initialMessages: [],
  });

  // Destructure other properties from streamData, threadId is now handled by onThreadId callback
  const {
    submit,
    messages,
    isLoading,
    error,
    stop,
    // DO NOT destructure threadId here: sdkGeneratedThreadIdFromStream
  } = streamData;

  // Remove the old useEffect that depended on sdkGeneratedThreadIdFromStream
  // The logic is now in handleSdkThreadIdGeneration, triggered by the onThreadId callback.

  // Context value provided to children
  const contextValue = useMemo<StreamContextType>(
    () => ({
      messages,
      isLoading: !!(
        (
          isLoading || // Standard loading from useStream
          (rfpId &&
            !urlThreadId && // No threadId in URL yet
            expectingSdkThreadIdForRfpRef.current === rfpId && // And we are expecting one for this rfp
            !localSdkThreadId)
        ) // And we haven't received it locally yet
      ),
      error: error instanceof Error ? error : null,
      submit,
      stop,
      // Use urlThreadId as the source of truth, updated by onThreadId via setUrlThreadId
      // Fallback to localSdkThreadId if urlThreadId hasn't caught up yet (e.g. during the re-render cycle)
      threadId: urlThreadId || localSdkThreadId || null,
    }),
    [
      messages,
      isLoading,
      error,
      submit,
      stop,
      urlThreadId,
      rfpId,
      localSdkThreadId, // Add localSdkThreadId to dependencies
    ]
  );

  return (
    <StreamContext.Provider value={contextValue}>
      {children}
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
