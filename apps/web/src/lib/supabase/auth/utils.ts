/**
 * Utility functions for Supabase authentication
 */
import { createClient } from "../client";
import { AppUser } from "../types";

/**
 * Get the current origin for redirect URLs
 * Used for OAuth redirect_to URLs
 *
 * @returns {string} The origin URL or fallback URL
 */
export function getRedirectURL(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  // Fallback to default URL in SSR context
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

/**
 * Gets the current session if available
 *
 * @returns {Promise<object>} The current session data
 */
export async function getSession() {
  try {
    const supabase = createClient();
    return await supabase.auth.getSession();
  } catch (error) {
    console.error("[Supabase] Error getting session:", error);
    return { data: { session: null }, error };
  }
}

/**
 * Returns the access token for the current session
 * Useful for making authenticated API requests
 *
 * @returns {Promise<string|null>} The access token or null if not authenticated
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  } catch (error) {
    console.error("[Supabase] Error getting access token:", error);
    return null;
  }
}

/**
 * Check if the current session token is valid and try to refresh if needed
 *
 * @returns {Promise<boolean>} True if the session is valid, false otherwise
 */
export async function validateSession(): Promise<boolean> {
  try {
    const supabase = createClient();

    // First check if we have a session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      console.log("[Supabase] No session found");
      return false;
    }

    // If we have a session but it's expired, try to refresh
    const expiresAt = session.expires_at;
    const currentTime = Date.now() / 1000;

    // If token expires within the next 5 minutes, refresh it
    if (expiresAt && currentTime + 300 >= expiresAt) {
      console.log("[Supabase] Session expired or expiring soon, refreshing...");
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        console.error("[Supabase] Error refreshing session:", error);
        return false;
      }

      console.log("[Supabase] Session refreshed successfully");
      return !!data.session;
    }

    return true;
  } catch (error) {
    console.error("[Supabase] Error validating session:", error);
    return false;
  }
}

/**
 * Gets the current user if authenticated
 *
 * @returns {Promise<AppUser|null>} The current user or null if not authenticated
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  try {
    // First validate the session
    const isSessionValid = await validateSession();
    if (!isSessionValid) {
      console.log("[Supabase] Session invalid in getCurrentUser");
      return null;
    }

    const supabase = createClient();
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      console.error("[Supabase] Error getting user:", error);
      return null;
    }

    if (!data.user) {
      console.log("[Supabase] No user found");
      return null;
    }

    return data.user as AppUser;
  } catch (error) {
    console.error("[Supabase] Error getting current user:", error);
    return null;
  }
}

/**
 * Function to check if user is authenticated and redirect if not
 * This is intended for client-side use only
 *
 * @returns {Promise<AppUser|null>} The current user or null if redirect happens
 */
export async function checkAuthAndRedirect(): Promise<AppUser | null> {
  try {
    // First validate the session
    const isSessionValid = await validateSession();
    if (!isSessionValid) {
      throw new Error("Session invalid");
    }

    const supabase = createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      throw new Error("Not authenticated");
    }

    return user as AppUser;
  } catch (error) {
    console.error("[Supabase] Authentication error:", error);
    if (typeof window !== "undefined") {
      // Store the current URL to redirect back after login
      const returnUrl = encodeURIComponent(
        window.location.pathname + window.location.search
      );
      window.location.href = `/login?redirect=${returnUrl}`;
    }
    return null;
  }
}
