import {
  createClient as createSupabaseBrowserClient,
  createBrowserClient,
} from "@/lib/supabase/client";

/**
 * Re-export the central Supabase browser client for auth-specific use
 *
 * This follows the pattern of having feature-specific imports while
 * avoiding duplication of the core implementation.
 */
export const createClient = createSupabaseBrowserClient;

// Re-export for compatibility with interceptors
export { createBrowserClient };
