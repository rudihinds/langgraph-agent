import { useEffect, useState } from "react";

export interface AuthSession {
  access_token?: string;
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

  return {
    session,
    loading,
    signIn,
    signOut,
    isAuthenticated: !!session,
  };
}
