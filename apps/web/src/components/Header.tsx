"use client";

import Link from "next/link";
import { useState } from "react";
import { UserAvatar } from "./auth/UserAvatar";
import { useSession } from "@/hooks/useSession";

export function Header() {
  const { user, isLoading } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
              <nav
                className="hidden md:flex items-center gap-6"
                data-testid="auth-nav"
              >
                <Link
                  href="/proposals"
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                  data-testid="proposals-link"
                >
                  My Proposals
                </Link>
                <Link
                  href="/new"
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                  data-testid="new-proposal-link"
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
                data-testid="mobile-menu-button"
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
            {isLoading ? (
              <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
            ) : (
              <UserAvatar />
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && user && (
        <div
          className="md:hidden border-t bg-background"
          data-testid="mobile-menu"
        >
          <div className="w-full max-w-5xl mx-auto px-4">
            <nav className="py-4 flex flex-col gap-4">
              <Link
                href="/proposals"
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                onClick={() => setMobileMenuOpen(false)}
                data-testid="mobile-proposals-link"
              >
                My Proposals
              </Link>
              <Link
                href="/new"
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                onClick={() => setMobileMenuOpen(false)}
                data-testid="mobile-new-proposal-link"
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
