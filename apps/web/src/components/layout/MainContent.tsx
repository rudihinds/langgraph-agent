"use client";

import { ReactNode } from "react";
import { useDashboardLayout } from "./DashboardLayoutContext";
import HeaderWrapper from "./HeaderWrapper";

interface MainContentProps {
  children: ReactNode;
}

export default function MainContent({ children }: MainContentProps) {
  const { isDashboardRoute } = useDashboardLayout();

  return (
    <div className="min-h-screen flex flex-col">
      <HeaderWrapper />
      <main className={`flex-1 ${!isDashboardRoute ? "pt-16" : ""}`}>
        {children}
      </main>
      {!isDashboardRoute && (
        <footer className="w-full border-t py-4">
          <div className="max-w-5xl mx-auto px-4 text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Proposal Writer
          </div>
        </footer>
      )}
    </div>
  );
}
