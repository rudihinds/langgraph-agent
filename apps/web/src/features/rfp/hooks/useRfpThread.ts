/**
 * RFP Thread Management Hook
 *
 * Provides functionality to interact with the thread management API
 * for associating RFP documents with LangGraph threads.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useSession } from "@/hooks/useSession";

// Response type from thread API
interface ThreadResponse {
  threadId: string;
  isNew: boolean;
}

// Thread mapping type
interface ThreadMapping {
  threadId: string;
  rfpId: string;
  createdAt: string;
}

// Thread list response
interface ThreadsResponse {
  threads: ThreadMapping[];
}

// Local thread cache to prevent unnecessary API calls
const threadCache: Record<string, string> = {};

// Maximum number of retries for API requests
const MAX_RETRIES = 2;

// Background retry delay in milliseconds
const RETRY_DELAY = 1000;

/**
 * Hook for RFP thread management
 * Provides functions for accessing and manipulating thread mappings
 */
export function useRfpThread() {
  const { session } = useSession();
  const [threads, setThreads] = useState<ThreadMapping[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Flag to indicate if threads have been fetched
  const [hasLoadedThreads, setHasLoadedThreads] = useState(false);

  // Use refs to prevent useEffect loops
  const hasFetchedRef = useRef(false);
  const isMountedRef = useRef(true);
  const fetchFailedCountRef = useRef(0);
  const isRetryingRef = useRef(false);

  // API endpoints for thread management
  const API_ENDPOINTS = {
    THREADS: "/api/rfp/threads",
    THREAD: "/api/rfp/thread",
    THREAD_BY_ID: (id: string) => `/api/rfp/thread/${id}`,
  };

  // Helper for authenticated fetch
  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      if (!session?.access_token) {
        throw new Error("No authentication token available");
      }

      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });
    },
    [session?.access_token]
  );

  /**
   * Get or create a thread for an RFP document
   */
  const getOrCreateThread = useCallback(
    async (rfpId: string): Promise<ThreadResponse> => {
      try {
        setError(null);
        setIsLoading(true);

        // Check cache first
        if (threadCache[rfpId]) {
          return {
            threadId: threadCache[rfpId],
            isNew: false,
          };
        }

        const response = await authFetch(API_ENDPOINTS.THREAD_BY_ID(rfpId));

        // Check for token refresh header
        const refreshRecommended = response.headers.get(
          "X-Token-Refresh-Recommended"
        );
        if (refreshRecommended === "true") {
          // We should notify that token needs refresh
          console.warn("Token refresh recommended");
          // Implement token refresh logic here if needed
        }

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to get thread");
        }

        const result = await response.json();

        // Cache the result
        threadCache[rfpId] = result.threadId;

        return result;
      } catch (err: unknown) {
        // If we get an error, generate a fallback thread ID to prevent loops
        console.warn("Could not get thread, using fallback:", err);
        const fallbackThreadId = generateDummyThreadId(rfpId);

        // Add to cache to prevent further requests
        threadCache[rfpId] = fallbackThreadId;

        const message =
          err instanceof Error ? err.message : "Failed to get thread";
        setError(message);

        // Return a fallback response
        return {
          threadId: fallbackThreadId,
          isNew: true,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [authFetch, API_ENDPOINTS]
  );

  /**
   * Get all threads for the current user
   */
  const fetchThreads = useCallback(async (): Promise<ThreadMapping[]> => {
    // Don't set loading state if we're just initializing silently
    const shouldUpdateLoadingState = hasFetchedRef.current;

    if (shouldUpdateLoadingState) {
      setIsLoading(true);
    }

    try {
      setError(null);

      const response = await authFetch(API_ENDPOINTS.THREADS);

      // Check for token refresh header
      const refreshRecommended = response.headers.get(
        "X-Token-Refresh-Recommended"
      );
      if (refreshRecommended === "true") {
        // We should notify that token needs refresh
        console.warn("Token refresh recommended");
        // Implement token refresh logic here if needed
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to get threads");
      }

      const data = await response.json();

      // Reset failure counter on success
      fetchFailedCountRef.current = 0;

      // Update thread cache with fetched data
      if (data.threads && Array.isArray(data.threads)) {
        data.threads.forEach((thread: ThreadMapping) => {
          threadCache[thread.rfpId] = thread.threadId;
        });

        // Only update state if component is still mounted
        if (isMountedRef.current) {
          setThreads(data.threads);
          setHasLoadedThreads(true);
          hasFetchedRef.current = true;
        }
      }

      return data.threads || [];
    } catch (err: unknown) {
      console.error("Error fetching threads:", err);
      const message =
        err instanceof Error ? err.message : "Failed to fetch threads";

      // Only show error after multiple failures
      fetchFailedCountRef.current++;

      if (isMountedRef.current) {
        if (fetchFailedCountRef.current > MAX_RETRIES) {
          setError(message);
        }

        // Mark as loaded even if we failed, to prevent constant retries
        if (fetchFailedCountRef.current >= MAX_RETRIES) {
          setHasLoadedThreads(true);
          hasFetchedRef.current = true;
        } else if (!isRetryingRef.current) {
          // Schedule a retry in the background if we haven't reached max retries
          isRetryingRef.current = true;
          setTimeout(() => {
            isRetryingRef.current = false;
            fetchThreads().catch(console.error);
          }, RETRY_DELAY);
        }
      }

      return [];
    } finally {
      if (shouldUpdateLoadingState && isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [authFetch, API_ENDPOINTS]);

  /**
   * Delete a thread mapping
   */
  const deleteThread = useCallback(
    async (threadId: string): Promise<boolean> => {
      try {
        setIsDeleting(true);
        setError(null);

        const response = await authFetch(API_ENDPOINTS.THREAD_BY_ID(threadId), {
          method: "DELETE",
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to delete thread");
        }

        // Update local state after successful deletion
        setThreads((prev) => {
          const deletedThread = prev.find((t) => t.threadId === threadId);
          if (deletedThread) {
            // Remove from cache if it exists
            delete threadCache[deletedThread.rfpId];
          }
          return prev.filter((t) => t.threadId !== threadId);
        });

        return true;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to delete thread";
        setError(message);
        return false;
      } finally {
        setIsDeleting(false);
      }
    },
    [authFetch, API_ENDPOINTS]
  );

  /**
   * Get thread ID for an RFP if it exists (non-creating version)
   */
  const getThreadForRfp = useCallback(
    async (rfpId: string): Promise<string | null> => {
      try {
        // Check for the thread in the cache first
        if (threadCache[rfpId]) {
          return threadCache[rfpId];
        }

        // Find the thread in the cached threads data if available
        if (threads.length > 0) {
          const existingThread = threads.find(
            (t: ThreadMapping) => t.rfpId === rfpId
          );
          if (existingThread) {
            // Add to cache
            threadCache[rfpId] = existingThread.threadId;
            return existingThread.threadId;
          }
        }

        // If not in cache, make the API call
        const { threadId } = await getOrCreateThread(rfpId);

        // Cache the result
        threadCache[rfpId] = threadId;
        return threadId;
      } catch (err: unknown) {
        return null;
      }
    },
    [threads, getOrCreateThread]
  );

  // For initial development without backend, provide a dummy thread ID
  const generateDummyThreadId = useCallback((rfpId: string): string => {
    // Create a consistent thread ID based on RFP ID to simulate a real thread
    return `thread_${rfpId.replace(/-/g, "")}_dummy`;
  }, []);

  // Load threads on mount if user is authenticated
  useEffect(() => {
    // Only attempt to fetch if we have a session but haven't loaded threads yet
    if (session?.access_token && !hasLoadedThreads && !hasFetchedRef.current) {
      hasFetchedRef.current = true; // Mark as started immediately to prevent multiple attempts

      // Attempt to fetch, but fail silently if the endpoint isn't available yet
      fetchThreads().catch((error) => {
        console.warn(
          "Could not load threads, may be using fallback mode:",
          error
        );
        // We'll still mark as loaded since we tried
        if (isMountedRef.current) {
          setHasLoadedThreads(true);
        }
      });
    }

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMountedRef.current = false;
    };
  }, [session, fetchThreads, hasLoadedThreads]);

  return {
    // Functions
    getOrCreateThread,
    getThreadForRfp,
    deleteThread,
    fetchThreads,

    // Data
    threads,
    isLoading,
    refetchThreads: fetchThreads,

    // State
    error,
    setError,
    isDeleting,

    // Helper
    hasLoadedThreads,

    // Fallback for testing/development
    generateDummyThreadId,
  };
}
