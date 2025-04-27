/**
 * Auth API exports
 *
 * @deprecated Use imports from '@/lib/supabase/auth' instead.
 */

// Import auth functionality directly from the centralized location
export {
  createClient,
  signIn,
  signOut,
  getSession,
  getCurrentUser,
  checkUserSession,
  getRedirectURL,
  getAccessToken,
  validateSession,
} from "@/lib/supabase/auth";

// Export server-side client creation
export { createClient as createServerClient } from "@/lib/supabase/server";

// Auth-specific client export for backwards compatibility
export { createClient as createAuthClient } from "@/features/auth/api/client";
