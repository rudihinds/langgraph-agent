import React, { createContext, useContext, useState } from "react";
import { ThreadContextType } from "../lib/types.js";

// Create a context for Thread provider
const ThreadContext = createContext(null);

// Custom hook to use Thread context
export const useThread = () => {
  const context = useContext(ThreadContext);
  if (!context) {
    throw new Error("useThread must be used within a ThreadProvider");
  }
  return context;
};

// Thread provider component
export const ThreadProvider = ({ children }) => {
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);

  const value = {
    threads,
    selectedThread,
    setSelectedThread,
  };

  return (
    <ThreadContext.Provider value={value}>{children}</ThreadContext.Provider>
  );
};
