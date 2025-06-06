/**
 * Consolidated Supabase client exports
 *
 * This file serves as the single entry point for Supabase functionality.
 * Import what you need from here rather than directly from client.ts or server.ts.
 */

// Re-export the client functions with clear, consistent names
export { createClient } from "@/lib/supabase/client";
export { createClient as createServerClient } from "@/lib/supabase/server";

// Re-export auth functionality
export {
  signIn,
  signOut,
  getSession,
  getCurrentUser,
  checkUserSession,
  getRedirectURL,
  getAccessToken,
  validateSession,
  checkAuthAndRedirect,
  useCurrentUser,
  useRequireAuth,
} from "@/lib/supabase/auth";

// Export types
export type { SupabaseClient } from "@supabase/supabase-js";
