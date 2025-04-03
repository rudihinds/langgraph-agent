// app/auth-test/page.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

export default function AuthTest() {
  const [sessionStatus, setSessionStatus] = useState<string>("Checking...");
  const [currentHash, setCurrentHash] = useState<string>("");

  // Add this to your auth-test page
  const handleSignOut = async () => {
    try {
      setSessionStatus("Signing out...");
      const supabase = createClient();
      await supabase.auth.signOut();
      setSessionStatus("Signed out");
    } catch (error) {
      setSessionStatus("Error signing out");
      console.error(error);
    }
  };

  // Check for session and window objects
  useEffect(() => {
    // Set the hash if we're in the browser
    if (typeof window !== "undefined") {
      setCurrentHash(window.location.hash);
    }

    const checkSession = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        setSessionStatus(data.session ? "Logged in" : "No session");
      } catch (error) {
        setSessionStatus("Error checking session");
        console.error(error);
      }
    };

    checkSession();
  }, []);

  // Test function to handle a hash
  const handleTestHash = async () => {
    if (typeof window === "undefined") return;

    // If there's a real hash, use it
    if (window.location.hash && window.location.hash.includes("access_token")) {
      console.log("Processing real hash");
      await processHash(window.location.hash);
    } else {
      console.log("No hash found to process");
      setSessionStatus("No hash to process");
    }
  };

  const processHash = async (hash: string) => {
    try {
      setSessionStatus("Processing hash...");

      // Extract tokens
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (!accessToken) {
        setSessionStatus("No access token in hash");
        return;
      }

      // Set up session
      const supabase = createClient();
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || "",
      });

      if (error) {
        setSessionStatus("Error setting session: " + error.message);
        console.error("Session error:", error);
      } else if (data.session) {
        setSessionStatus("Session established!");
        console.log("Session created:", data.session);
      }
    } catch (err) {
      setSessionStatus(
        "Error: " + (err instanceof Error ? err.message : String(err))
      );
      console.error("Process hash error:", err);
    }
  };

  return (
    <div className="max-w-md p-8 mx-auto">
      <h1 className="mb-4 text-2xl font-bold">Auth Test Page</h1>
      <div className="p-4 mb-4 bg-gray-100 rounded">
        <h2 className="font-semibold">Current Session Status:</h2>
        <p className="mt-2">{sessionStatus}</p>
        {currentHash && (
          <div className="mt-2">
            <p className="text-sm font-medium">URL Hash:</p>
            <p className="overflow-hidden text-sm text-ellipsis">
              {currentHash}
            </p>
          </div>
        )}
      </div>
      <button
        onClick={handleTestHash}
        className="px-4 py-2 text-white bg-blue-500 rounded"
      >
        Process Auth Hash
      </button>
      <button
        onClick={handleSignOut}
        className="px-4 py-2 ml-4 text-white bg-red-500 rounded"
      >
        Sign Out
      </button>
    </div>
  );
}
