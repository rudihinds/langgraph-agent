import { ToolCall } from "@langchain/core/messages/tool";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export function ToolCallTable({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const hasArgs = toolCall.args && Object.keys(toolCall.args).length > 0;
  const hasOutput = !!toolCall.output;

  return (
    <div className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm">
      <div className="flex flex-row items-center justify-between">
        <div className="font-medium">{toolCall.name}</div>
        {(hasArgs || hasOutput) && (
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="flex flex-row items-center gap-1 text-xs text-gray-500 transition-colors hover:text-gray-700"
          >
            {expanded ? (
              <>
                <span>Hide Details</span>
                <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                <span>Show Details</span>
                <ChevronDown className="h-3 w-3" />
              </>
            )}
          </button>
        )}
      </div>
      {expanded && (hasArgs || hasOutput) && (
        <div className="flex flex-col gap-2 pt-2">
          {hasArgs && (
            <div className="flex flex-col gap-1">
              <div className="text-xs font-medium text-gray-500">Arguments</div>
              <div
                className={cn(
                  "w-full overflow-auto rounded bg-gray-50 p-2 text-xs",
                  "font-mono max-h-32"
                )}
              >
                <pre className="whitespace-pre-wrap break-words">
                  {JSON.stringify(toolCall.args, null, 2)}
                </pre>
              </div>
            </div>
          )}
          {hasOutput && (
            <div className="flex flex-col gap-1">
              <Separator />
              <div className="text-xs font-medium text-gray-500">Output</div>
              <div
                className={cn(
                  "w-full overflow-auto rounded bg-gray-50 p-2 text-xs",
                  "font-mono max-h-32"
                )}
              >
                <pre className="whitespace-pre-wrap break-words">
                  {typeof toolCall.output === "string"
                    ? toolCall.output
                    : JSON.stringify(toolCall.output, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
