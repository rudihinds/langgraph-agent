"use client";

import {
  useEffect,
  useState,
  createContext,
  useContext,
  ReactNode,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";

// Define the session context types
interface SessionContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: Error | null;
  refreshSession: () => Promise<void>;
}

// Create context with default values
const SessionContext = createContext<SessionContextType>({
  user: null,
  session: null,
  isLoading: true,
  error: null,
  refreshSession: async () => {},
});

// Session provider component
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Function to get and update the session
  const refreshSession = async () => {
    try {
      setIsLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      setSession(data.session);
      setUser(data.session?.user || null);
    } catch (err) {
      console.error("Error refreshing session:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize session on component mount
  useEffect(() => {
    refreshSession();

    // Set up auth state change listener
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state change event:", event);

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setSession(session);
        setUser(session?.user || null);
      } else if (event === "SIGNED_OUT") {
        setSession(null);
        setUser(null);
      }
    });

    // Clean up subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <SessionContext.Provider
      value={{ user, session, isLoading, error, refreshSession }}
    >
      {children}
    </SessionContext.Provider>
  );
}

// Custom hook to use session context
export function useSession() {
  const context = useContext(SessionContext);

  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }

  return context;
}
