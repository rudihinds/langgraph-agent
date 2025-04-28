/**
 * Supabase Authentication
 *
 * This module provides all authentication-related functionality for Supabase,
 * including sign-in, sign-out, session management, and auth hooks.
 */

// Re-export from actions
export {
  signIn,
  signOut,
  getSession,
  getCurrentUser,
  checkUserSession,
} from "@/lib/supabase/auth/actions";

// Re-export from utils
export {
  getRedirectURL,
  getAccessToken,
  validateSession,
  checkAuthAndRedirect,
} from "@/lib/supabase/auth/utils";

// Re-export from hooks
export { useCurrentUser } from "@/lib/supabase/auth/hooks";
export { useRequireAuth } from "@/lib/supabase/auth/hooks";

