"use client";

import { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckItemProps {
  children: ReactNode;
  className?: string;
}

export function CheckItem({ children, className }: CheckItemProps) {
  return (
    <li className={cn("flex items-start", className)}>
      <CheckCircle2 className="h-4 w-4 text-green-500 mr-2.5 mt-0.5 flex-shrink-0" />
      <span>{children}</span>
    </li>
  );
}