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
import { useStream } from "@langchain/langgraph-sdk/react";
import { type Message } from "@langchain/langgraph-sdk";
import {
  uiMessageReducer,
  type UIMessage,
  type RemoveUIMessage,
} from "@langchain/langgraph-sdk/react-ui";
import { useQueryState } from "nuqs";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { usePathname, useSearchParams } from "next/navigation";
import { getApiKey } from "@/lib/api-key";

export type StateType = { messages: Message[]; ui?: UIMessage[] };

type StreamContextType = ReturnType<
  typeof useStream<
    StateType,
    {
      UpdateType: {
        messages?: Message[] | Message | string;
        ui?: (UIMessage | RemoveUIMessage)[] | UIMessage | RemoveUIMessage;
      };
      CustomEventType: UIMessage | RemoveUIMessage;
    }
  >
>;

// Create a context for the stream data
export const StreamContext = createContext<StreamContextType | null>(null);

// Create a custom hook to access the context
export const useStreamContext = () => {
  const context = useContext(StreamContext);
  if (!context) {
    throw new Error("useStreamContext must be used within a StreamProvider");
  }
  return context;
};

// Helper to check if the API is available
async function checkGraphStatus(apiUrl: string): Promise<boolean> {
  console.log(`[StreamProvider] Checking API status at: ${apiUrl}/info`);
  try {
    const response = await fetch(`${apiUrl}/info`);
    const ok = response.ok;
    if (ok) {
      console.log(`[StreamProvider] API Status check successful for ${apiUrl}`);
    } else {
      console.warn(
        `[StreamProvider] API Status check failed for ${apiUrl}: ${response.status} ${response.statusText}`
      );
    }
    return ok;
  } catch (error) {
    console.error(
      "[StreamProvider] API status check failed with error:",
      error
    );
    return false;
  }
}

// Props for the StreamProvider component
interface StreamProviderProps {
  children: ReactNode;
  apiUrl?: string;
  assistantId?: string;
}

/**
 * StreamProvider component
 */
