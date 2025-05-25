import { ToolCall } from "@langchain/core/messages/tool";
import { useState } from "react";
import { cn } from "@/lib/utils/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Separator } from "@/features/ui/components/separator";

export function ToolCalls({ toolCalls }: { toolCalls: ToolCall[] }) {
  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mt-2">
      <Separator />
      <div className="text-sm text-gray-500">Tool Calls:</div>
      {toolCalls.map((toolCall, index) => (
        <ToolCallItem key={toolCall.id || index} toolCall={toolCall} />
      ))}
    </div>
  );
}

function ToolCallItem({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const hasArgs = toolCall.args && Object.keys(toolCall.args).length > 0;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-md overflow-hidden">
      <div
        className={cn(
          "flex justify-between items-center p-2 cursor-pointer",
          hasArgs ? "hover:bg-gray-100" : "bg-gray-50"
        )}
        onClick={() => hasArgs && setExpanded(!expanded)}
      >
        <div className="font-mono text-sm">{toolCall.name}</div>
        {hasArgs && (
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>

      {expanded && hasArgs && (
        <div className="p-2 border-t border-gray-200 bg-white">
          <div className="font-mono text-xs whitespace-pre-wrap overflow-x-auto">
            {Object.entries(toolCall.args || {}).map(([key, value]) => (
              <div key={key} className="mb-1">
                <span className="text-gray-600">{key}:</span>{" "}
                <span className="text-gray-900">
                  {typeof value === "object"
                    ? JSON.stringify(value, null, 2)
                    : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
