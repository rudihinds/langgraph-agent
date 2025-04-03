"use client";

import { useSession } from "@/hooks/useSession";
import { useDashboardLayout } from "./DashboardLayoutContext";
import Header from "./Header";

export default function HeaderWrapper() {
  const { user, isLoading } = useSession();
  const { isDashboardRoute } = useDashboardLayout();

  // Don't show header on dashboard routes
  if (isDashboardRoute) {
    return null;
  }

  // We always want to render the header on non-dashboard routes, even during loading state
  // The Header component will adapt based on the authentication state
  return <Header user={isLoading ? null : user} />;
}
