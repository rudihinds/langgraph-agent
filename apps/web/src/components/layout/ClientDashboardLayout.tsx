"use client";

import { ReactNode } from "react";
import { DashboardLayoutProvider } from "./DashboardLayoutContext";
import DashboardLayout from "./DashboardLayout";

/**
 * Client-side dashboard layout component that wraps the children
 * with the DashboardLayoutProvider and DashboardLayout
 */
export default function ClientDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <DashboardLayoutProvider>
      <DashboardLayout>
        {children}
      </DashboardLayout>
    </DashboardLayoutProvider>
  );
}