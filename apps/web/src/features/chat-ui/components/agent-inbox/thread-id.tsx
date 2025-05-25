import { useState } from "react";
import { ClipboardCheck, ClipboardCopy } from "lucide-react";
import { Button } from "@/features/ui/components/button";
import { cn } from "@/lib/utils/utils";

interface ThreadIdProps {
  threadId: string;
  className?: string;
}

export function ThreadId({ threadId, className }: ThreadIdProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(threadId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "flex flex-row items-center gap-1 rounded-md border border-gray-200 bg-gray-50 py-1 px-2 text-xs",
        className
      )}
    >
      <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
        {threadId}
      </div>
      <Button
        onClick={handleCopy}
        variant="ghost"
        className="h-6 w-6 p-0"
        aria-label={copied ? "Copied" : "Copy"}
      >
        {copied ? (
          <ClipboardCheck className="h-4 w-4 text-green-600" />
        ) : (
          <ClipboardCopy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
