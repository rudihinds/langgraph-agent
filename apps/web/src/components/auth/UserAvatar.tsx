"use client";

import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/supabase";

export function UserAvatar() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    }

    loadUser();
  }, []);

  if (!user) {
    return (
      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
        <span className="text-xs font-medium">?</span>
      </div>
    );
  }

  // Get initials from user metadata or email
  const getInitials = () => {
    if (user.user_metadata?.full_name) {
      return user.user_metadata.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2);
    }

    return user.email?.substring(0, 2).toUpperCase() || "?";
  };

  // Use avatar URL if available, otherwise show initials
  return user.user_metadata?.avatar_url ? (
    <img
      src={user.user_metadata.avatar_url}
      alt={user.user_metadata?.full_name || user.email || "User avatar"}
      className="h-10 w-10 rounded-full object-cover"
    />
  ) : (
    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
      <span className="text-xs font-medium text-primary-foreground">
        {getInitials()}
      </span>
    </div>
  );
}
