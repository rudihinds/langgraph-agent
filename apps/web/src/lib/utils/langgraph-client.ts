import {
  fetchEventSource,
  EventSourceMessage,
} from "@microsoft/fetch-event-source";
import { toast } from "sonner";

// Assuming InterruptResponse is a custom type, adjust if SDK provides it
// For now, let's define a placeholder if it's not found in the expected SDK path
// or if the existing import is incorrect.
// Based on the previous file content, it was:
// import { InterruptResponse } from "../../features/chat-ui/types";
// Let's ensure this path is correct or define a placeholder
// For now, assuming it's a specific structure.
interface InterruptData {
  // Define fields based on expected interrupt structure
  // Example:
  // messages?: any[];
  // next?: string[];
  // [key: string]: any;
  // For now, let's keep it generic if the exact structure isn't critical for this fix
  [key: string]: any;
}
export interface InterruptResponse {
  type: "interrupt";
  data: InterruptData;
  // Add other fields if necessary based on actual usage
}

// Base URL for the LangGraph API
const BASE_URL =
  process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "http://localhost:3001/api";

// Options for fetch calls
const DEFAULT_OPTIONS: RequestInit = {
  headers: {
    "Content-Type": "application/json",
  },
};

/**
 * Client for interacting with the LangGraph API
 */
export class LangGraphClient {
  private baseUrl: string;
  private options: RequestInit;

  /**
   * Create a new LangGraph client
   * @param baseUrl - Base URL for the LangGraph API (optional, defaults to env var or localhost)
   * @param options - Additional options for fetch calls (optional)
   */
  constructor(baseUrl?: string, options?: RequestInit) {
    this.baseUrl = baseUrl || BASE_URL;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Start a new thread with the specified agent
   * @param agentId - ID of the agent to start a thread with
   * @param input - Initial input for the thread
   * @returns Promise with the thread ID
   */
  async startThread(agentId: string, input: any = {}): Promise<string> {
    try {
      const response = await fetch(
        `${this.baseUrl}/agents/${agentId}/threads`,
        {
          method: "POST",
          ...this.options,
          body: JSON.stringify({ input }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to start thread: ${response.status} ${errorText}`
        );
      }

      const data = await response.json();
      return data.threadId;
    } catch (error) {
      console.error("Error starting thread:", error);
      throw error;
    }
  }

  /**
   * Get details for a specific thread
   * @param threadId - ID of the thread to get
   * @returns Promise with the thread details
   */
  async getThread(threadId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/threads/${threadId}`, {
        method: "GET",
        ...this.options,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to get thread: ${response.status} ${errorText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Error getting thread:", error);
      throw error;
    }
  }

  /**
   * Delete a thread
   * @param threadId - ID of the thread to delete
   * @returns Promise with the delete result
   */
  async deleteThread(threadId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/threads/${threadId}`, {
        method: "DELETE",
        ...this.options,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to delete thread: ${response.status} ${errorText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Error deleting thread:", error);
      throw error;
    }
  }

  /**
   * Stream messages from a thread with SSE
   * @param threadId - ID of the thread to stream
   * @param action - Action to perform on the thread
   * @param input - Input for the action
   * @param onMessage - Callback for each message received
   * @param onInterrupt - Callback when an interrupt is detected
   * @param onError - Callback for errors
   * @param onComplete - Callback when streaming is complete
   */
  streamThread(
    threadId: string,
    action: string,
    input: any = {},
    onMessage: (msg: any) => void,
    onInterrupt?: (interrupt: InterruptResponse) => void,
    onError?: (error: Error) => void,
    onComplete?: () => void
  ): { abort: () => void } {
    let abortController = new AbortController();

    (async () => {
      try {
        const url = `${this.baseUrl}/threads/${threadId}/stream`;

        await fetchEventSource(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Add Authorization header if your LangGraph server needs it
            // ...(this.options.headers?.Authorization && { Authorization: this.options.headers.Authorization }),
          } as Record<string, string>, // Ensure headers is Record<string, string>
          body: JSON.stringify({ action, input }),
          signal: abortController.signal,
          onmessage(event: EventSourceMessage) {
            // Added type for event
            try {
              const data = JSON.parse(event.data);

              // Check if this is an interrupt message
              if (data.type === "interrupt" && onInterrupt) {
                onInterrupt(data as InterruptResponse); // Cast to InterruptResponse
                return;
              }

              // Pass the message to the callback
              onMessage(data);
            } catch (err: any) {
              // Added type for err
              console.error("Error parsing message:", err);
            }
          },
          onclose() {
            // Streaming has completed normally
            if (onComplete) onComplete();
          },
          onerror(err: any) {
            // Added type for err
            if (err instanceof Error) {
              if (onError) onError(err);
              // Don't retry on deliberate abort
              if (abortController.signal.aborted) {
                return;
              }
            }
            // Retry on other errors (this is for the fetchEventSource library)
            // Or handle specific error types if needed
            if (err.status === 401) {
              // Example: specific handling for auth errors
              toast.error("Authentication error with LangGraph stream.");
              if (onError)
                onError(
                  new Error(`Stream authentication error: ${err.status}`)
                );
              abortController.abort(); // Stop retrying on auth failure
              return;
            }
            if (onError)
              onError(
                new Error(`Stream error: ${err.status || "Unknown error"}`)
              );
            return err; // Default retry for other errors
          },
        });
      } catch (error) {
        console.error("Stream error:", error);
        if (onError)
          onError(error instanceof Error ? error : new Error(String(error)));
      }
    })();

    // Return function to abort the stream
    return {
      abort: () => abortController.abort(),
    };
  }

  /**
   * Send a message to a thread (non-streaming)
   * @param threadId - ID of the thread to send a message to
   * @param action - Action to perform on the thread
   * @param input - Input for the action
   * @returns Promise with the response
   */
  async sendMessage(
    threadId: string,
    action: string,
    input: any = {}
  ): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/threads/${threadId}/messages`,
        {
          method: "POST",
          ...this.options,
          body: JSON.stringify({ action, input }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to send message: ${response.status} ${errorText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  /**
   * List available agents
   * @returns Promise with array of agent info
   */
  async listAgents(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/agents`, {
        method: "GET",
        ...this.options,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to list agents: ${response.status} ${errorText}`
        );
      }

      const data = await response.json();
      return data.agents || [];
    } catch (error) {
      console.error("Error listing agents:", error);
      toast.error("Failed to fetch agents", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
      return [];
    }
  }

  /**
   * List threads for an agent
   * @param agentId - ID of the agent
   * @returns Promise with array of thread info
   */
  async listThreads(agentId: string): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/agents/${agentId}/threads`,
        {
          method: "GET",
          ...this.options,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to list threads: ${response.status} ${errorText}`
        );
      }

      const data = await response.json();
      return data.threads || [];
    } catch (error) {
      console.error("Error listing threads:", error);
      toast.error("Failed to fetch threads", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
      return [];
    }
  }

  /**
   * Respond to an interrupt
   * @param threadId - ID of the thread
   * @param feedback - Feedback to provide (approval, revision, regeneration)
   * @returns Promise with the response
   */
  async respondToInterrupt(
    threadId: string,
    feedback: {
      type: "approval" | "revision" | "regenerate";
      content: string | null;
    }
  ): Promise<any> {
    return this.sendMessage(threadId, "continue", { feedback });
  }
}

// Export a singleton instance of the client
export const langGraphClient = new LangGraphClient();

// Export a hook-friendly function to get the client
export function getLangGraphClient(): LangGraphClient {
  return langGraphClient;
}
