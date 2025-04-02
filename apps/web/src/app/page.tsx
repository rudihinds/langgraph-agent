"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/supabase";

export default function Home() {
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

  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-5xl mx-auto px-4 py-16 sm:py-24">
        <div className="text-center space-y-6 mb-16">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Proposal Writer
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Create high-quality proposals for grants and RFPs with the help of
            AI
          </p>
        </div>

        {user ? (
          <div className="flex gap-4 justify-center mb-16">
            <Link
              href="/new"
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-md font-medium transition-colors"
            >
              Start New Proposal
            </Link>
            <Link
              href="/proposals"
              className="bg-secondary text-secondary-foreground hover:bg-secondary/90 px-6 py-3 rounded-md font-medium transition-colors"
            >
              View My Proposals
            </Link>
          </div>
        ) : (
          <div className="flex justify-center mb-16">
            <Link
              href="/login"
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-md font-medium transition-colors"
            >
              Sign in to Get Started
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 px-4">
          <div className="flex flex-col items-center text-center p-8 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
            <div className="w-12 h-12 mb-6 rounded-full bg-primary/20 flex items-center justify-center">
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
            <h3 className="text-xl font-medium mb-3">RFP Analysis</h3>
            <p className="text-muted-foreground">
              Upload your RFP documents for in-depth analysis to understand the
              funder's needs.
            </p>
          </div>

          <div className="flex flex-col items-center text-center p-8 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
            <div className="w-12 h-12 mb-6 rounded-full bg-primary/20 flex items-center justify-center">
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
            <h3 className="text-xl font-medium mb-3">Structured Sections</h3>
            <p className="text-muted-foreground">
              Generate well-written proposal sections following dependency
              order.
            </p>
          </div>

          <div className="flex flex-col items-center text-center p-8 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
            <div className="w-12 h-12 mb-6 rounded-full bg-primary/20 flex items-center justify-center">
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
            <h3 className="text-xl font-medium mb-3">Feedback & Revisions</h3>
            <p className="text-muted-foreground">
              Provide feedback on generated content and request revisions as
              needed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
