/**
 * Type definitions for Supabase-related functionality
 */
import { User, Session } from '@supabase/supabase-js';

/**
 * Supabase user extended with application-specific properties
 */
export interface AppUser extends User {
  // Add any application-specific user properties here
}

/**
 * Supabase session extended with application-specific properties
 */
export interface AppSession extends Session {
  // Add any application-specific session properties here
}

/**
 * Result of sign-in operation
 */
export interface SignInResult {
  data: {
    url?: string;
    session?: AppSession;
    user?: AppUser;
  } | null;
  error: Error | null;
}

/**
 * Result of sign-out operation
 */
export interface SignOutResult {
  success: boolean;
  error?: string;
}

/**
 * Current user state with loading and error information
 */
export interface CurrentUserState {
  user: AppUser | null;
  loading: boolean;
  error: Error | null;
}