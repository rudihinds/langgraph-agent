/**
 * NextJS Authentication Higher-Order Component
 *
 * Provides route protection with automatic token refresh integration.
 * This HOC manages the complete authentication lifecycle for protected routes:
 * - Authentication verification
 * - Redirection of unauthenticated users
 * - Proactive token refresh when expiration is approaching
 * - Authentication state change management
 */
import { ComponentType, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { createAuthInterceptor } from "@/lib/api/auth-interceptor";

// Configuration constants
const TOKEN_REFRESH_THRESHOLD = 600; // In seconds (10 minutes)
const LOGIN_ROUTE = "/auth/login";
const DEFAULT_REDIRECT_PATH = "/protected-route";

/**
 * Retrieves the current path for post-login redirect
 * Falls back to a default path in SSR or test environments
 */
const getCurrentPath = (): string => {
  if (typeof window === "undefined") {
    return DEFAULT_REDIRECT_PATH;
  }
  return window.location.pathname;
};

/**
 * Creates a Supabase client with browser credentials
 * Handles the no-args linter warning by explicitly passing environment variables
 */
const createAuthClient = () => {
  // Access environment variables via process.env when available
  // These should be available in Next.js environment
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
};

/**
 * Higher-Order Component that protects routes requiring authentication
 *
 * @param Component - The component to protect with authentication
 * @returns A wrapped component that checks authentication before rendering
 */
export function withAuth<P extends object>(Component: ComponentType<P>) {
  function AuthGuard(props: P) {
    const router = useRouter();
    const [authState, setAuthState] = useState({
      isLoading: true,
      isAuthenticated: false,
    });

    /**
     * Redirects unauthenticated users to the login page
     * Preserves the current path for redirecting back after login
     */
    const redirectToLogin = useCallback(() => {
      setAuthState({ isLoading: false, isAuthenticated: false });
      const redirectPath = getCurrentPath();
      router.replace(`${LOGIN_ROUTE}?from=${redirectPath}`);
    }, [router]);

    /**
     * Refreshes the authentication token in the background
     * Uses the auth interceptor to handle the token refresh process
     * Doesn't interrupt the user experience on failure
     */
    const refreshTokenInBackground = useCallback(async () => {
      try {
        const interceptor = createAuthInterceptor();
        await interceptor.fetch("/api/auth/refresh");
      } catch (error) {
        // Log but don't disrupt user experience
        console.error(
          "Token refresh failed:",
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    }, []);

    /**
     * Checks if a token needs refresh based on its expiration time
     * @param expiresAt - Timestamp when the token expires (in seconds)
     * @returns boolean indicating if refresh is needed
     */
    const shouldRefreshToken = useCallback((expiresAt: number): boolean => {
      const now = Math.floor(Date.now() / 1000);
      const timeRemaining = expiresAt - now;
      return timeRemaining < TOKEN_REFRESH_THRESHOLD;
    }, []);

    // Set up authentication check and listener
    useEffect(() => {
      let isActive = true; // For avoiding state updates after unmount

      // Primary authentication verification function
      async function verifyAuthentication() {
        try {
          const supabase = createAuthClient();
          const { data, error } = await supabase.auth.getSession();

          // Handle error cases
          if (error || !data?.session) {
            if (isActive) redirectToLogin();
            return;
          }

          // Check token expiration and refresh if needed
          if (
            data.session.expires_at &&
            shouldRefreshToken(data.session.expires_at)
          ) {
            refreshTokenInBackground();
          }

          // Update authentication state
          if (isActive) {
            setAuthState({
              isLoading: false,
              isAuthenticated: true,
            });
          }
        } catch (error) {
          console.error(
            "Authentication verification failed:",
            error instanceof Error ? error.message : "Unknown error"
          );
          if (isActive) redirectToLogin();
        }
      }

      // Initial authentication check
      verifyAuthentication();

      // Set up auth state change listener
      const supabase = createAuthClient();
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (!isActive) return;

        if (event === "SIGNED_OUT") {
          setAuthState({ isLoading: false, isAuthenticated: false });
          redirectToLogin();
        } else if (event === "SIGNED_IN" && session) {
          setAuthState({ isLoading: false, isAuthenticated: true });
        }
      });

      // Cleanup on unmount
      return () => {
        isActive = false;
        if (data?.subscription) {
          data.subscription.unsubscribe();
        }
      };
    }, [redirectToLogin, refreshTokenInBackground, shouldRefreshToken]);

    // Component rendering logic based on authentication state
    const { isLoading, isAuthenticated } = authState;

    if (isLoading) {
      return <div>Loading...</div>;
    }

    if (isAuthenticated) {
      return <Component {...props} />;
    }

    // Return null while redirecting to login
    return null;
  }

  // Display name for debugging
  AuthGuard.displayName = `withAuth(${Component.displayName || Component.name || "Component"})`;

  return AuthGuard;
}
