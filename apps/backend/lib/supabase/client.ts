/**
 * Supabase client configuration and initialization.
 *
 * This module provides a centralized way to create and configure
 * Supabase clients for various purposes, particularly for accessing
 * storage buckets and other Supabase features.
 */

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
 * Configuration options for creating a Supabase client
 */
export interface SupabaseConfig {
  /**
   * Supabase project URL (e.g., https://your-project.supabase.co)
   */
  supabaseUrl: string;

  /**
   * Supabase API key (anon key or service role key)
   */
  supabaseKey: string;
}

/**
 * Creates a Supabase client with the provided configuration or environment variables.
 *
 * @param config - Optional configuration overrides
 * @returns Configured Supabase client
 * @throws Error if required configuration is missing
 */
export function createSupabaseClient(config?: Partial<SupabaseConfig>) {
  const supabaseUrl = config?.supabaseUrl || process.env.SUPABASE_URL;
  const supabaseKey =
    config?.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Validate required configuration
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase configuration. Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are set."
    );
  }

  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Pre-configured Supabase client using server-side credentials.
 * Use this for backend operations that require service role privileges.
 */
export const serverSupabase = createSupabaseClient();

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
