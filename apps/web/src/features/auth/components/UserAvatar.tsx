"use client";

import { useState, useRef } from "react";
import { useSession } from "@/features/auth/hooks/useSession";
import { signOut } from "@/lib/supabase";

export function UserAvatar() {
  const { user } = useSession();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close dropdown
  const handleClickOutside = (event: MouseEvent) => {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(event.target as Node)
    ) {
      setDropdownOpen(false);
    }
  };

  // Add event listener when dropdown is open
  if (typeof window !== "undefined" && dropdownOpen) {
    window.addEventListener("click", handleClickOutside);
  }

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = "/";
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (!user) {
    return (
      <a
        href="/login"
        className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90"
      >
        Sign In
      </a>
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
  const avatarContent = user.user_metadata?.avatar_url ? (
    <img
      src={user.user_metadata.avatar_url}
      alt={user.user_metadata?.full_name || user.email || "User avatar"}
      className="h-10 w-10 rounded-full object-cover"
      data-testid="user-avatar"
      onClick={() => setDropdownOpen(!dropdownOpen)}
    />
  ) : (
    <div
      className="h-10 w-10 rounded-full bg-primary flex items-center justify-center cursor-pointer"
      data-testid="user-avatar"
      onClick={() => setDropdownOpen(!dropdownOpen)}
    >
      <span className="text-xs font-medium text-primary-foreground">
        {getInitials()}
      </span>
    </div>
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {avatarContent}

      {/* Dropdown menu */}
      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-background border">
          <div className="py-1" role="menu" aria-orientation="vertical">
            <div className="px-4 py-2 text-sm border-b">
              <div className="font-medium">
                {user.user_metadata?.full_name || user.email}
              </div>
              <div className="text-muted-foreground text-xs truncate">
                {user.email}
              </div>
            </div>
            <a
              href="/proposals"
              className="block px-4 py-2 text-sm hover:bg-muted"
              onClick={() => setDropdownOpen(false)}
            >
              My Proposals
            </a>
            <a
              href="/settings"
              className="block px-4 py-2 text-sm hover:bg-muted"
              onClick={() => setDropdownOpen(false)}
            >
              Settings
            </a>
            <button
              onClick={handleSignOut}
              className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-muted"
              data-testid="sign-out-button"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
