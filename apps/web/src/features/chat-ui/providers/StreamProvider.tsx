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
  try {
    const response = await fetch(`${apiUrl}/info`);
    return response.ok;
  } catch (error) {
    console.error("[StreamProvider] API check failed with error:", error);
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

  const assistantId =
    propAssistantId || process.env.NEXT_PUBLIC_ASSISTANT_ID || "proposal-agent";

  // Check for rfpId in URL parameters when the component mounts
  useEffect(() => {
    const rfpIdFromUrl = searchParams.get("rfpId");
    if (rfpIdFromUrl && !rfpId) {
      console.log(`[ChatPage] Setting RFP ID from URL: ${rfpIdFromUrl}`);
      setRfpId(rfpIdFromUrl);
    }
  }, [searchParams, rfpId]);

  // Initialize the useStream hook with the LangGraph configuration
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
      options.mutate((prev) => {
        const ui = uiMessageReducer(prev.ui ?? [], event);
        return { ...prev, ui };
      });
    },
    onThreadId: (id) => {
      if (id !== threadId) {
        console.log(`[StreamProvider] Setting thread ID to ${id}`);
        setThreadId(id);
      }
    },
  });

  // Check API status on initialization
  useEffect(() => {
    if (isChatPage) {
      console.log(`[StreamProvider] Checking API status for ${apiUrl}`);
      checkGraphStatus(apiUrl).then((ok) => {
        if (!ok) {
          console.error(
            `[StreamProvider] Failed to connect to LangGraph server at ${apiUrl}`
          );
          toast.error("Failed to connect to AI server", {
            description:
              "Please check that the server is running and try again",
          });
        } else {
          console.log(
            `[StreamProvider] Successfully connected to LangGraph server at ${apiUrl}`
          );
        }
      });
    }
  }, [apiUrl, isChatPage]);

  // Initialize thread with rfpId if available
  useEffect(() => {
    if (isChatPage && rfpId && !threadId && !stream.isLoading) {
      console.log(`[StreamProvider] Initializing thread with RFP ID: ${rfpId}`);
      try {
        // Get API key if available
        const apiKey = getApiKey();

        // Prepare headers with authentication if needed
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (apiKey) {
          headers["Authorization"] = `Bearer ${apiKey}`;
        }

        // Log the URL we're attempting to connect to
        console.log(
          `[StreamProvider] Creating thread at URL: ${apiUrl}/threads`
        );

        // Create a new thread with the rfpId in metadata
        fetch(`${apiUrl}/threads`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            assistant_id: assistantId,
            metadata: {
              rfpId: rfpId,
            },
          }),
        })
          .then((response) => {
            if (!response.ok) {
              // Log more detailed error information
              console.error(
                `[StreamProvider] HTTP Error: ${response.status} ${response.statusText}`
              );
              return response.text().then((text) => {
                try {
                  // Try to parse as JSON for more error details
                  const errorJson = JSON.parse(text);
                  console.error("[StreamProvider] Error response:", errorJson);
                  throw new Error(
                    `API Error (${response.status}): ${errorJson.message || "Unknown error"}`
                  );
                } catch (e) {
                  // If not JSON, use the raw text
                  console.error("[StreamProvider] Error response text:", text);
                  throw new Error(
                    `API Error (${response.status}): ${text || response.statusText}`
                  );
                }
              });
            }
            return response.json();
          })
          .then((data) => {
            if (data.thread_id) {
              console.log(
                `[StreamProvider] Created thread with ID: ${data.thread_id}`
              );
              setThreadId(data.thread_id);
            } else {
              console.error("[StreamProvider] No thread_id in response:", data);
              throw new Error("No thread_id in response");
            }
          })
          .catch((error) => {
            console.error("[StreamProvider] Error creating thread:", error);

            // Provide more specific error messages based on error type
            if (
              error.message.includes("Failed to fetch") ||
              error.message.includes("NetworkError")
            ) {
              toast.error("Network error", {
                description:
                  "Could not connect to the LangGraph server. Check your network connection and server availability.",
              });
            } else if (error.message.includes("API Error")) {
              toast.error("Server error", {
                description: error.message,
              });
            } else {
              toast.error("Failed to initialize chat", {
                description: error.message,
              });
            }
          });
      } catch (error) {
        console.error("[StreamProvider] Error initializing thread:", error);
        toast.error("Failed to initialize chat", {
          description:
            error instanceof Error ? error.message : "Unknown error occurred",
        });
      }
    }
  }, [
    isChatPage,
    rfpId,
    threadId,
    stream.isLoading,
    apiUrl,
    assistantId,
    setThreadId,
  ]);

  // Add the setInitialRfpId method to the context
  const streamValue = {
    ...stream,
    setInitialRfpId: setRfpId,
  };

  return (
    <StreamContext.Provider value={streamValue}>
      {children}
    </StreamContext.Provider>
  );
}
