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

  // DEBUG: Temporarily simplify dashboard route detection and add logging
  console.log("[DashboardContext] Current pathname:", pathname);

  // For debugging: hardcode to false to disable dashboard layouts
  const isDashboardRoute = false;

  // Original logic (commented for debugging)
  /*
  const isDashboardRoute =
    pathname?.startsWith("/dashboard") ||
    pathname?.startsWith("/proposals") ||
    pathname?.startsWith("/settings");
  */

  console.log("[DashboardContext] isDashboardRoute:", isDashboardRoute);

  return (
    <DashboardLayoutContext.Provider
      value={{ isDashboardRoute: !!isDashboardRoute }}
    >
      {children}
    </DashboardLayoutContext.Provider>
  );
}
