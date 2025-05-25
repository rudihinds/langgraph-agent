import type { Session } from "@supabase/supabase-js";

// Mock session data for development
const MOCK_SESSION: Session = {
  access_token: "mock_access_token",
  refresh_token: "mock_refresh_token",
  expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
  expires_in: 3600,
  token_type: "bearer",
  user: {
    id: "mock_user_id",
    email: "user@example.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "",
  },
};

/**
 * Get the current user session
 *
 * @returns The current session or null if not authenticated
 */
export async function getSession(): Promise<Session | null> {
  // In a real app, this would use Supabase to get the actual session
  // For development, return the mock session
  return MOCK_SESSION;
}

/**
 * Refresh the current session token
 *
 * @returns The refreshed session or null if refresh failed
 */
export async function refreshSession(): Promise<Session | null> {
  // In a real app, this would use Supabase to refresh the token
  // For development, return an updated mock session
  const newExpiresAt = Math.floor(Date.now() / 1000) + 3600;
  return {
    ...MOCK_SESSION,
    expires_at: newExpiresAt,
  };
}
