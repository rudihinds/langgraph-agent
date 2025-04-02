import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Create a singleton Supabase client with automatic token refresh
let supabaseInstance: ReturnType<typeof createSupabaseClient> | null = null;

export function createClient() {
  if (supabaseInstance) return supabaseInstance;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables");
  }

  // Create Supabase client with persisted auth state
  supabaseInstance = createSupabaseClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true, // Enable persisted auth
      autoRefreshToken: true, // Enable auto refresh token
      detectSessionInUrl: true, // Look for access token in URL
      storageKey: "sb-auth-token", // Custom storage key
    },
  });

  return supabaseInstance;
}

export async function signIn() {
  const supabase = createClient();

  try {
    // Use OAuth with Google
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: "offline", // For refresh token
          prompt: "consent", // Force consent screen to get refresh token every time
        },
      },
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error signing in:", error);
    throw error;
  }
}

export async function signOut() {
  const supabase = createClient();

  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
}

export async function getCurrentUser() {
  try {
    const supabase = createClient();
    console.log("Attempting to get current user session");

    const {
      data: { session },
    } = await supabase.auth.getSession();
    console.log(
      "Session response:",
      session ? "Session found" : "No session found"
    );

    if (!session) {
      console.log("No active session found");
      return null;
    }

    console.log("User found:", session.user.email);
    return session.user;
  } catch (error) {
    console.error("Error in getCurrentUser:", error);
    return null;
  }
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
