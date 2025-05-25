"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/hooks/useSession";
import Link from "next/link";
import { Button } from "@/features/ui/components/button";

export default function DashboardTestPage() {
  const { user, isLoading } = useSession();
  const [status, setStatus] = useState<string>("Loading...");

  useEffect(() => {
    if (isLoading) {
      setStatus("Loading session...");
    } else if (user) {
      setStatus(`Authenticated as: ${user.email}`);
    } else {
      setStatus("Not authenticated");
    }
  }, [user, isLoading]);

  return (
    <div className="container px-4 py-6 mx-auto">
      <h1 className="text-3xl font-bold tracking-tight mb-4">
        Dashboard Test Page
      </h1>

      <div className="p-6 border rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-2">Authentication Status</h2>
        <p className="mb-4">{status}</p>

        {user && (
          <div className="p-4 bg-green-100 dark:bg-green-900 rounded-lg">
            <h3 className="font-medium">User Info:</h3>
            <pre className="mt-2 p-2 bg-white dark:bg-gray-800 rounded overflow-auto text-xs">
              {JSON.stringify(user, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <div className="flex gap-4">
        <Link href="/">
          <Button variant="outline">Back to Home</Button>
        </Link>

        <Link href="/dashboard">
          <Button>Go to Full Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
