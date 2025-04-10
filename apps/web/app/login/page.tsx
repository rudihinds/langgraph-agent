"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { signIn } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Info } from "lucide-react";

// Map error codes to user-friendly messages
const ERROR_MESSAGES: Record<string, string> = {
  missing_code: "Authentication failed: No authorization code received",
  no_session: "Authentication failed: Unable to establish a session",
  server_error: "A server error occurred. Please try again later.",
  auth_error: "Authentication failed. Please try again.",
  recovery:
    "Previous session data was cleared due to sync issues. Please sign in again.",
};

function LoginContent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check for error param in URL
    const errorParam = searchParams.get("error");
    const recovery = searchParams.get("recovery");
    const redirect = searchParams.get("redirect");

    if (errorParam) {
      console.log("[Login] Error from URL parameter:", errorParam);
      setError(errorParam);
    }

    if (recovery === "true") {
      console.log("[Login] Recovery mode detected");
      setRecoveryMode(true);
      setError("recovery");
    }

    if (redirect) {
      console.log("[Login] Redirect path detected:", redirect);
      setRedirectPath(redirect);
      // Store in localStorage for post-login redirect
      if (typeof window !== "undefined") {
        localStorage.setItem("redirectAfterLogin", redirect);
      }
    }

    // Check if already authenticated and no recovery needed
    if (typeof window !== "undefined") {
      // If we find a valid auth cookie and we're not in recovery mode
      const hasAuthCookie =
        document.cookie.includes("auth-token") ||
        document.cookie.includes("sb-") ||
        document.cookie.includes("auth-session-established");

      if (hasAuthCookie && recovery !== "true" && !errorParam) {
        console.log("[Login] Already authenticated, redirecting to dashboard");
        router.push("/dashboard");
      }
    }
  }, [searchParams, router]);

  const handleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("[Login] Starting sign-in process");

      // Clear any existing auth cookies/storage for clean test
      if (typeof window !== "undefined") {
        console.log("[Login] Clearing any existing auth data for clean test");
        localStorage.removeItem("auth_start_time");

        // Record redirect path if we have one
        if (redirectPath) {
          localStorage.setItem("redirectAfterLogin", redirectPath);
        }
      }

      await signIn();
    } catch (err: any) {
      console.error("[Login] Sign-in error:", err.message);
      setError(err.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md p-8 space-y-8 bg-card border rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Login</h1>
          <p className="mt-2 text-muted-foreground">
            Sign in to access your dashboard
          </p>
        </div>

        {recoveryMode && (
          <Alert
            variant="warning"
            className="bg-amber-50 dark:bg-amber-950 border-amber-300"
          >
            <Info className="h-4 w-4" />
            <AlertTitle>Recovery mode</AlertTitle>
            <AlertDescription>
              Previous session data was cleared due to sync issues. Please sign
              in again.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Authentication Error</AlertTitle>
            <AlertDescription>
              {ERROR_MESSAGES[error] || error}
            </AlertDescription>
          </Alert>
        )}

        {redirectPath && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              You'll be redirected back to{" "}
              <code className="text-xs bg-muted p-1 rounded">
                {redirectPath}
              </code>{" "}
              after sign in.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <Button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? "Signing in..." : "Sign in with Google"}
          </Button>
        </div>

        <div className="mt-6 text-sm text-center text-muted-foreground">
          <p>Don't have an account? Sign-in will create one automatically.</p>
          <p className="mt-2">
            <Link href="/" className="font-medium text-primary hover:underline">
              Back to Home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <div className="w-full max-w-md p-8 space-y-8 bg-card border rounded-lg shadow-md">
            <div className="text-center">
              <h1 className="text-3xl font-bold">Login</h1>
              <p className="mt-2 text-muted-foreground">Loading...</p>
            </div>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
