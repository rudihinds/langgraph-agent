"use client";

/**
 * @deprecated Please import from @/lib/supabase/auth/hooks or @/lib/supabase/auth instead.
 * This file will be removed in a future release.
 */

import {
  useCurrentUser as useCurrentUserInternal,
  useRequireAuth as useRequireAuthInternal,
} from '@/lib/supabase/auth/hooks';

import {
  signOut as signOutInternal,
  checkAuthAndRedirect as checkAuthAndRedirectInternal,
} from '@/lib/supabase/auth';

// Re-export with same names to maintain compatibility
export const useCurrentUser = useCurrentUserInternal;
export const useRequireAuth = useRequireAuthInternal;
const checkAuthAndRedirect = checkAuthAndRedirectInternal;
export const signOut = signOutInternal;