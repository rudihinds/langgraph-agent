/**
 * Utility functions for Supabase authentication
 */
import { createClient } from "../client";
import { AppUser } from "../types";
import { createAuthErrorResponse } from "./src/features/auth/api/auth-errors";
import { ApiResponse } from "@/lib/errors/types";
import { logger } from "@/lib/logger";

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
 * @returns {Promise<ApiResponse<{ session: any }>>} The current session data with standardized response format
 */
export async function getSession(): Promise<ApiResponse<{ session: any }>> {
  try {
    const supabase = createClient();
    const result = await supabase.auth.getSession();

    if (result.error) {
      logger.error("[Supabase] Error getting session:", {}, result.error);
      return createAuthErrorResponse(result.error, "getSession");
    }

    return {
      success: true,
      data: { session: result.data.session },
    };
  } catch (error) {
    logger.error("[Supabase] Error getting session:", {}, error);
    return createAuthErrorResponse(error, "getSession");
  }
}

/**
 * Returns the access token for the current session
 * Useful for making authenticated API requests
 *
 * @returns {Promise<ApiResponse<string|null>>} The access token or null if not authenticated
 */
export async function getAccessToken(): Promise<ApiResponse<string | null>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      logger.error("[Supabase] Error getting access token:", {}, error);
      return createAuthErrorResponse(error, "getAccessToken");
    }

    return {
      success: true,
      data: data.session?.access_token || null,
    };
  } catch (error) {
    logger.error("[Supabase] Error getting access token:", {}, error);
    return createAuthErrorResponse(error, "getAccessToken");
  }
}

/**
 * Check if the current session token is valid and try to refresh if needed
 *
 * @returns {Promise<ApiResponse<boolean>>} True if the session is valid, false otherwise
 */
export async function validateSession(): Promise<ApiResponse<boolean>> {
  try {
    const supabase = createClient();

    // First check if we have a session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      logger.error(
        "[Supabase] Error getting session in validateSession:",
        {},
        sessionError
      );
      return createAuthErrorResponse(sessionError, "validateSession");
    }

    if (!session) {
      logger.info("[Supabase] No session found in validateSession");
      return { success: true, data: false };
    }

    // If we have a session but it's expired, try to refresh
    const expiresAt = session.expires_at;
    const currentTime = Date.now() / 1000;

    // If token expires within the next 5 minutes, refresh it
    if (expiresAt && currentTime + 300 >= expiresAt) {
      logger.info("[Supabase] Session expired or expiring soon, refreshing...");
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        logger.error("[Supabase] Error refreshing session:", {}, error);
        return createAuthErrorResponse(error, "validateSession.refreshSession");
      }

      logger.info("[Supabase] Session refreshed successfully");
      return { success: true, data: !!data.session };
    }

    return { success: true, data: true };
  } catch (error) {
    logger.error("[Supabase] Error validating session:", {}, error);
    return createAuthErrorResponse(error, "validateSession");
  }
}

/**
 * Gets the current user if authenticated
 *
 * @returns {Promise<ApiResponse<AppUser|null>>} The current user or null if not authenticated
 */
export async function getCurrentUser(): Promise<ApiResponse<AppUser | null>> {
  try {
    // First validate the session
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult as ApiResponse<null>;
    }

    if (!sessionResult.data) {
      logger.info("[Supabase] Session invalid in getCurrentUser");
      return { success: true, data: null };
    }

    const supabase = createClient();
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      logger.error("[Supabase] Error getting user:", {}, error);
      return createAuthErrorResponse(error, "getCurrentUser");
    }

    if (!data.user) {
      logger.info("[Supabase] No user found");
      return { success: true, data: null };
    }

    return { success: true, data: data.user as AppUser };
  } catch (error) {
    logger.error("[Supabase] Error getting current user:", {}, error);
    return createAuthErrorResponse(error, "getCurrentUser");
  }
}

/**
 * Function to check if user is authenticated and redirect if not
 * This is intended for client-side use only
 *
 * @returns {Promise<ApiResponse<AppUser|null>>} The current user or null if redirect happens
 */
export async function checkAuthAndRedirect(): Promise<
  ApiResponse<AppUser | null>
> {
  try {
    // First validate the session
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult as ApiResponse<null>;
    }

    if (!sessionResult.data) {
      throw new Error("Session invalid");
    }

    const supabase = createClient();
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      logger.error(
        "[Supabase] Authentication error in checkAuthAndRedirect:",
        {},
        error
      );
      return createAuthErrorResponse(error, "checkAuthAndRedirect");
    }

    if (!data.user) {
      logger.warn("[Supabase] No user found in checkAuthAndRedirect");
      throw new Error("Not authenticated");
    }

    return { success: true, data: data.user as AppUser };
  } catch (error) {
    logger.error("[Supabase] Authentication error:", {}, error);

    if (typeof window !== "undefined") {
      // Store the current URL to redirect back after login
      const returnUrl = encodeURIComponent(
        window.location.pathname + window.location.search
      );
      window.location.href = `/login?redirect=${returnUrl}`;
    }

    return createAuthErrorResponse(error, "checkAuthAndRedirect");
  }
}
