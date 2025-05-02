import { useEffect, useState } from "react";

export interface AuthSession {
  access_token?: string;
  expires_at?: number; // Expiration time in seconds since epoch
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}

/**
 * Simplified auth hook for use with the Chat UI
 * This provides a basic session structure that can be expanded later
 */
export function useAuth() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real implementation, this would fetch the session from a proper auth provider
    // For now, we'll just simulate a logged-in user with local storage
    const storedSession = localStorage.getItem("auth_session");

    if (storedSession) {
      try {
        setSession(JSON.parse(storedSession));
      } catch (e) {
        console.error("Error parsing stored session:", e);
      }
    }

    setLoading(false);
  }, []);

  const signIn = async () => {
    // Mock sign in functionality
    const mockSession: AuthSession = {
      access_token: "mock_token_" + Math.random().toString(36).substring(2),
      // Set expiration to 1 hour from now
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: "user_" + Math.random().toString(36).substring(2),
        email: "user@example.com",
        name: "Demo User",
      },
    };

    localStorage.setItem("auth_session", JSON.stringify(mockSession));
    setSession(mockSession);

    return mockSession;
  };

  const signOut = async () => {
    localStorage.removeItem("auth_session");
    setSession(null);
  };

  const refreshSession = async () => {
    if (!session) {
      throw new Error("Cannot refresh session: No active session");
    }

    // Create a new session with a refreshed token and expiration
    const refreshedSession: AuthSession = {
      ...session,
      access_token:
        "refreshed_token_" + Math.random().toString(36).substring(2),
      expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    };

    localStorage.setItem("auth_session", JSON.stringify(refreshedSession));
    setSession(refreshedSession);

    return refreshedSession;
  };

  return {
    session,
    loading,
    signIn,
    signOut,
    refreshSession,
    isAuthenticated: !!session,
  };
}
