"use client";

/**
 * Authentication hooks for the application
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AppUser, CurrentUserState } from "@/lib/supabase/types";

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
        console.error("[Auth] Error getting user:", error);
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
 * Hook for pages that require authentication
 * Will redirect to login if not authenticated
 *
 * @returns {CurrentUserState} Object with user, loading state, and any error
 */
export function useRequireAuth(): CurrentUserState {
  const { user, loading, error } = useCurrentUser();
  const router = useRouter();

  // Add a safety redirection for client-side router-based navigation
  useEffect(() => {
    if (!loading && !user && !error) {
      console.log("[Auth] User not authenticated, redirecting to login");
      const returnUrl = encodeURIComponent(window.location.pathname);
      router.push(`/login?callbackUrl=${returnUrl}`);
    }
  }, [user, loading, error, router]);

  return { user, loading, error };
}
