"use client";

import { createContext, useContext, ReactNode } from "react";
import { usePathname } from "next/navigation";

// Define the context type
type DashboardLayoutContextType = {
  isDashboardRoute: boolean;
};

const DashboardLayoutContext = createContext<DashboardLayoutContextType>({
  isDashboardRoute: false,
});

// Hook to use dashboard layout context
export function useDashboardLayout() {
  return useContext(DashboardLayoutContext);
}

// Provider component
export function DashboardLayoutProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Check if current route is a dashboard route
  const isDashboardRoute =
    pathname?.startsWith("/dashboard") ||
    pathname?.startsWith("/proposals") ||
    pathname?.startsWith("/settings");

  return (
    <DashboardLayoutContext.Provider
      value={{ isDashboardRoute: !!isDashboardRoute }}
    >
      {children}
    </DashboardLayoutContext.Provider>
  );
}
