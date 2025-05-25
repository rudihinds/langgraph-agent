import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useCallback,
} from "react";
import { Thread, ThreadStatus } from "@langchain/langgraph-sdk";
import { toast } from "sonner";

import { useStreamContext } from "./StreamProvider";
import { AgentInbox } from "../types";
import { createClient } from "../lib/client";

interface AgentInboxContextType {
  selectedAgent: AgentInbox | null;
  setSelectedAgent: (agent: AgentInbox | null) => void;
  agents: AgentInbox[];
  setAgents: (agents: AgentInbox[]) => void;
  threads: Thread[];
  setThreads: (threads: Thread[]) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  threadStatus: Record<string, ThreadStatus>;
  setThreadStatus: (status: Record<string, ThreadStatus>) => void;
  fetchThreads: (agent: AgentInbox) => Promise<void>;
  refreshThreads: () => Promise<void>;
  deleteThread: (threadId: string) => Promise<void>;
}

const AgentInboxContext = createContext<AgentInboxContextType | undefined>(
  undefined
);

export function AgentInboxProvider({ children }: { children: ReactNode }) {
  const { submit, threadId } = useStreamContext();
  const [selectedAgent, setSelectedAgent] = useState<AgentInbox | null>(null);
  const [agents, setAgents] = useState<AgentInbox[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(false);
  const [threadStatus, setThreadStatus] = useState<
    Record<string, ThreadStatus>
  >({});

  // Fetch available agents on mount
  useEffect(() => {
    // In a real application, you would fetch from an API
    // This is just placeholder data for now
    const exampleAgent: AgentInbox = {
      id: "proposal_agent",
      graphId: "proposal_agent",
      deploymentUrl:
        process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "/api/langgraph",
      name: "Proposal Generator",
      selected: false,
    };

    setAgents([exampleAgent]);

    // Select the first agent by default if none is selected
    if (!selectedAgent) {
      setSelectedAgent(exampleAgent);
    }
  }, [selectedAgent]);

  // Fetch threads for the selected agent
  const fetchThreads = useCallback(async (agent: AgentInbox) => {
    if (!agent) return;

    setLoading(true);
    try {
      // Create a client for the selected agent
      const client = createClient(
        agent.deploymentUrl,
        process.env.NEXT_PUBLIC_LANGGRAPH_API_KEY
      );

      // Fetch threads using the client
      const fetchedThreads = await client.threads.search();
      setThreads(fetchedThreads);

      // Update thread statuses
      const newThreadStatus: Record<string, ThreadStatus> = {};
      for (const thread of fetchedThreads) {
        try {
          // Get thread state to determine status
          const state = await client.threads.getState(thread.thread_id);
          // Infer status from state - use valid ThreadStatus values
          newThreadStatus[thread.thread_id] = thread.status || "idle";
        } catch (error) {
          console.error(
            `Error fetching status for thread ${thread.thread_id}:`,
            error
          );
          newThreadStatus[thread.thread_id] = "idle";
        }
      }
      setThreadStatus(newThreadStatus);
    } catch (error) {
      console.error("Error fetching threads:", error);
      toast.error("Failed to fetch threads", {
        description: "Please try again later",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh threads for the current selected agent
  const refreshThreads = useCallback(async () => {
    if (selectedAgent) {
      await fetchThreads(selectedAgent);
    }
  }, [selectedAgent, fetchThreads]);

  // Delete a thread
  const deleteThread = useCallback(
    async (threadId: string) => {
      if (!selectedAgent) return;

      try {
        const client = createClient(
          selectedAgent.deploymentUrl,
          process.env.NEXT_PUBLIC_LANGGRAPH_API_KEY
        );

        await client.threads.delete(threadId);
        toast.success("Thread deleted");

        // Refresh the threads list
        refreshThreads();
      } catch (error) {
        console.error("Error deleting thread:", error);
        toast.error("Failed to delete thread", {
          description: "Please try again later",
        });
      }
    },
    [selectedAgent, refreshThreads]
  );

  // Fetch threads when the selected agent changes
  useEffect(() => {
    if (selectedAgent) {
      fetchThreads(selectedAgent);
    }
  }, [selectedAgent, fetchThreads]);

  const contextValue = {
    selectedAgent,
    setSelectedAgent,
    agents,
    setAgents,
    threads,
    setThreads,
    loading,
    setLoading,
    threadStatus,
    setThreadStatus,
    fetchThreads,
    refreshThreads,
    deleteThread,
  };

  return (
    <AgentInboxContext.Provider value={contextValue}>
      {children}
    </AgentInboxContext.Provider>
  );
}

export function useAgentInbox() {
  const context = useContext(AgentInboxContext);
  if (context === undefined) {
    throw new Error("useAgentInbox must be used within an AgentInboxProvider");
  }
  return context;
}
