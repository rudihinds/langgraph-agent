"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/features/ui/components/button";
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/features/ui/components/card";
import { cn } from "@/lib/utils/utils";

interface EnhancedFormBannerProps {
  className?: string;
}

export function EnhancedFormBanner({ className }: EnhancedFormBannerProps) {
  return (
    <Card
      className={cn(
        "bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 dark:from-blue-950/30 dark:to-purple-950/30 dark:border-blue-800/50",
        className
      )}
    >
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-full">
            <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-medium text-blue-800 dark:text-blue-300">
              Try our enhanced upload experience!
            </h3>
            <p className="text-sm text-blue-600/80 dark:text-blue-400/80">
              Real-time validation, visual progress tracking, and better
              feedback
            </p>
          </div>
        </div>
        <Link href="/proposals/create-enhanced" passHref>
          <Button
            variant="outline"
            className="border-blue-300 bg-white hover:bg-blue-50 dark:bg-blue-950/50 dark:border-blue-700 dark:hover:bg-blue-900/50"
          >
            Try Enhanced Form
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
