"use client";

import { ReactNode } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";

interface DashboardPageLayoutProps {
  children: ReactNode;
}

export default function DashboardPageLayout({ children }: DashboardPageLayoutProps) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
