import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Environment variables with fallbacks
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

// Validate environment variables
if (!SUPABASE_URL) {
  console.error("Missing SUPABASE_URL environment variable");
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
}

if (!SUPABASE_ANON_KEY) {
  console.error("Missing SUPABASE_ANON_KEY environment variable");
}

/**
 * Options for creating a Supabase client
 */
export interface CreateClientOptions {
  /**
   * Custom Supabase URL (overrides environment variable)
   */
  customUrl?: string;

  /**
   * Custom Supabase key (overrides environment variable)
   */
  customKey?: string;

  /**
   * Whether to use the service role key (server-side only)
   */
  useServiceRole?: boolean;
}

/**
 * Creates a Supabase client with the given options
 * @param options Client configuration options
 * @returns Supabase client instance
 */
export function createSupabaseClient(
  options: CreateClientOptions = {}
): SupabaseClient {
  const { customUrl, customKey, useServiceRole = false } = options;

  const url = customUrl || SUPABASE_URL;
  const key =
    customKey ||
    (useServiceRole ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_ANON_KEY);

  if (!url || !key) {
    throw new Error(
      "Supabase URL or key is missing. Please set the environment variables."
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
    },
  });
}

/**
 * Singleton instance of Supabase client for server-side operations
 * Uses the service role key for admin privileges
 */
export const serverSupabase = createSupabaseClient({ useServiceRole: true });

/**
 * Parse cookies from a cookie header string
 * @param cookieHeader Cookie header string
 * @returns Object with cookie name-value pairs
 */
export function parseCookies(cookieHeader: string): Record<string, string> {
  return cookieHeader.split(";").reduce(
    (cookies, cookie) => {
      const [name, value] = cookie.trim().split("=");
      if (name && value) {
        cookies[name.trim()] = value.trim();
      }
      return cookies;
    },
    {} as Record<string, string>
  );
}

/**
 * Get a Supabase client with the current user's session
 * @param cookieHeader Optional cookie header for auth
 * @returns Supabase client with the user's session
 */
export function getAuthenticatedClient(cookieHeader?: string): SupabaseClient {
  const client = createSupabaseClient();

  if (typeof window === "undefined" && cookieHeader) {
    // Server-side: extract auth token from cookies
    const cookies = parseCookies(cookieHeader);
    const supabaseAuthToken = cookies["sb-auth-token"];

    if (supabaseAuthToken) {
      // Set the auth session on the client
      client.auth.setSession({
        access_token: supabaseAuthToken,
        refresh_token: "",
      });
    }
  }

  return client;
}
