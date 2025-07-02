import { useCallback, useState, useRef, useEffect } from "react";
import { useStreamContext } from "../providers/StreamProvider";
import { StatusInfo, extractStatusFromChunk } from "../types/status";

/**
 * Custom hook that extends the StreamProvider functionality with automatic
 * status message handling. This follows the LangGraph pattern for custom
 * streaming events using config.writer on the backend.
 * 
 * Features:
 * - Automatically adds "custom" to streamMode for status events
 * - Manages status state and auto-clearing after 5 seconds
 * - Handles correct event structure from LangGraph (["custom", data])
 * - Preserves existing onChunk handlers
 * - Supports enhanced status format with agent info
 */
export function useStreamWithStatus() {
  const { submit: baseSubmit, ...streamData } = useStreamContext();
  const [status, setStatus] = useState<StatusInfo | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const submit = useCallback(async (values: any, options?: any) => {
    // Clear previous status
    setStatus(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Ensure streamMode includes "custom" for status events and "updates" for node updates only
    const streamMode = options?.streamMode || ["updates"];
    const customStreamMode = Array.isArray(streamMode) 
      ? (streamMode.includes("custom") ? streamMode : [...streamMode, "custom"])
      : [streamMode, "custom"];

    return baseSubmit(values, {
      ...options,
      streamMode: customStreamMode,
      onChunk: (chunk: any) => {
        // Call original handler if exists
        options?.onChunk?.(chunk);
        
        // Handle custom status events from LangGraph
        const statusMessage = extractStatusFromChunk(chunk);
        
        if (statusMessage) {
          const statusInfo: StatusInfo = {
            ...statusMessage,
            timestamp: new Date()
          };
          
          console.log("[useStreamWithStatus] Received status:", statusInfo);
          setStatus(statusInfo);
          
          // Auto-clear status after 5 seconds
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          
          timeoutRef.current = setTimeout(() => {
            setStatus(null);
          }, 5000);
        }
      }
    });
  }, [baseSubmit]);

  return { 
    ...streamData, 
    submit, 
    status 
  };
}