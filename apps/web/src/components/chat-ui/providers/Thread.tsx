import { createContext, useContext, useState, ReactNode } from "react";
import { ThreadContextType } from "../lib/types.js";

// Define the context type
const ThreadContext = createContext<ThreadContextType | null>(null);

interface ThreadProviderProps {
  children: ReactNode;
}

// Custom hook to use Thread context
export const useThreads = (): ThreadContextType => {
  const context = useContext(ThreadContext);
  if (!context) {
    throw new Error("useThreads must be used within a ThreadProvider");
  }
  return context;
};

// Thread provider component
export const ThreadProvider: React.FC<ThreadProviderProps> = ({ children }) => {
  const [threads, setThreads] = useState<any[]>([]);
  const [selectedThread, setSelectedThread] = useState<any | null>(null);
  const [threadsLoading, setThreadsLoading] = useState<boolean>(false);

  // In a real implementation, this would fetch threads from your API
  const getThreads = async (): Promise<any[]> => {
    setThreadsLoading(true);
    try {
      // Example API call:
      // const response = await fetch('/api/langgraph/threads');
      // const data = await response.json();
      // setThreads(data);
      return threads;
    } catch (error) {
      console.error("Error fetching threads:", error);
      return [];
    } finally {
      setThreadsLoading(false);
    }
  };

  const value: ThreadContextType = {
    threads,
    setThreads,
    selectedThread,
    setSelectedThread,
    threadsLoading,
    setThreadsLoading,
    getThreads,
  };

  return (
    <ThreadContext.Provider value={value}>{children}</ThreadContext.Provider>
  );
};
