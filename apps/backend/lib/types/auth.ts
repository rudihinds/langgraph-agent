/**
 * Authentication Type Definitions
 *
 * This module contains type definitions related to authentication functionality,
 * including interfaces for authenticated requests and responses.
 */

import { Request } from "express";
import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Interface extending Express Request with authentication-related properties
 * set by the authentication middleware.
 */
export interface AuthenticatedRequest extends Request {
  /**
   * Authenticated user information retrieved from JWT token.
   */
  user?: {
    /** Unique identifier for the user */
    id: string;
    /** User's email address */
    email: string;
  };

  /**
   * Authenticated Supabase client configured with the user's JWT token.
   * This client respects Row Level Security (RLS) policies when accessing resources.
   */
  supabase?: SupabaseClient;

  /**
   * Number of seconds until the JWT token expires.
   * Added by the auth middleware during token expiration processing.
   *
   * A value of 0 or negative indicates the token has already expired.
   */
  tokenExpiresIn?: number;

  /**
   * Flag indicating if token refresh is recommended.
   *
   * This is set to true when the token will expire within the configured threshold
   * (typically when token expiration is within 10 minutes).
   *
   * Route handlers should check this flag and set the X-Token-Refresh-Recommended
   * header in their responses when this is true.
   */
  tokenRefreshRecommended?: boolean;
}

/**
 * Constants related to token refresh functionality
 */
export const AUTH_CONSTANTS = {
  /**
   * Header name for token refresh recommendation
   */
  REFRESH_HEADER: "X-Token-Refresh-Recommended",

  /**
   * Default threshold in seconds for recommending token refresh
   * (10 minutes = 600 seconds)
   */
  REFRESH_RECOMMENDATION_THRESHOLD: 600,

  /**
   * Expected lifetime of a JWT token in seconds
   * (1 hour = 3600 seconds)
   */
  DEFAULT_TOKEN_LIFETIME: 3600,
};

/**
 * Types of authentication errors that can occur
 */
export enum AuthErrorType {
  MISSING_TOKEN = "missing_token",
  INVALID_TOKEN = "invalid_token",
  EXPIRED_TOKEN = "expired_token",
  SERVER_ERROR = "server_error",
}

/**
 * Structure of an authentication error response
 */
export interface AuthErrorResponse {
  error: string;
  message: string;
  refresh_required?: boolean;
  errorType?: AuthErrorType;
}
