"use client";

/**
 * React hooks for Supabase authentication
 */
import { createClient } from '../client';
import { AppUser, CurrentUserState } from '../types';
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Hook to get the current authenticated user
 * Sets up a subscription to auth state changes and refreshes the router
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
      setUser(session?.user as AppUser || null);
      router.refresh();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  return { user, loading, error };
}

/**
 * Hook to require authentication
 * Redirects to login page if user is not authenticated
 * 
 * @returns {CurrentUserState} Object with user, loading state, and any error
 */
export function useRequireAuth(): CurrentUserState {
  const { user, loading, error } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user && !error) {
      // Redirect to login if not authenticated
      router.push("/login");
    }
  }, [user, loading, error, router]);

  return { user, loading, error };
}