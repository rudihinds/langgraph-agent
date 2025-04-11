import { ReactNode } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ClientDashboardLayout from "@/components/layout/ClientDashboardLayout";

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
  // Make sure to await the client creation
  const supabase = await createClient(cookieStore);

  // Get the session server-side
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  console.log("[Server] Dashboard layout - session check:", !!session);

  // If no session, redirect to login
  if (!session) {
    console.log("[Server] No session found, redirecting to login");
    redirect("/login?from=dashboard-layout");
  }

  // If we have a session, render the dashboard layout
  // Use a separate client component for the dashboard layout UI
  return <ClientDashboardLayout>{children}</ClientDashboardLayout>;
}
