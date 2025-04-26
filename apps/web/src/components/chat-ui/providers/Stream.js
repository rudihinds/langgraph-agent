import React, { createContext, useContext, useState } from "react";
import { Message, StreamContextType } from "../lib/types.js";

// Create a default context for Stream provider
const StreamContext = createContext(null);

// Custom hook to use Stream context
export const useStream = () => {
  const context = useContext(StreamContext);
  if (!context) {
    throw new Error("useStream must be used within a StreamProvider");
  }
  return context;
};

// Stream provider component
export const StreamProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [threadId, setThreadId] = useState("default-thread");

  // Send message function
  const sendMessage = async (message) => {
    setIsLoading(true);
    try {
      // In a real implementation, this would call the LangGraph API
      // For now, just add the message to the state
      const newMessage = {
        id: Date.now().toString(),
        role: "human",
        content: message,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, newMessage]);
      setIsLoading(false);

      // Simulate AI response (would be from LangGraph in real implementation)
      const aiResponse = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Response to: ${message}`,
        createdAt: new Date().toISOString(),
      };

      setTimeout(() => {
        setMessages((prev) => [...prev, aiResponse]);
      }, 1000);
    } catch (err) {
      setError(err);
      setIsLoading(false);
    }
  };

  // Interrupt generation function
  const interruptGeneration = () => {
    setIsLoading(false);
    // In a real implementation, this would cancel the ongoing request
  };

  const value = {
    messages,
    sendMessage,
    isLoading,
    threadId,
    error,
    interruptGeneration,
  };

  return (
    <StreamContext.Provider value={value}>{children}</StreamContext.Provider>
  );
};
