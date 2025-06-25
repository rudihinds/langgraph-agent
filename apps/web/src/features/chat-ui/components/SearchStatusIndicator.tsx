/**
 * SearchStatusIndicator Component
 * 
 * Displays real-time status messages during intelligence gathering searches.
 * Shows what the system is currently doing (e.g., "Looking into company initiatives...")
 * in a visually distinct way from regular chat messages.
 */

import { cn } from "@/lib/utils/utils";

interface SearchStatusIndicatorProps {
  status: string | null;
  className?: string;
}

export function SearchStatusIndicator({ status, className }: SearchStatusIndicatorProps) {
  if (!status) return null;
  
  return (
    <div 
      className={cn(
        "flex items-center gap-3 px-4 py-3 mb-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800",
        "animate-in fade-in-0 slide-in-from-bottom-2 duration-300",
        className
      )}
    >
      {/* Animated dots indicator */}
      <div className="flex gap-1">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
      </div>
      
      {/* Status message */}
      <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
        {status}
      </span>
    </div>
  );
}

/**
 * Alternative minimal status indicator for inline use
 */
export function InlineStatusIndicator({ status }: { status: string | null }) {
  if (!status) return null;
  
  return (
    <div className="inline-flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse" />
      <span>{status}</span>
    </div>
  );
}