import React, { createContext, useContext, useState, useEffect } from "react";
import { Message, StreamContextType } from "../lib/types";
import { createAuthInterceptor } from "../../../lib/api/auth-interceptor";

// Create a default context for Stream provider
const StreamContext = createContext<StreamContextType | null>(null);

// Custom hook to use Stream context
export const useStream = (): StreamContextType => {
  const context = useContext(StreamContext);
  if (!context) {
    throw new Error("useStream must be used within a StreamProvider");
  }
  return context;
};

interface StreamProviderProps {
  children: React.ReactNode;
  rfpId?: string;
}

// Stream provider component
export const StreamProvider: React.FC<StreamProviderProps> = ({
  children,
  rfpId,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [threadId, setThreadId] = useState<string>("default-thread");

  // Initialize auth interceptor
  const authInterceptor = createAuthInterceptor();

  // Connect to the LangGraph backend with the rfpId if provided
  useEffect(() => {
    if (rfpId) {
      // In a real implementation, this would initialize a thread with the rfpId
      console.log(`Initializing chat with RFP ID: ${rfpId}`);
      // Here you would call your API to fetch an existing thread or create a new one
    }
  }, [rfpId]);

  // Send message function
  const sendMessage = async (message: string): Promise<void> => {
    setIsLoading(true);
    try {
      // Create a new message object for the UI
      const newMessage: Message = {
        id: Date.now().toString(),
        role: "human",
        content: message,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, newMessage]);

      // Make an API call to your LangGraph backend using auth interceptor
      const response = await authInterceptor.fetch("/api/langgraph/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          threadId,
          message,
          rfpId: rfpId || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed with status: ${response.status}`);
      }

      const data = await response.json();

      // Add the AI response to the messages
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, aiResponse]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      console.error("Error sending message:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Interrupt generation function
  const interruptGeneration = (): void => {
    setIsLoading(false);
    // In a real implementation, this would cancel the ongoing request
    // You could call an API endpoint like: /api/langgraph/interrupt
  };

  const value: StreamContextType = {
    messages,
    sendMessage,
    isLoading,
    threadId,
    error,
    interruptGeneration,
    rfpId,
  };

  return (
    <StreamContext.Provider value={value}>{children}</StreamContext.Provider>
  );
};
