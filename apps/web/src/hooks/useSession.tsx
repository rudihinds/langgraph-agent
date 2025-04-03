//
// hooks/useSession.tsx
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { createClient, getSession, signOut } from "@/lib/supabase";

// Types for our auth context
type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: Error | null;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

// Default context values
const initialState: AuthContextType = {
  user: null,
  session: null,
  isLoading: true,
  error: null,
  signOut: async () => {},
  refreshSession: async () => {},
};

// Create the context
const AuthContext = createContext<AuthContextType>(initialState);

// Hook to use the auth context
export function useSession() {
  return useContext(AuthContext);
}

// Helper to check if marker cookie exists
function hasMarkerCookie() {
  return document.cookie.includes("auth-session-established=true");
}

// Helper to check if Supabase auth token exists
function hasAuthTokenCookie() {
  return document.cookie.includes("sb-");
}

// Helper to clear cookies that might be causing issues
function clearAuthCookies() {
  // List of cookies that could cause authentication issues
  const cookiesToClear = [
    "sb-rqwgqyhonjnzvgwxbrvh-auth-token-code-verifier",
    "auth-session-established",
  ];

  cookiesToClear.forEach((cookieName) => {
    document.cookie = `${cookieName}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
    console.log(`[SessionProvider] Cleared cookie: ${cookieName}`);
  });
}

// Provider component to wrap around our app
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [recoveryAttempted, setRecoveryAttempted] = useState<boolean>(false);

  // Function to refresh the session data
  const refreshSession = async () => {
    try {
      console.log("[SessionProvider] Refreshing session...");
      const { data, error } = await getSession();

      if (error) {
        console.error("[SessionProvider] Session refresh error:", error);
      }

      console.log(
        "[SessionProvider] Session status:",
        data?.session ? "active" : "none"
      );

      setSession(data?.session || null);
      setUser(data?.session?.user || null);

      // DEBUG: Always log cookie state
      const markerExists = hasMarkerCookie();
      const authTokenExists = hasAuthTokenCookie();
      console.log("[SessionProvider] Auth marker cookie exists:", markerExists);
      console.log(
        "[SessionProvider] Auth token cookie exists:",
        authTokenExists
      );
      console.log("[SessionProvider] All cookies:", document.cookie);

      // If we didn't get a session but have authentication cookies
      if (!data?.session && false) {
        // DISABLED recovery mechanism temporarily
        // If we have marker cookie but no session, we might be in a state where cookies aren't properly synced
        if ((markerExists || authTokenExists) && !recoveryAttempted) {
          console.log(
            "[SessionProvider] Attempting session recovery due to cookie sync issue"
          );
          setRecoveryAttempted(true);

          // Try to force a relogin by clearing problematic cookies
          // This is a last resort for development only
          if (process.env.NODE_ENV !== "production") {
            console.log(
              "[SessionProvider] Clearing auth cookies for recovery attempt"
            );
            clearAuthCookies();

            // Force reload the page to clear any browser state
            if (typeof window !== "undefined") {
              // Wait a moment before redirecting
              setTimeout(() => {
                console.log(
                  "[SessionProvider] Redirecting to login for fresh authentication"
                );
                window.location.href = "/login?recovery=true";
              }, 500);
            }
          }
        }
      } else {
        // We have a session, reset recovery flag
        setRecoveryAttempted(false);
      }
    } catch (error) {
      console.error("[SessionProvider] Error refreshing session:", error);
      setError(error as Error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle sign out
  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      console.log("[SessionProvider] Signing out user");
      await signOut();

      // Clear session state
      setUser(null);
      setSession(null);

      // Also manually clear all auth cookies to ensure clean state
      clearAuthCookies();

      console.log("[SessionProvider] User signed out successfully");
    } catch (error) {
      console.error("[SessionProvider] Error signing out:", error);
      setError(error as Error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial session check and setup auth listener
  useEffect(() => {
    console.log("[SessionProvider] Setting up auth state");
    console.log("[SessionProvider] Initial cookies:", document.cookie);

    // Get initial session
    refreshSession();

    // Set up auth state listener
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: string, session: Session | null) => {
        console.log("[SessionProvider] Auth state changed:", event);
        console.log(
          "[SessionProvider] Cookies after state change:",
          document.cookie
        );

        if (event === "SIGNED_IN") {
          console.log("[SessionProvider] User signed in, updating auth state");
        } else if (event === "SIGNED_OUT") {
          console.log("[SessionProvider] User signed out, clearing auth state");
          // Also manually clear cookies on sign out event
          clearAuthCookies();
        }

        setSession(session);
        setUser(session?.user || null);
        setIsLoading(false);
      }
    );

    // Cleanup subscription
    return () => {
      console.log("[SessionProvider] Cleaning up auth subscription");
      subscription.unsubscribe();
    };
  }, []);

  // Context value
  const value = {
    user,
    session,
    isLoading,
    error,
    signOut: handleSignOut,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
