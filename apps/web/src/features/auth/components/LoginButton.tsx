"use client";

import { useState } from "react";
import { Button } from "@/features/ui/components/button";

export default function LoginButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      console.log("[Login] Starting login process");
      setIsLoading(true);
      setError(null);

      // Call the API route with better error handling
      const response = await fetch("/api/auth/login", {
        method: "GET",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      if (!response.ok) {
        console.error(`[Login] API error: ${response.status}`);
        throw new Error(`Login API returned status ${response.status}`);
      }

      const data = await response.json();
      console.log("[Login] API response received");

      // Check if the URL is returned
      if (data.url) {
        console.log("[Login] Redirecting to OAuth URL");
        window.location.href = data.url;
      } else {
        console.error("[Login] No URL returned from login API", data);
        setError(data.error || "Failed to get login URL");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("[Login] Error initiating login:", error);
      setError(
        typeof error === "object" && error !== null && "message" in error
          ? (error as Error).message
          : "Failed to start login process"
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <Button
        onClick={handleLogin}
        disabled={isLoading}
        size="lg"
        className="px-8 py-6 text-lg"
      >
        {isLoading ? "Loading..." : "Sign in with Google"}
      </Button>

      {error && <p className="mt-2 text-sm text-red-600">Error: {error}</p>}
    </div>
  );
}
