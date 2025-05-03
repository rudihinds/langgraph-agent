import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import { getSession, refreshSession } from "@/src/lib/auth-client";

/**
 * Hook to access and manage the current user session.
 *
 * This is a simplified mock implementation for development.
 */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const router = useRouter();
  const pathname = usePathname();

  // Initial session loading
  useEffect(() => {
    async function loadInitialSession() {
      try {
        setIsLoading(true);
        const sessionData = await getSession();
        setSession(sessionData);
      } catch (error) {
        console.error("Error getting session:", error);
        setError(
          error instanceof Error ? error : new Error("Failed to get session")
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadInitialSession();
  }, []);

  // Refresh the session
  const handleRefreshSession = async (): Promise<Session | null> => {
    try {
      setIsLoading(true);
      setError(null);
      const refreshedSession = await refreshSession();
      setSession(refreshedSession);
      return refreshedSession;
    } catch (error) {
      console.error("Error refreshing session:", error);
      setError(
        error instanceof Error ? error : new Error("Failed to refresh session")
      );
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out the user - mock implementation
  const signOut = async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Clear the session
      setSession(null);
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
      setError(
        error instanceof Error ? error : new Error("Failed to sign out")
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Disable redirect for development
  /*
  useEffect(() => {
    if (!isLoading && !session && !pathname.includes('/login')) {
      router.push('/login');
    }
  }, [session, isLoading, router, pathname]);
  */

  return {
    session,
    isLoading,
    error,
    refreshSession: handleRefreshSession,
    signOut,
    user: session?.user ?? null,
  };
}
