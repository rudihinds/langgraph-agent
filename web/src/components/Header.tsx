"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { UserAvatar } from "./auth/UserAvatar";
import { getCurrentUser } from "@/lib/supabase";

export function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="w-full max-w-5xl mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="text-xl font-semibold hover:text-primary transition-colors"
            >
              Proposal Writer
            </Link>
            {user && (
              <nav className="hidden md:flex items-center gap-6">
                <Link
                  href="/proposals"
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  My Proposals
                </Link>
                <Link
                  href="/new"
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  Create New
                </Link>
              </nav>
            )}
          </div>

          <div className="flex items-center gap-6">
            {user && (
              <button
                className="md:hidden text-muted-foreground hover:text-primary transition-colors"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="4" x2="20" y1="12" y2="12" />
                  <line x1="4" x2="20" y1="6" y2="6" />
                  <line x1="4" x2="20" y1="18" y2="18" />
                </svg>
              </button>
            )}
            <UserAvatar />
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && user && (
        <div className="md:hidden border-t bg-background">
          <div className="w-full max-w-5xl mx-auto px-4">
            <nav className="py-4 flex flex-col gap-4">
              <Link
                href="/proposals"
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                My Proposals
              </Link>
              <Link
                href="/new"
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Create New
              </Link>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
