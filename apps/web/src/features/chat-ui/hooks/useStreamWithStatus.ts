import { useCallback, useState, useRef, useEffect } from "react";
import { useStreamContext } from "../providers/StreamProvider";

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
 */
export function useStreamWithStatus() {
  const { submit: baseSubmit, ...streamData } = useStreamContext();
  const [status, setStatus] = useState<string>("");
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
    setStatus("");
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Ensure streamMode includes "custom" for status events
    const streamMode = options?.streamMode || ["messages"];
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
        // LangGraph sends custom events as ["custom", data] arrays
        if (Array.isArray(chunk) && chunk[0] === "custom") {
          const data = chunk[1];
          
          // Check if the data has a message property (our status format)
          if (data && typeof data === 'object' && 'message' in data && data.message) {
            console.log("[useStreamWithStatus] Received status:", data.message);
            setStatus(data.message);
            
            // Auto-clear status after 5 seconds
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
            }
            
            timeoutRef.current = setTimeout(() => {
              setStatus("");
            }, 5000);
          }
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