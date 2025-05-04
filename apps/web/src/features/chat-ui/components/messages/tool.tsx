import { Message } from "@langchain/langgraph-sdk";
import { cn } from "@/lib/utils";

interface ToolMessageComponentProps {
  message: Message;
}

export function ToolMessageComponent({ message }: ToolMessageComponentProps) {
  if (message.type !== "tool") {
    return null;
  }

  const contentString =
    typeof message.content === "string"
      ? message.content
      : JSON.stringify(message.content, null, 2);

  return (
    <div
      className={cn(
        "flex flex-col items-center w-full max-w-3xl gap-2 px-4 py-2 mx-auto my-2",
        "bg-gray-50 border border-gray-200 rounded-lg shadow-sm"
      )}
    >
      <div className="text-xs font-medium tracking-wider text-gray-500 uppercase">
        Tool Result ({message.name || "unknown"})
      </div>
      <div className="w-full p-2 overflow-x-auto text-sm text-gray-700 whitespace-pre-wrap bg-white border border-gray-100 rounded">
        {contentString}
      </div>
    </div>
  );
}
