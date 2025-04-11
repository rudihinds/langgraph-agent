"use client";

import { useSession } from "@/hooks/useSession";
import { useDashboardLayout } from "./DashboardLayoutContext";
import Header from "./Header";
import React from "react";

export default function HeaderWrapper() {
  const { user, isLoading, refreshSession } = useSession();
  const { isDashboardRoute } = useDashboardLayout();

  // Refresh session on component mount to ensure we have latest user data
  React.useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  // Don't show header on dashboard routes
  if (isDashboardRoute) {
    return null;
  }

  // Pass the user to the Header component
  // During loading state, we'll pass null which the Header can handle
  return <Header user={isLoading ? null : user} />;
}
