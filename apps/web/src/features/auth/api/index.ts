/**
 * Auth API exports
 */

// Re-export the auth functionality from the existing Supabase library
export {
  createClient,
  signIn,
  getSession,
  getCurrentUser,
} from "@/lib/supabase";

// Export local auth actions that aren't in the main Supabase lib
export { signOut, checkUserSession } from "@/features/auth/api/actions";

// Export server-side client creation
export { createClient as createServerClient } from "@/lib/supabase/server";

// Auth-specific client export (if needed)
export { createClient as createAuthClient } from "@/features/auth/api/client";

// Additional utility exports
export { getRedirectURL, getAccessToken, validateSession } from "./utils";
