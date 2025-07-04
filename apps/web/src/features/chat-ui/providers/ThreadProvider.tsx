"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useCallback,
  useEffect,
} from "react";
import { Thread, ThreadStatus } from "@langchain/langgraph-sdk";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/hooks/useAuth";
import {
  recordNewProposalThread,
  listUserProposalThreads,
  UserProposalThreadType,
} from "@/lib/api/client";

import { createClient } from "../lib/client";

interface ThreadContextType {
  threads: Thread[];
  setThreads: React.Dispatch<React.SetStateAction<Thread[]>>;
  getThreads: (agentId?: string) => Promise<Thread[]>;
  applicationThreads: UserProposalThreadType[];
  getApplicationThreads: (rfpId?: string) => Promise<UserProposalThreadType[]>;
  createThread: (
    input?: Record<string, any>,
    proposalTitle?: string
  ) => Promise<string | null>;
  deleteThread: (threadId: string) => Promise<boolean>;
  loading: boolean;
  error: Error | null;
  threadsLoading: boolean;
  setThreadsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  appThreadsLoading: boolean;
}

const ThreadContext = createContext<ThreadContextType | undefined>(undefined);

/**
 * Provider component for thread-related functionality
 */
export function ThreadProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Get API URL and assistant ID from search params
  const apiUrl =
    searchParams.get("apiUrl") ||
    process.env.NEXT_PUBLIC_LANGGRAPH_API_URL ||
    "http://localhost:2024";
  const assistantId = searchParams.get("assistantId") || 
    process.env.NEXT_PUBLIC_ASSISTANT_ID || 
    "proposal-agent";

  const [loading, setLoading] = useState(false);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [appThreadsLoading, setAppThreadsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [applicationThreads, setApplicationThreads] = useState<
    UserProposalThreadType[]
  >([]);

  // Update URL params helper function
  const updateUrlParams = useCallback(
    (params: Record<string, string>) => {
      const newParams = new URLSearchParams(searchParams.toString());

      // Update or add provided params
      Object.entries(params).forEach(([key, value]) => {
        if (value) {
          newParams.set(key, value);
        } else {
          newParams.delete(key);
        }
      });

      // Construct and update URL
      const newUrl = `${pathname}?${newParams.toString()}`;
      router.replace(newUrl, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  /**
   * Get threads for the current assistant/agent
   */
  const getThreads = useCallback(
    async (agentId?: string): Promise<Thread[]> => {
      if (!apiUrl) {
        toast.error("API URL not set");
        return [];
      }

      const client = createClient(apiUrl, session?.access_token);

      setThreadsLoading(true);
      setError(null);

      try {
        const targetAgentId = agentId || assistantId;
        if (!targetAgentId) {
          toast.error("No agent ID specified");
          return [];
        }

        // Check if it's a UUID or a graph name
        const isUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            targetAgentId
          );

        const searchQuery = isUuid
          ? { assistant_id: targetAgentId }
          : { graph_id: targetAgentId };
          
        console.log("[ThreadProvider] Searching threads with query:", {
          targetAgentId,
          isUuid,
          searchQuery,
          apiUrl
        });

        const threads = await client.threads.search({
          metadata: searchQuery,
          limit: 100,
        });

        console.log("[ThreadProvider] Found threads:", threads.length);
        setThreads(threads);
        return threads;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error("Error fetching threads:", error);
        setError(error);
        toast.error("Failed to fetch threads", {
          description: error.message,
        });
        return [];
      } finally {
        setThreadsLoading(false);
      }
    },
    [apiUrl, assistantId, session?.access_token]
  );

  const getApplicationThreads = useCallback(
    async (rfpIdFilter?: string): Promise<UserProposalThreadType[]> => {
      if (!session?.access_token) {
        // toast.error("User not authenticated to fetch application threads.");
        // Don't toast here, as it might be called on initial load before session is ready
        return [];
      }
      setAppThreadsLoading(true);
      setError(null);
      try {
        const fetchedAppThreads = await listUserProposalThreads(
          session.access_token,
          rfpIdFilter
        );
        setApplicationThreads(fetchedAppThreads);
        return fetchedAppThreads;
      } catch (err) {
        const errorMsg = err instanceof Error ? err : new Error(String(err));
        console.error("Error fetching application threads:", errorMsg);
        setError(errorMsg);
        toast.error("Failed to fetch your proposal threads.", {
          description: errorMsg.message,
        });
        return [];
      } finally {
        setAppThreadsLoading(false);
      }
    },
    [session?.access_token]
  );

  /**
   * Create a new thread
   */
  const createThread = useCallback(
    async (
      input?: Record<string, any>,
      proposalTitle?: string
    ): Promise<string | null> => {
      if (!apiUrl || !assistantId) {
        toast.error("API URL or Assistant ID not set");
        return null;
      }

      const rfpId = searchParams.get("rfpId");

      setLoading(true);
      setError(null);

      let langGraphThreadId: string | null = null;

      try {
        const client = createClient(apiUrl, session?.access_token);

        const threadIdResponse = await client.threads.create({
          metadata: {
            graph_id: assistantId,
            ...(input && { initial_input: JSON.stringify(input) }),
          },
        });

        langGraphThreadId =
          typeof threadIdResponse === "string"
            ? threadIdResponse
            : threadIdResponse.thread_id;

        if (langGraphThreadId && rfpId && session?.access_token) {
          try {
            await recordNewProposalThread(
              {
                rfpId,
                appGeneratedThreadId: langGraphThreadId,
                ...(proposalTitle && { proposalTitle }),
              },
              session.access_token
            );
            toast.success("Proposal thread association recorded.");
            await getApplicationThreads(rfpId);
          } catch (assocError: any) {
            console.error(
              "Error recording proposal thread association:",
              assocError
            );
            toast.error("Failed to record proposal thread association.", {
              description: assocError.message,
            });
          }
        } else if (rfpId && !session?.access_token) {
          toast.info(
            "LangGraph thread created, but user not authenticated to record association."
          );
        }

        // Refresh the threads list
        await getThreads();

        return langGraphThreadId;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error("Error creating thread:", error);
        setError(error);
        toast.error("Failed to create thread", {
          description: error.message,
        });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [
      apiUrl,
      assistantId,
      getThreads,
      session?.access_token,
      searchParams,
      getApplicationThreads,
    ]
  );

  /**
   * Delete a thread
   */
  const deleteThread = useCallback(
    async (threadId: string): Promise<boolean> => {
      if (!apiUrl) {
        toast.error("API URL not set");
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        const client = createClient(apiUrl, session?.access_token);

        await client.threads.delete(threadId);

        // Update the local state to remove the deleted thread
        setThreads((prevThreads) =>
          prevThreads.filter((t) => t.thread_id !== threadId)
        );

        setApplicationThreads((prevAppThreads) =>
          prevAppThreads.filter((t) => t.appGeneratedThreadId !== threadId)
        );

        toast.success("Thread deleted from LangGraph and local list.");
        return true;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error("Error deleting thread:", error);
        setError(error);
        toast.error("Failed to delete thread", {
          description: error.message,
        });
        return false;
      } finally {
        setLoading(false);
      }
    },
    [apiUrl, session?.access_token]
  );

  // Initial thread loading
  useEffect(() => {
    if (apiUrl && assistantId) {
      getThreads();
    }
  }, [apiUrl, assistantId, getThreads]);

  // Initial loading of application threads
  useEffect(() => {
    const currentRfpId = searchParams.get("rfpId");
    if (session?.access_token) {
      getApplicationThreads(currentRfpId || undefined);
    }
  }, [session?.access_token, searchParams, getApplicationThreads]);

  const value = {
    threads,
    setThreads,
    getThreads,
    applicationThreads,
    getApplicationThreads,
    createThread,
    deleteThread,
    loading,
    error,
    threadsLoading,
    setThreadsLoading,
    appThreadsLoading,
  };

  return (
    <ThreadContext.Provider value={value}>{children}</ThreadContext.Provider>
  );
}

/**
 * Hook to access the thread context
 */
export function useThreads() {
  const context = useContext(ThreadContext);
  if (!context) {
    throw new Error("useThreads must be used within a ThreadProvider");
  }
  return context;
}
