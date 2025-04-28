"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { getSession } from "@/lib/supabase";
import Header from "@/features/layout/components/Header";
import LoginButton from "@/features/auth/components/LoginButton"

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [hasAttemptedAuth, setHasAttemptedAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Temporarily disabled for debugging
    /*
    async function loadUser() {
      try {
        const { data, error } = await getSession();

        if (error) {
          console.error("[Home] Session error:", error);
          setAuthError(error.message);
          setHasAttemptedAuth(true);
          return;
        }

        const user = data?.session?.user || null;
        setUser(user);
        setHasAttemptedAuth(true);
      } catch (error) {
        console.error("[Home] Error loading user:", error);
        setAuthError(String(error));
        setHasAttemptedAuth(true);
      }
    }

    loadUser();
    */

    // Set default state for debugging
    setHasAttemptedAuth(true);
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <Header user={user} />

      <main className="flex flex-col flex-1">
        <div className="flex flex-col items-center justify-center flex-1 py-16 md:py-24">
          <div className="w-full max-w-5xl px-4 mx-auto">
            <div className="mb-16 space-y-8 text-center">
              <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
                Proposal Writer
              </h1>
              <p className="max-w-2xl mx-auto text-xl text-muted-foreground">
                Create high-quality proposals for grants and RFPs with the help
                of AI
              </p>
            </div>

            <div className="flex justify-center mb-16">
              {user ? (
                <Link
                  href="/dashboard"
                  className="px-4 py-2 font-medium text-white rounded-md bg-primary hover:bg-primary/90"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <LoginButton />
              )}
            </div>

            <div className="grid grid-cols-1 gap-8 px-4 md:grid-cols-3">
              <div className="flex flex-col items-center p-8 text-center transition-colors border rounded-lg bg-card hover:bg-accent/50">
                <div className="flex items-center justify-center w-12 h-12 mb-6 rounded-full bg-primary/20">
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
                    className="text-primary"
                  >
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                  </svg>
                </div>
                <h3 className="mb-3 text-xl font-medium">RFP Analysis</h3>
                <p className="text-muted-foreground">
                  Upload your RFP documents for in-depth analysis to understand
                  the funder's needs.
                </p>
              </div>

              <div className="flex flex-col items-center p-8 text-center transition-colors border rounded-lg bg-card hover:bg-accent/50">
                <div className="flex items-center justify-center w-12 h-12 mb-6 rounded-full bg-primary/20">
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
                    className="text-primary"
                  >
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
                    <path d="m9 12 2 2 4-4"></path>
                  </svg>
                </div>
                <h3 className="mb-3 text-xl font-medium">
                  Structured Sections
                </h3>
                <p className="text-muted-foreground">
                  Generate well-written proposal sections following dependency
                  order.
                </p>
              </div>

              <div className="flex flex-col items-center p-8 text-center transition-colors border rounded-lg bg-card hover:bg-accent/50">
                <div className="flex items-center justify-center w-12 h-12 mb-6 rounded-full bg-primary/20">
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
                    className="text-primary"
                  >
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14Z"></path>
                    <path d="M7 22V11"></path>
                  </svg>
                </div>
                <h3 className="mb-3 text-xl font-medium">
                  Feedback & Revisions
                </h3>
                <p className="text-muted-foreground">
                  Provide feedback on generated content and request revisions as
                  needed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-6 mt-auto border-t">
        <div className="container text-sm text-center text-muted-foreground">
          <p>
            © {new Date().getFullYear()} Proposal Writer System. All rights
            reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
