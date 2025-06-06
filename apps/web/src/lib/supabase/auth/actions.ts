/**
 * Auth actions for Supabase authentication
 */
import { createClient } from "../client";
import { getRedirectURL } from "./utils";

import { createAuthErrorResponse } from "./auth-errors";
import { ApiResponse, ErrorCodes } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Initiates the sign-in with Google OAuth flow
 * This redirects the user to Google"s authentication page
 *
 * @returns {Promise<SignInResult>} The result of the sign-in attempt
 */
export async function signIn(): Promise<ApiResponse<{ url?: string }>> {
  try {
    const supabase = createClient();
    const redirectURL = getRedirectURL() + "/auth/callback";

    logger.info("[Auth] Starting sign-in with redirect URL:", { redirectURL });

    // Record auth start time for debugging
    if (typeof window !== "undefined") {
      localStorage.setItem("auth_start_time", new Date().toISOString());
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectURL,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      logger.error("[Auth] Error during OAuth sign-in:", {}, error);
      return createAuthErrorResponse(error, "signIn");
    }

    // If we got this far without a redirect, manually navigate to the auth URL
    if (data?.url && typeof window !== "undefined") {
      logger.info("[Auth] Manually navigating to auth URL:", { url: data.url });
      window.location.href = data.url;
    }

    return { success: true, data };
  } catch (error) {
    logger.error("[Auth] Error in signIn:", {}, error);
    return createAuthErrorResponse(error, "signIn");
  }
}

/**
 * Signs out the current user on both client and server
 * Makes a server-side request to clear cookies and then signs out on the client
 *
 * @param {string} redirectTo - Optional URL to redirect to after signout (defaults to /login)
 * @returns {Promise<SignOutResult>} Result of the sign-out operation
 */
export async function signOut(
  redirectTo: string = "/login"
): Promise<ApiResponse<{ success: boolean }>> {
  try {
    logger.info("[Auth] Starting sign-out process");

    // First call server-side sign-out endpoint to clear cookies
    const response = await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const data = await response.json();
      logger.error(
        "[Auth] Server-side sign-out failed:",
        { status: response.status },
        data
      );

      return {
        success: false,
        error: {
          message: data.message || "Failed to sign out",
          code: ErrorCodes.AUTHENTICATION,
          details: { status: response.status },
        },
      };
    }

    // Then sign out on the client side
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      logger.error("[Auth] Error in signOut:", {}, error);
      return createAuthErrorResponse(error, "signOut");
    }

    // Redirect to login page
    if (typeof window !== "undefined") {
      window.location.href = redirectTo;
    }

    return { success: true, data: { success: true } };
  } catch (error) {
    logger.error("[Auth] Error in signOut:", {}, error);
    return createAuthErrorResponse(error, "signOut");
  }
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
      logger.error("[Auth] Error getting session:", {}, result.error);
      return createAuthErrorResponse(result.error, "getSession");
    }

    return {
      success: true,
      data: { session: result.data.session },
    };
  } catch (error) {
    logger.error("[Auth] Error getting session:", {}, error);
    return createAuthErrorResponse(error, "getSession");
  }
}

/**
 * Gets the current user if authenticated
 *
 * @returns {Promise<ApiResponse<any>>} The current user or null if not authenticated
 */
export async function getCurrentUser(): Promise<ApiResponse<any>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      logger.error("[Auth] Error getting user:", {}, error);
      return createAuthErrorResponse(error, "getCurrentUser");
    }

    if (!data.user) {
      logger.info("[Auth] No user found");
      return { success: true, data: null };
    }

    return { success: true, data: data.user };
  } catch (error) {
    logger.error("[Auth] Error getting current user:", {}, error);
    return createAuthErrorResponse(error, "getCurrentUser");
  }
}

/**
 * Function to check if user is authenticated and redirect if not
 * This is intended for client-side use only
 *
 * @returns {Promise<ApiResponse<any>>} The current user or null if redirect happens
 */
export async function checkUserSession(): Promise<ApiResponse<any>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      logger.error(
        "[Auth] Authentication error in checkUserSession:",
        {},
        error
      );
      return createAuthErrorResponse(error, "checkUserSession");
    }

    if (!data.user) {
      logger.warn("[Auth] No user found in checkUserSession");
      throw new Error("Not authenticated");
    }

    return { success: true, data: data.user };
  } catch (error) {
    logger.error("[Auth] Authentication error:", {}, error);
    return createAuthErrorResponse(error, "checkUserSession");
  }
}
