"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Create a client hook to get the current user
export function useCurrentUser() {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
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

        setUser(user);
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
      setUser(session?.user || null);
      router.refresh();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  return { user, loading, error };
}

// Create a hook to require authentication
export function useRequireAuth() {
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

// Function to check if user is authenticated and redirect if not
export async function checkAuthAndRedirect() {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      throw new Error("Not authenticated");
    }

    return user;
  } catch (error) {
    console.error("Authentication error:", error);
    window.location.href = "/login";
    return null;
  }
}

/**
 * Sign out the current user using the server-side sign-out endpoint
 * This ensures proper cookie handling on both client and server
 */
export async function signOut(redirectTo: string = "/login") {
  try {
    // First, call the server endpoint for cookie clearing
    const response = await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || "Failed to sign out");
    }

    // Also sign out on client side
    const supabase = createClient();
    await supabase.auth.signOut();

    // Redirect to login page
    window.location.href = redirectTo;
    return { success: true };
  } catch (error) {
    console.error("Error signing out:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to sign out",
    };
  }
}
