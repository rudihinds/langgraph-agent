/**
 * Type definitions for Supabase-related functionality
 */
import { User, Session } from "@supabase/supabase-js";
import { ApiResponse, BaseError } from "@/lib/errors/types";

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
 * Deprecated: Result of sign-in operation
 * @deprecated Use ApiResponse<SignInData> instead
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
 * Type for successful sign-in data
 */
export interface SignInData {
  url?: string;
  session?: AppSession;
  user?: AppUser;
}

/**
 * Deprecated: Result of sign-out operation
 * @deprecated Use ApiResponse<SignOutData> instead
 */
export interface SignOutResult {
  success: boolean;
  error?: string;
}

/**
 * Type for successful sign-out data
 */
export interface SignOutData {
  success: boolean;
}

/**
 * Current user state with loading and error information
 */
export interface CurrentUserState {
  user: AppUser | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Type alias for auth operation responses using standardized format
 */
export type AuthResponse<T> = ApiResponse<T>;

/**
 * Type for auth error details
 */
export interface AuthErrorDetails extends BaseError {
  status?: number;
  supabaseErrorCode?: string;
  originalError?: string;
}
