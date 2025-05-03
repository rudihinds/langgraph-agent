// Remove 'use client' directive if present

// Keep these imports for server-side logic
import { ReactNode } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Remove imports related to client-side providers (QueryClientProvider, DashboardProvider, DashboardLayoutContent)

// Keep the ClientDashboardLayout import
import ClientDashboardLayout from "@/features/layout/components/ClientDashboardLayout";

/**
 * Server Component that wraps dashboard pages
 * Provides additional authentication protection at the server level
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Server-side authentication check
  const cookieStore = cookies();
  const supabase = await createClient(cookieStore);

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  console.log("[Server] Dashboard layout - session check:", !!session);

  if (!session) {
    console.log("[Server] No session found, redirecting to login");
    redirect("/login?from=dashboard-layout");
  }

  // If we have a session, render the ClientDashboardLayout component
  // Pass children to it. The client providers will be inside ClientDashboardLayout.
  return <ClientDashboardLayout>{children}</ClientDashboardLayout>;
}