export function StreamProvider({
  children,
  apiUrl: propApiUrl,
  assistantId: propAssistantId,
}: StreamProviderProps) {
  // State for thread ID from URL
  const [threadId, setThreadId] = useQueryState("threadId");
  const [rfpId, setRfpId] = useState<string | null>(null);
  const searchParams = useSearchParams();

  // Check if we're on the chat page
  const pathname = usePathname();
  const isChatPage = pathname === "/dashboard/chat";

  // Get API URL and assistant ID from props, environment variables, or defaults
  const apiUrl =
    propApiUrl || process.env.NEXT_PUBLIC_API_URL || "/api/langgraph";
  console.debug("[StreamProvider] Using API URL:", apiUrl);

  const assistantId =
    propAssistantId || process.env.NEXT_PUBLIC_ASSISTANT_ID || "proposal-agent";
  console.debug("[StreamProvider] Using Assistant ID:", assistantId);

  // Check for rfpId in URL parameters when the component mounts
  useEffect(() => {
    const rfpIdFromUrl = searchParams.get("rfpId");
    if (rfpIdFromUrl && rfpIdFromUrl !== rfpId) {
      console.log(`[StreamProvider] Setting RFP ID from URL: ${rfpIdFromUrl}`);
      setRfpId(rfpIdFromUrl);
    } else if (!rfpIdFromUrl && rfpId) {
      console.log("[StreamProvider] Clearing RFP ID as it's no longer in URL");
      setRfpId(null);
      setThreadId(null);
    }
  }, [searchParams, rfpId, setThreadId]);

  // Initialize the useStream hook
  const stream = useStream<
    StateType,
    {
      UpdateType: {
        messages?: Message[] | Message | string;
        ui?: (UIMessage | RemoveUIMessage)[] | UIMessage | RemoveUIMessage;
      };
      CustomEventType: UIMessage | RemoveUIMessage;
    }
  >({
    apiUrl,
    assistantId,
    threadId: threadId || null,
    onCustomEvent: (event, options) => {
      console.debug("[StreamProvider] Received custom UI event:", event);
      options.mutate((prev) => {
        const ui = uiMessageReducer(prev.ui ?? [], event);
        return { ...prev, ui };
      });
    },
    onThreadId: (id) => {
      if (id !== threadId) {
        console.log(`[StreamProvider] Setting thread ID from hook: ${id}`);
        setThreadId(id);
      }
    },
    onError: (error: unknown) => {
      console.error("[StreamProvider][useStream] Hook Error:", error);
      let errorMessage = "Please try again.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast.error("An error occurred during the AI process.", {
        description: errorMessage,
      });
    },
  });

  // Check API status on initialization
  useEffect(() => {
    if (isChatPage) {
      console.log(
        `[StreamProvider] Initializing: Checking API status for ${apiUrl}`
      );
      checkGraphStatus(apiUrl).then((ok) => {
        if (!ok) {
          console.error(
            `[StreamProvider] Initialization failed: Cannot connect to LangGraph server at ${apiUrl}`
          );
          toast.error("Failed to connect to AI server", {
            description: "Please ensure the backend service is running.",
          });
        } else {
          console.log(
            `[StreamProvider] Initialization check complete: Successfully connected to LangGraph server at ${apiUrl}`
          );
        }
      });
    }
  }, [apiUrl, isChatPage]);

  // Initialize thread with rfpId if available and not already loading/has threadId
  useEffect(() => {
    if (
      isChatPage &&
      rfpId &&
      !threadId &&
      !stream.isLoading &&
      !stream.error
    ) {
      console.log(
        `[StreamProvider] Attempting to initialize thread for RFP ID: ${rfpId}`
      );

      const initializeThread = async () => {
        try {
          const apiKey = getApiKey();
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };
          if (apiKey) {
            headers["Authorization"] = `Bearer ${apiKey}`;
          }

          const threadUrl = `${apiUrl}/threads`;
          console.log(`[StreamProvider] Creating thread via POST ${threadUrl}`);

          const response = await fetch(threadUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({
              assistant_id: assistantId,
              metadata: { rfpId },
            }),
          });

          const responseText = await response.text();

          if (!response.ok) {
            console.error(
              `[StreamProvider] Thread creation failed: HTTP ${response.status} ${response.statusText}`,
              { responseBody: responseText }
            );
            try {
              const errorJson = JSON.parse(responseText);
              toast.error("Failed to create AI chat thread", {
                description:
                  errorJson.error ||
                  errorJson.message ||
                  "Could not start a new session.",
              });
            } catch {
              toast.error("Failed to create AI chat thread", {
                description: `Server returned status ${response.status}. Please check backend logs.`,
              });
            }
            return;
          }

          try {
            const data = JSON.parse(responseText);
            if (data.thread_id) {
              console.log(
                `[StreamProvider] Thread created successfully: ${data.thread_id}`
              );
            } else {
              console.error(
                "[StreamProvider] Thread creation response OK, but missing thread_id",
                { responseData: data }
              );
              toast.error("Failed to initialize chat session", {
                description: "Received an invalid response from the server.",
              });
            }
          } catch (parseError) {
            console.error(
              "[StreamProvider] Failed to parse successful thread creation response:",
              { responseText, parseError }
            );
            toast.error("Failed to initialize chat session", {
              description: "Received an unreadable response from the server.",
            });
          }
        } catch (error) {
          console.error(
            "[StreamProvider] Error during thread initialization fetch:",
            error
          );
          toast.error("Failed to create chat session", {
            description:
              "An unexpected error occurred. Check network connection.",
          });
        }
      };

      initializeThread();
    }
  }, [
    isChatPage,
    rfpId,
    threadId,
    stream.isLoading,
    stream.error,
    apiUrl,
    assistantId,
    setThreadId,
  ]);

  return (
    <StreamContext.Provider value={stream}>{children}</StreamContext.Provider>
  );
}
