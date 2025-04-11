//
// hooks/useSession.tsx
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getSession, signOut } from "@/lib/supabase/auth";

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
  return (
    document.cookie.includes("sb-") && document.cookie.includes("auth-token")
  );
}

// Helper to clear cookies that might be causing issues
function clearAuthCookies() {
  // List of cookies that could cause authentication issues
  const cookiesToClear = [
    "sb-rqwgqyhonjnzvgwxbrvh-auth-token-code-verifier",
    "sb-rqwgqyhonjnzvgwxbrvh-auth-token.0",
    "sb-rqwgqyhonjnzvgwxbrvh-auth-token.1",
    "auth-session-established",
    "auth-session-time",
  ];

  cookiesToClear.forEach((cookieName) => {
    document.cookie = `${cookieName}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Domain=${window.location.hostname}; SameSite=Lax`;
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
  const [debugMode, setDebugMode] = useState<boolean>(false); // Disable debug mode by default
  const refreshAttempts = React.useRef<number>(0);

  // Function to refresh the session data
  const refreshSession = async () => {
    try {
      // Only log session refreshes in debug mode to reduce spam
      if (debugMode) {
        console.log("[SessionProvider] Refreshing session...");
      }

      // Keep track of refresh attempts to prevent infinite loops
      const currentRefreshAttempt = refreshAttempts.current + 1;
      refreshAttempts.current = currentRefreshAttempt;

      // Limit refresh attempts to prevent infinite loops
      if (currentRefreshAttempt > 3) {
        console.warn(
          "[SessionProvider] Too many refresh attempts, breaking potential loop"
        );
        setIsLoading(false);
        return;
      }

      const { data, error } = await getSession();

      if (error) {
        console.error("[SessionProvider] Session refresh error:", error);
        setError(error);
      }

      // Only update the session state if it has changed
      // This prevents unnecessary re-renders
      const sessionChanged = 
        !session && data?.session || 
        session && !data?.session ||
        (session?.user?.id !== data?.session?.user?.id);

      if (sessionChanged) {
        // Set session state
        setSession(data?.session || null);
        setUser(data?.session?.user || null);
        
        if (debugMode) {
          console.log("[SessionProvider] Session state updated");
        }
      }

      // DEBUG: Log cookie state but limit frequency and only in debug mode
      if (debugMode && currentRefreshAttempt <= 2) {
        const markerExists = hasMarkerCookie();
        const authTokenExists = hasAuthTokenCookie();
        console.log(
          "[SessionProvider] Auth marker cookie exists:",
          markerExists
        );
        console.log(
          "[SessionProvider] Auth token cookie exists:",
          authTokenExists
        );
      }

      // If we have auth token cookies but no session, try to resolve the mismatch
      // But only once to prevent loops, and only in debug mode
      if (
        !data?.session &&
        hasAuthTokenCookie() &&
        !recoveryAttempted &&
        debugMode
      ) {
        console.log(
          "[SessionProvider] Found auth cookies but no session. Clearing cookies for clean state."
        );
        // This should resolve the token/session mismatch
        clearAuthCookies();
        setRecoveryAttempted(true);

        // Reset refresh attempts counter after recovery attempt
        refreshAttempts.current = 0;
      } else if (data?.session) {
        // We have a session, reset recovery flag and refresh attempts
        setRecoveryAttempted(false);
        refreshAttempts.current = 0;
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

      // Let the middleware handle redirects after sign out
      // Don't manually redirect here
    } catch (error) {
      console.error("[SessionProvider] Error signing out:", error);
      setError(error as Error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial session check and setup auth listener
  useEffect(() => {
    let isActive = true; // To prevent state updates after unmount
    console.log("[SessionProvider] Setting up auth state");

    // Get initial session
    setIsLoading(true);
    
    const initSession = async () => {
      try {
        if (isActive) {
          await refreshSession();
        }
      } catch (err) {
        console.error("[SessionProvider] Initial session setup error:", err);
      }
    };
    
    initSession();

    // Set up a timer to periodically check session status
    // Use longer interval (15 minutes) to reduce chances of infinite loops
    const sessionCheckInterval = setInterval(
      () => {
        if (isActive) {
          refreshSession();
        }
      },
      15 * 60 * 1000
    ); // Check every 15 minutes

    // Set up auth state listener
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: string, session: Session | null) => {
        if (debugMode) {
          console.log("[SessionProvider] Auth state changed:", event);
        }

        // Skip processing if component is unmounted
        if (!isActive) return;

        if (event === "SIGNED_IN") {
          if (debugMode || !user) {
            // Only log this when debug is on or user is null (first sign in)
            console.log("[SessionProvider] User signed in, updating auth state");
          }
          
          // Only update if the session has changed
          if (!user || user.id !== session?.user.id) {
            setSession(session);
            setUser(session?.user);
          }

          // Set marker cookie to track successful sign-in
          document.cookie =
            "auth-session-established=true; path=/; max-age=86400";
        } else if (event === "SIGNED_OUT") {
          console.log("[SessionProvider] User signed out, clearing auth state");
          // Also manually clear cookies on sign out event
          clearAuthCookies();

          // Clear user and session state
          setUser(null);
          setSession(null);
        } else if (event === "TOKEN_REFRESHED") {
          if (debugMode) {
            console.log("[SessionProvider] Token refreshed, updating session");
          }
          
          // Only update if the session is different
          if (session?.access_token !== session?.access_token) {
            setSession(session);
            setUser(session?.user);
          }
        }

        setIsLoading(false);
      }
    );

    // Cleanup subscription and interval
    return () => {
      isActive = false;
      clearInterval(sessionCheckInterval);
      subscription.unsubscribe();
      
      if (debugMode) {
        console.log("[SessionProvider] Cleaning up auth subscription");
      }
    };
  // Only depend on debugMode to prevent infinite re-renders
  // We don't want to re-run this effect when user/session changes
  }, [debugMode]);

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
