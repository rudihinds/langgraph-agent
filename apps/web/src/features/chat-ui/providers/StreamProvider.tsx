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
import { useStream } from "@langchain/langgraph-sdk/react";
import { toast } from "sonner";
import { useQueryState } from "nuqs";
import { Message } from "@langchain/langgraph-sdk";
import { v4 as uuidv4 } from "uuid";
import { recordNewProposalThread } from "@/lib/api/client";

// Import the Supabase client creation utility
// Trying path alias based on project structure
import { createClient } from "@/lib/supabase/client";

// Define the StateType with ui channel for custom components and synthesis interrupt support
export type StateType = {
  messages: Message[];
  ui?: Array<{
    id: string;
    metadata?: { message_id?: string };
    [key: string]: any;
  }>;
  // Add metadata field for RFP context (Step 1.2)
  metadata?: {
    rfpId?: string;
    autoStarted?: boolean;
    [key: string]: any;
  };
  // RFP Analysis state for synthesis interrupt
  synthesisAnalysis?: any;
  rfpProcessingStatus?: string;
  currentStatus?: string;
};

// Define generic interrupt payload types - reusable for all interrupt types
export type BaseInterruptPayload = {
  type: string;
  question: string;
  options: string[];
  timestamp: string;
  nodeName: string;
  [key: string]: any; // Allow additional fields for specific interrupt types
};

// Specific interrupt payload for synthesis review
export type SynthesisInterruptPayload = BaseInterruptPayload & {
  type: 'rfp_analysis_review';
  synthesisData: any;
};

// Use the standard useStream hook, properly typed for state and interrupts
const useTypedStream = useStream<StateType, { InterruptType: BaseInterruptPayload | string }>;

// Context Type remains largely the same, but uses the standard hook's return type
// export type StreamContextType = ReturnType<typeof useTypedStream>; // <<< REMOVE THIS LINE

// Define the context type explicitly with known properties from useStream
export interface StreamContextType {
  messages: Message[];
  isLoading: boolean;
  error: Error | null | undefined;
  submit: (
    values: Partial<StateType> | null | undefined,
    options?: any
  ) => void;
  stop: () => void;
  // We will manage threadId separately via useQueryState for now
  threadId: string | null; // Keep this for context consumers, but populate from useQueryState
  // Additional properties from useStream hook
  values: StateType;
  getMessagesMetadata: (message: Message) => any;
  interrupt: BaseInterruptPayload | string | null; // Properly typed interrupt
  setBranch: (branch: string) => void;
  // Properties needed for LoadExternalComponent
  branch: string;
  history: any;
  experimental_branchTree: any;
  client: any;
  assistantId: string;
  // isStreaming might be implicitly handled by isLoading or not directly exposed
}

// Create context with default values matching the explicit interface
const StreamContext = createContext<StreamContextType | undefined>(undefined);

// Props for the provider component
export interface StreamProviderProps {
  children: ReactNode;
}

// State to manage configuration status
type ConfigStatus = {
  isConfigured: boolean;
  errorMessages: string[];
  warningMessages: string[];
};

