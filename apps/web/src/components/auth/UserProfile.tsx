import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { getCurrentUser, signOut } from "@/lib/supabase";

export function UserProfile() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const user = await getCurrentUser();
        setUser(user);
      } catch (error) {
        console.error("Error loading user:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
      window.location.href = "/auth/login";
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse"></div>
        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <a
        href="/auth/login"
        className="text-sm font-medium text-primary hover:underline"
      >
        Sign In
      </a>
    );
  }

  return (
    <div className="flex items-center space-x-4">
      <div className="flex flex-col space-y-1 leading-none">
        {user.user_metadata.full_name && (
          <p className="text-sm font-medium">{user.user_metadata.full_name}</p>
        )}
        <p className="text-xs text-muted-foreground">{user.email}</p>
      </div>
      <button
        onClick={handleSignOut}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        Sign Out
      </button>
    </div>
  );
}