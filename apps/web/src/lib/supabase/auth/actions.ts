/**
 * Auth actions for Supabase authentication
 */
import { createClient } from "../client";
import { getRedirectURL } from "./utils";
import { SignInResult, SignOutResult } from "../types";

/**
 * Initiates the sign-in with Google OAuth flow
 * This redirects the user to Google's authentication page
 *
 * @returns {Promise<SignInResult>} The result of the sign-in attempt
 */
export async function signIn(): Promise<SignInResult> {
  try {
    const supabase = createClient();
    const redirectURL = getRedirectURL() + "/auth/callback";

    console.log("[Auth] Starting sign-in with redirect URL:", redirectURL);

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
      console.error("[Auth] Error during OAuth sign-in:", error);
      throw error;
    }

    // If we got this far without a redirect, manually navigate to the auth URL
    if (data?.url && typeof window !== "undefined") {
      console.log("[Auth] Manually navigating to auth URL:", data.url);
      window.location.href = data.url;
    }

    return { data, error: null };
  } catch (error) {
    console.error("[Auth] Error in signIn:", error);
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error("Unknown error during sign-in"),
    };
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
): Promise<SignOutResult> {
  try {
    // First call server-side sign-out endpoint to clear cookies
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

    // Then sign out on the client side
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("[Auth] Error in signOut:", error);
      throw error;
    }

    // Redirect to login page
    if (typeof window !== "undefined") {
      window.location.href = redirectTo;
    }

    return { success: true };
  } catch (error) {
    console.error("[Auth] Error in signOut:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to sign out",
    };
  }
}