export function StreamProvider({ children }: StreamProviderProps) {
  const searchParams = useSearchParams();
  const rfpId = searchParams.get("rfpId");
  const [configStatus, setConfigStatus] = useState<ConfigStatus>({
    isConfigured: false, // Assume not configured until checked
    errorMessages: [],
    warningMessages: [],
  });

  // URL for general API calls (e.g., workflow init)
  const generalApiUrl = process.env.NEXT_PUBLIC_API_URL || "";
  // Specific URL for the LangGraph SDK
  const langGraphSdkApiUrl = process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "";
  const assistantId = process.env.NEXT_PUBLIC_ASSISTANT_ID;

  useEffect(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!generalApiUrl) {
      // Assuming generalApiUrl is important but perhaps not critical for SDK-only operations initially.
      // Adjust if it's absolutely critical for StreamProvider to function.
      warnings.push(
        "NEXT_PUBLIC_API_URL is not set. Some features may not work."
      );
      console.warn(
        "[StreamProvider] NEXT_PUBLIC_API_URL is not set for general calls!"
      );
    } else {
      console.log(
        "[StreamProvider] Using General API URL (e.g., init):",
        generalApiUrl
      );
    }

    if (!langGraphSdkApiUrl) {
      errors.push(
        "NEXT_PUBLIC_LANGGRAPH_API_URL is not set. Chat functionality will not work."
      );
      console.error(
        "[StreamProvider] CRITICAL: NEXT_PUBLIC_LANGGRAPH_API_URL is not set!"
      );
    } else {
      console.log(
        "[StreamProvider] Using LangGraph SDK API URL:",
        langGraphSdkApiUrl
      );
    }

    if (!assistantId) {
      errors.push(
        "NEXT_PUBLIC_ASSISTANT_ID is not set. Chat functionality will not work."
      );
      console.error(
        "[StreamProvider] CRITICAL: NEXT_PUBLIC_ASSISTANT_ID is not set!"
      );
    } else {
      console.log("[StreamProvider] Using Assistant ID:", assistantId);
    }

    setConfigStatus({
      isConfigured: errors.length === 0, // Configured if no critical errors
      errorMessages: errors,
      warningMessages: warnings,
    });

    // Display warnings using toast
    for (const warningMessage of warnings) {
      toast.warning(warningMessage);
    }
    // Errors will be handled by conditional rendering below
  }, []); // Empty dependency array, runs once on mount

  // Create the Supabase client instance (runs only on the client)
  const supabase = useMemo(() => createClient(), []); // Memoize client creation

  // Ref to track if we've already processed the SDK-generated threadId for the current rfpId session
  const sdkThreadIdProcessedRef = useRef(false);
  // Ref to store the rfpId for which we are awaiting an SDK threadId
  const expectingSdkThreadIdForRfpRef = useRef<string | null>(null);

  // Auto-start tracking refs
  const hasAutoStarted = useRef(false);
  const autoStartAttempts = useRef(0);
  const maxAutoStartAttempts = 3; // Prevent infinite loops
  const currentRfpId = useRef<string | null>(null);

  // Use query state for threadId
  const [urlThreadId, setUrlThreadId] = useQueryState("threadId", {
    history: "replace",
  });

  // Local state to hold the SDK-generated threadId before it's set in the URL
  // This helps bridge the gap if onThreadId is slightly delayed or if we need to react to it.
  const [localSdkThreadId, setLocalSdkThreadId] = useState<string | null>(null);

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
  // THIS CHECK IS NOW HANDLED IN THE useEffect and configStatus

  // Effect to capture SDK-generated threadId via onThreadId and persist association
  const handleSdkThreadIdGeneration = async (sdkGeneratedThreadId: string) => {
    if (!sdkGeneratedThreadId) {
      console.error(
        "[StreamProvider onThreadId] Received an empty or invalid SDK-generated threadId."
      );
      toast.error(
        "Chat session could not be initialized correctly. Please try sending your message again."
      );
      // Potentially reset flags if needed, or prevent further processing
      sdkThreadIdProcessedRef.current = false; // Allow reprocessing if a valid ID comes later
      return;
    }

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
          console.error(
            "[StreamProvider onThreadId] Supabase getSession error or no token:",
            sessionError
          );
          toast.error(
            "Authentication problem. Chat session metadata cannot be saved. Please re-login or refresh."
          );
          sdkThreadIdProcessedRef.current = false; // Allow reprocessing if auth succeeds later
          // Do not proceed to recordNewProposalThread if auth fails
          return;
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
          "[StreamProvider onThreadId] Error associating SDK-generated threadId with backend:",
          message
        );
        toast.error(
          `Failed to save new chat session metadata: ${message}. The chat may work for this session but might not be listed or resumable later.`
        );
        sdkThreadIdProcessedRef.current = false; // Allow reprocessing if user retries or issue is transient
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
    error: streamError,
    stop,
    values,
    getMessagesMetadata,
    interrupt,
    setBranch,
    branch,
    history,
    experimental_branchTree,
    client,
  } = streamData;

  // Reset auto-start tracking when rfpId changes (separate effect)
  useEffect(() => {
    if (rfpId !== currentRfpId.current) {
      console.log(
        `[StreamProvider] RFP ID changed from ${currentRfpId.current} to ${rfpId} - resetting auto-start tracking`
      );
      hasAutoStarted.current = false;
      autoStartAttempts.current = 0;
      currentRfpId.current = rfpId;
    }
  }, [rfpId]);

  // Auto-start submit effect - depends on submit being available (Step 1.2)
  useEffect(() => {
    // Trigger auto-start for:
    // 1. New sessions: rfpId present but no urlThreadId yet
    // 2. Existing sessions: both rfpId and urlThreadId present
    if (
      rfpId &&
      submit &&
      !hasAutoStarted.current &&
      autoStartAttempts.current < maxAutoStartAttempts &&
      (!urlThreadId || (urlThreadId && !streamError))
    ) {
      hasAutoStarted.current = true;
      autoStartAttempts.current += 1;

      // Auto-send initial message with RFP context in state metadata, not message content
      const autoStart = async () => {
        const sessionType = urlThreadId ? "existing" : "new";
        console.log(
          `[StreamProvider] Auto-starting RFP analysis for ${sessionType} session (attempt ${autoStartAttempts.current}/${maxAutoStartAttempts}) - rfpId: ${rfpId}, threadId: ${urlThreadId || "none"}`
        );

        try {
          await submit({
            messages: [
              {
                type: "human",
                content: "Please analyze my RFP document",
                id: uuidv4(),
              },
            ],
            // Pass RFP context in metadata, not message content for cleaner LLM processing
            metadata: {
              rfpId,
              autoStarted: true,
            },
          });
        } catch (error) {
          console.error("[StreamProvider] Auto-start failed:", error);

          // Check for connection refused errors (backend not running)
          const isConnectionError =
            error instanceof Error &&
            (error.message.includes("ERR_CONNECTION_REFUSED") ||
              error.message.includes("Failed to fetch") ||
              error.message.includes("Network request failed"));

          if (isConnectionError) {
            console.error(
              "[StreamProvider] Backend connection failed - disabling auto-start. Please start the LangGraph backend service."
            );
            // Don't retry for connection errors - backend is not available
            autoStartAttempts.current = maxAutoStartAttempts; // Prevent further attempts
            toast.error(
              "Could not connect to chat service. Please ensure the backend is running."
            );
          } else if (
            error instanceof Error &&
            error.message.includes("Thread is already running a task")
          ) {
            console.log(
              "[StreamProvider] Thread already running, resetting auto-start flag for manual retry"
            );
            hasAutoStarted.current = false;
          } else if (autoStartAttempts.current >= maxAutoStartAttempts) {
            console.error(
              "[StreamProvider] Max auto-start attempts exceeded, disabling auto-start for this session"
            );
            toast.error(
              "Auto-start failed after multiple attempts. Please try manually sending a message."
            );
          } else {
            // For other errors, allow retry on next effect run
            hasAutoStarted.current = false;
          }
        }
      };
      
      setTimeout(autoStart, 500);
    } else if (autoStartAttempts.current >= maxAutoStartAttempts) {
      console.log(
        "[StreamProvider] Auto-start disabled - max attempts exceeded. User must manually start the conversation."
      );
    }
  }, [rfpId, urlThreadId, submit, streamError]);

  // Effect to handle general errors from useStream and specific invalid threadId errors
  useEffect(() => {
    if (streamError) {
      console.error("[StreamProvider] Error from useStream:", streamError);

      if (urlThreadId) {
        // Potential scenario: urlThreadId was provided, but useStream errored, possibly indicating an invalid/expired thread.
        // More specific error checking might be needed here if LangGraph SDK provides distinct error types/codes.
        // For now, we assume an error while urlThreadId is set might mean the thread is bad.
        toast.error(
          `Could not load chat session for thread '${urlThreadId}'. It may be invalid or expired. Starting a new session.`
        );
        // Clear the invalid threadId from URL to trigger new thread logic on next interaction
        setUrlThreadId(null, { shallow: true, history: "replace" });
        // Reset relevant refs to expect a new SDK-generated ID for the current rfpId
        if (rfpId) {
          expectingSdkThreadIdForRfpRef.current = rfpId;
          sdkThreadIdProcessedRef.current = false;
          console.log(
            `[StreamProvider] Invalid threadId '${urlThreadId}' cleared. Expecting new SDK thread for rfpId: ${rfpId}`
          );
        }
      } else {
        // General error not specifically tied to a pre-existing urlThreadId
        toast.error(
          "A connection error occurred with the chat service. Please try again or refresh the page."
        );
      }
    }
  }, [streamError, urlThreadId, setUrlThreadId, rfpId]); // Added rfpId to deps for the reset logic

  // Context value provided to children
  const contextValue = useMemo<StreamContextType>(
    () => ({
      messages,
      isLoading: !!(
        (
          isLoading || // Standard loading from useStream
          (rfpId &&
            !urlThreadId && // No threadId in URL yet
            !streamError && // And no current stream error that might be resetting the threadId
            expectingSdkThreadIdForRfpRef.current === rfpId && // And we are expecting one for this rfp
            !localSdkThreadId)
        ) // And we haven't received it locally yet
      ),
      error: streamError instanceof Error ? streamError : null,
      submit,
      stop,
      // Use urlThreadId as the source of truth, updated by onThreadId via setUrlThreadId
      // Fallback to localSdkThreadId if urlThreadId hasn't caught up yet (e.g. during the re-render cycle)
      threadId: urlThreadId || localSdkThreadId || null,
      values,
      getMessagesMetadata,
      interrupt: (interrupt as any)?.value || interrupt || null,
      setBranch,
      branch: branch || "main",
      history,
      experimental_branchTree,
      client,
      assistantId: assistantId as string,
    }),
    [
      messages,
      isLoading,
      streamError,
      submit,
      stop,
      urlThreadId,
      rfpId,
      localSdkThreadId,
      assistantId,
      values,
      getMessagesMetadata,
      interrupt,
      setBranch,
      branch,
      history,
      experimental_branchTree,
      client,
    ]
  );

  // If configuration is not valid, render an error message
  if (!configStatus.isConfigured && configStatus.errorMessages.length > 0) {
    return (
      <div style={{ padding: "20px", textAlign: "center", color: "red" }}>
        <h1>Chat Configuration Error</h1>
        <p>
          The chat service cannot be initialized due to missing critical
          configuration:
        </p>
        <ul>
          {configStatus.errorMessages.map((msg, index) => (
            <li key={index}>{msg}</li>
          ))}
        </ul>
        <p>Please contact support or check the application setup.</p>
      </div>
    );
  }

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
