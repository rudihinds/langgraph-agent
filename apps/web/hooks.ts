"use client";

/**
 * React hooks for Supabase authentication
 */
import { createClient } from "../client";
import { AppUser, CurrentUserState } from "../types";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Hook to get the current authenticated user
 * Sets up a subscription to auth state changes
 * Doesn't perform any redirects - just provides auth state
 *
 * @returns {CurrentUserState} Object with user, loading state, and any error
 */
export function useCurrentUser(): CurrentUserState {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const getUser = async () => {
      try {
        setLoading(true);
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) {
          throw error;
        }

        setUser(user as AppUser);
      } catch (error) {
        console.error("Error getting user:", error);
        setError(error as Error);
      } finally {
        setLoading(false);
      }
    };

    getUser();

    // Set up auth state change listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser((session?.user as AppUser) || null);
      // Just refresh the router to update the UI without redirecting
      router.refresh();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  return { user, loading, error };
}

/**
 * IMPORTANT: This hook is NOT used for normal page protection
 * Only use this for pages that should be protected but aren't covered by middleware
 * Most pages should rely on middleware for auth protection instead
 *
 * @returns {CurrentUserState} Object with user, loading state, and any error
 */
export function useRequireAuth(): CurrentUserState {
  const { user, loading, error } = useCurrentUser();
  const router = useRouter();

  // Only add a safety redirection for client-side router-based navigation
  // Middleware should handle most auth protection
  useEffect(() => {
    if (!loading && !user && !error) {
      // Only log the redirect - middleware should have already redirected
      console.warn(
        "[useRequireAuth] Fallback redirection to login - middleware should handle this"
      );
      router.push("/login");
    }
  }, [user, loading, error, router]);

  return { user, loading, error };
}
