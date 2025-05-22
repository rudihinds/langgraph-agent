"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DashboardLayoutProvider } from "./DashboardLayoutContext";
import DashboardLayout from "./DashboardLayout";
import { ThreadProvider } from "@/features/chat-ui/providers/ThreadProvider";

/**
 * Client-side dashboard layout component that wraps the children
 * with the DashboardLayoutProvider and DashboardLayout.
 * It also conditionally wraps with ThreadProvider for chat-related routes.
 */
export default function ClientDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

  // Determine if it's a chat-related page that needs ThreadProvider for the sidebar
  const chatPaths = ["/dashboard/chat"]; // Define chat paths
  const needsThreadProviderForSidebar = chatPaths.some(
    (path) => pathname === path || pathname?.startsWith(`${path}/`)
  );

  const layout = (
    <DashboardLayoutProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </DashboardLayoutProvider>
  );

  if (needsThreadProviderForSidebar) {
    return <ThreadProvider>{layout}</ThreadProvider>;
  }

  return layout;
}
