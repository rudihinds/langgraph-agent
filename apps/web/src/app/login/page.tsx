"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "@/lib/supabase";
import { useSession } from "@/hooks/useSession";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useSession();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the redirect path from URL params or default to homepage
  const redirect = searchParams.get("redirect") || "/";

  // If user is already logged in, redirect
  useEffect(() => {
    if (user && !isLoading) {
      router.replace(redirect);
    }
  }, [user, isLoading, redirect, router]);

  const handleLogin = async () => {
    try {
      setIsSigningIn(true);
      setError(null);
      await signIn();
      // OAuth redirect will happen, no need to navigate here
    } catch (err) {
      console.error("Login error:", err);
      setError("An error occurred during sign in. Please try again.");
      setIsSigningIn(false);
    }
  };

  // Show loading state if checking auth status
  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="py-12 max-w-md mx-auto">
      <div className="bg-card rounded-lg shadow-md p-8 text-center">
        <h1 className="text-2xl font-bold mb-2">Welcome to Proposal Writer</h1>
        <p className="text-muted-foreground mb-8">
          Sign in to create and manage your proposals
        </p>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={isSigningIn}
          className="w-full bg-primary text-primary-foreground rounded-md px-4 py-3 font-medium flex items-center justify-center gap-2"
        >
          {isSigningIn ? (
            <>
              <span className="h-4 w-4 border-2 border-t-background rounded-full animate-spin"></span>
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </button>

        <p className="mt-6 text-sm text-muted-foreground">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
