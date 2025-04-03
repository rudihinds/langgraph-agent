import { createBrowserClient } from "@supabase/ssr";

// Create a client for client-side usage
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Get the current origin for redirect URLs
export function getRedirectURL() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  // Fallback to default URL in SSR context
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3005";
}

/**
 * Initiates the sign-in with Google OAuth flow
 * This redirects the user to Google's authentication page
 */
export async function signIn() {
  try {
    const supabase = createClient();
    const redirectURL = getRedirectURL() + "/auth/callback";

    console.log("[Auth] Starting sign-in with redirect URL:", redirectURL);

    // Record auth start time for debugging
    if (typeof window !== "undefined") {
      localStorage.setItem("auth_start_time", new Date().toISOString());
    }

    return await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectURL,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
  } catch (error) {
    console.error("[Auth] Error in signIn:", error);
    throw error;
  }
}

/**
 * Signs out the current user
 */
export async function signOut() {
  const supabase = createClient();
  return await supabase.auth.signOut();
}

/**
 * Gets the current session if available
 */
export async function getSession() {
  const supabase = createClient();
  return await supabase.auth.getSession();
}

/**
 * Returns the access token for the current session
 * Useful for making authenticated API requests
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  } catch (error) {
    console.error("Error getting access token:", error);
    return null;
  }
}

/**
 * Check if the current session token is valid and try to refresh if needed
 * Returns true if the session is valid, false otherwise
 */
export async function validateSession(): Promise<boolean> {
  try {
    const supabase = createClient();

    // First check if we have a session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return false;
    }

    // If we have a session but it's expired, try to refresh
    const expiresAt = session.expires_at;
    if (expiresAt && Date.now() / 1000 >= expiresAt) {
      const { data } = await supabase.auth.refreshSession();
      return !!data.session;
    }

    return true;
  } catch (error) {
    console.error("Error validating session:", error);
    return false;
  }
}
