/**
 * Utilities for validating and handling Supabase JWT tokens
 */

import { createClient } from "@supabase/supabase-js";
import { Logger } from "../logger.js";

// Initialize logger
const logger = Logger.getInstance();

// Token refresh buffer - recommend refresh when less than 10 minutes remaining
const TOKEN_REFRESH_BUFFER_SECONDS = 600;

// Get environment variables - fail fast if not available
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_ANON_KEY environment variables must be set"
  );
}

// Create a Supabase client for token validation
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Interface for validation result
 */
export interface TokenValidationResult {
  valid: boolean;
  user?: {
    id: string;
    email: string;
    [key: string]: any;
  };
  error?: string;
  expiresIn?: number;
  refreshRecommended?: boolean;
}

/**
 * Validates a JWT token from Supabase
 * @param token The JWT token to validate
 * @returns Token validation result with user info if valid
 */
export async function validateToken(
  token?: string
): Promise<TokenValidationResult> {
  if (!token) {
    return { valid: false, error: "No token provided" };
  }

  try {
    // Verify the token with Supabase
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      logger.warn("Token validation failed", { error: error?.message });
      return { valid: false, error: error?.message || "Invalid token" };
    }

    // Calculate token expiration
    const expirationInfo = getTokenExpiration(token);

    return {
      valid: true,
      user: {
        id: data.user.id,
        email: data.user.email || "",
        ...data.user,
      },
      expiresIn: expirationInfo.expiresIn,
      refreshRecommended: expirationInfo.refreshRecommended,
    };
  } catch (error: any) {
    logger.error("Error validating token", { error: error?.message });
    return {
      valid: false,
      error: error?.message || "Token validation failed",
    };
  }
}

/**
 * Extract JWT expiration time and calculate if refresh is recommended
 * @param token JWT token
 * @returns Object with expiresIn (seconds) and refreshRecommended flag
 */
export function getTokenExpiration(token: string): {
  expiresIn: number;
  refreshRecommended: boolean;
} {
  try {
    // Extract the payload part of the JWT token
    const payload = token.split(".")[1];
    const decodedPayload = JSON.parse(
      Buffer.from(payload, "base64").toString()
    );

    // Get expiration timestamp from token
    const expTime = decodedPayload.exp;
    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
    const expiresIn = expTime - currentTime;

    // Recommend refresh if token expires in less than buffer time
    const refreshRecommended = expiresIn < TOKEN_REFRESH_BUFFER_SECONDS;

    return { expiresIn, refreshRecommended };
  } catch (error) {
    logger.warn("Error calculating token expiration", { error });
    // If we can't parse the token expiration, recommend refresh to be safe
    return { expiresIn: 0, refreshRecommended: true };
  }
}

/**
 * Creates an authenticated Supabase client using the provided token
 * @param token JWT token
 * @returns Authenticated Supabase client
 */
export function createAuthenticatedClient(token: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

/**
 * Extracts the bearer token from an Authorization header
 * @param authHeader The Authorization header value
 * @returns The token or undefined if not valid
 */
export function extractBearerToken(authHeader?: string): string | undefined {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return undefined;
  }

  return authHeader.split(" ")[1];
}
