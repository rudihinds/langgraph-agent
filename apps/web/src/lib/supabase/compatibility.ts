/**
 * @deprecated This file provides backward compatibility with the old Supabase utility structure.
 * Please import from the new locations instead.
 */

// Re-export from auth
export {
  signIn,
  signOut,
  getSession,
  getAccessToken,
  validateSession,
  getCurrentUser,
  getRedirectURL,
  checkAuthAndRedirect,
  useCurrentUser,
  useRequireAuth
} from './auth';

// Re-export client creation
export { createClient } from './client';