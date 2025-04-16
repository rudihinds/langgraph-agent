/**
 * @deprecated Please import from @/lib/supabase/auth or @/lib/supabase/client instead.
 * This file will be removed in a future release.
 */

import {
  signIn as authSignIn,
  signOut as authSignOut,
  getSession as authGetSession,
  getAccessToken as authGetAccessToken,
  validateSession as authValidateSession,
  getCurrentUser as authGetCurrentUser,
  getRedirectURL as authGetRedirectURL,
} from '@/lib/supabase/auth';

import { createClient as createClientInternal } from '@/lib/supabase/client';

// Re-export with same names to maintain compatibility
export const createClient = createClientInternal;
const getRedirectURL = authGetRedirectURL;
export const signIn = authSignIn;
const signOut = authSignOut;
export const getSession = authGetSession;
const getAccessToken = authGetAccessToken;
const validateSession = authValidateSession;
export const getCurrentUser = authGetCurrentUser;