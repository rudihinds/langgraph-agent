"use client";

import { useState } from "react";
import { signIn } from "@/lib/supabase";

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await signIn();
      if (!result.success) {
        throw new Error(
          result.error?.message || "An error occurred during sign in"
        );
      }
      // If successful, the user will be redirected to Google OAuth
    } catch (err: any) {
      setError(err.message || "An error occurred during sign in");
      console.error("Error signing in with Google:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-6 mx-auto space-y-6 rounded-lg shadow-md bg-card">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">Welcome</h1>
        <p className="text-muted-foreground">
          Sign in to continue to Proposal Writer
        </p>
      </div>

      {error && (
        <div className="p-3 text-sm border rounded-md bg-destructive/10 border-destructive text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="flex items-center justify-center w-full gap-2 px-4 py-2 font-medium text-gray-900 transition-colors bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-gray-600 rounded-full border-t-transparent animate-spin" />
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 488 512"
                className="w-5 h-5"
                fill="currentColor"
              >
                <path d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z" />
              </svg>
              <span>Sign in with Google</span>
            </>
          )}
        </button>
      </div>

      <div className="mt-4 text-sm text-center text-muted-foreground">
        By continuing, you agree to our Terms of Service and Privacy Policy.
      </div>
    </div>
  );
}
