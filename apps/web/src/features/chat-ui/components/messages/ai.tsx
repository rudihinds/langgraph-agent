import { useStreamContext } from "@/features/chat-ui/providers/StreamProvider";
import { Message, Metadata } from "@langchain/langgraph-sdk";
import { ToolCall } from "@langchain/core/messages/tool";
import { cn } from "@/lib/utils/utils";
import { MarkdownText } from "@/features/thread/components/markdown-text";
import { BranchSwitcher, CommandBar } from "./shared";
import { getContentString } from "../../utils/message-utils";
import { ToolCalls } from "./tool-calls";

export function AIMessage({
  message,
  isLoading,
}: {
  message: Message;
  isLoading: boolean;
}) {
  const thread = useStreamContext();
  const meta = undefined;
  const parentCheckpoint = undefined;
  const contentString = getContentString(message.content);

  console.log(
    `[AIMessage] Rendering contentString:`,
    JSON.stringify(contentString)
  );

  const handleRegenerate = () => {
    if (!parentCheckpoint) return;

    thread.submit(
      { messages: [message] },
      {
        checkpoint: parentCheckpoint,
        streamMode: ["values"],
        optimisticValues: (prev: any) => {
          return prev;
        },
      }
    );
  };

  const toolCalls = (message as any).tool_calls as ToolCall[] | undefined;
  const isToolCalls = toolCalls?.length ?? 0 > 0;

  return (
    <div className="flex flex-col gap-2 group">
      <div className="flex flex-col max-w-xl gap-2 p-4 mr-auto text-black bg-gray-100 rounded-3xl">
        <MarkdownText>{contentString}</MarkdownText>
        {isToolCalls ? <ToolCalls toolCalls={toolCalls!} /> : null}
      </div>

      <div
        className={cn(
          "mr-auto flex items-center gap-2 transition-opacity",
          "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
        )}
      >
        <BranchSwitcher
          branch={undefined}
          branchOptions={undefined}
          onSelect={(branch) => thread.setBranch(branch)}
          isLoading={isLoading}
        />
        <CommandBar
          isLoading={isLoading}
          content={contentString}
          handleRegenerate={handleRegenerate}
          isAiMessage={true}
        />
      </div>
    </div>
  );
}
