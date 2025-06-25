/**
 * useCustomStream Hook
 * 
 * Provides custom streaming functionality for LangGraph that supports
 * both state updates and custom events (like status messages).
 * This follows the LangGraph streaming patterns for custom data.
 */

import { useCallback, useState } from "react";
import { useStreamContext } from "../providers/StreamProvider";
import { Message } from "@langchain/langgraph-sdk";
import { toast } from "sonner";

type StatusEvent = {
  type: "search_status" | "agent_status";
  message: string;
  timestamp: string;
  query?: string;
  focus?: string;
  searchCount?: number;
};

type StreamOptions = {
  onStatus?: (status: string) => void;
  onMessage?: (message: Message) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
};

export function useCustomStream() {
  const { client, assistantId, threadId, submit } = useStreamContext();
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);

  const streamWithStatus = useCallback(
    async (input: any, options: StreamOptions = {}) => {
      if (!client || !assistantId || !threadId) {
        toast.error("Chat not properly initialized");
        return;
      }

      setIsStreaming(true);
      let statusTimeout: NodeJS.Timeout | null = null;

      try {
        // Use the standard submit but with custom streamMode
        await submit(input, {
          streamMode: ["custom", "updates"],
          onChunk: (chunk: any) => {
            // Handle different chunk types based on streamMode
            if (Array.isArray(chunk) && chunk.length === 2) {
              const [mode, data] = chunk;
              
              if (mode === "custom") {
                // Handle custom events (status messages)
                try {
                  const event: StatusEvent = typeof data === 'string' ? JSON.parse(data) : data;
                  
                  if (event.type === "search_status" || event.type === "agent_status") {
                    console.log("[useCustomStream] Status event:", event.message);
                    setCurrentStatus(event.message);
                    options.onStatus?.(event.message);
                    
                    // Clear status after delay
                    if (statusTimeout) clearTimeout(statusTimeout);
                    statusTimeout = setTimeout(() => {
                      setCurrentStatus(null);
                    }, 5000);
                  }
                } catch (error) {
                  console.warn("[useCustomStream] Failed to parse custom event:", error);
                }
              } else if (mode === "updates") {
                // Handle state updates (messages)
                if (data.messages && Array.isArray(data.messages)) {
                  data.messages.forEach((msg: Message) => {
                    options.onMessage?.(msg);
                  });
                }
              }
            }
          },
          onError: (error: Error) => {
            console.error("[useCustomStream] Stream error:", error);
            options.onError?.(error);
            setIsStreaming(false);
          },
          onFinish: () => {
            console.log("[useCustomStream] Stream finished");
            if (statusTimeout) clearTimeout(statusTimeout);
            setCurrentStatus(null);
            setIsStreaming(false);
            options.onComplete?.();
          }
        });
      } catch (error) {
        console.error("[useCustomStream] Failed to start stream:", error);
        toast.error("Failed to start chat stream");
        setIsStreaming(false);
        if (error instanceof Error) {
          options.onError?.(error);
        }
      }
    },
    [client, assistantId, threadId, submit]
  );

  return {
    streamWithStatus,
    isStreaming,
    currentStatus
  };
}