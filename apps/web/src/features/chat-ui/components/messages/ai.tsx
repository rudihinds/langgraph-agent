import { useStreamContext } from "@/features/chat-ui/providers/Stream";
import { Message, Metadata } from "@langchain/langgraph-sdk";
import { ToolCall } from "@langchain/core/messages/tool";
import { cn } from "@/lib/utils";
import { MarkdownText } from "../markdown-text";
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
  const meta: Metadata | undefined = thread.getMessagesMetadata(message);
  const parentCheckpoint = meta?.firstSeenState?.parent_checkpoint;
  const contentString = getContentString(message.content);

  const handleRegenerate = () => {
    if (!parentCheckpoint) return;

    thread.submit(
      { messages: [message] },
      {
        checkpoint: parentCheckpoint,
        streamMode: ["values"],
        optimisticValues: (prev) => {
          const values = meta?.firstSeenState?.values;
          if (!values) return prev;
          return {
            ...values,
            messages: [...(values.messages ?? []), message],
          };
        },
      }
    );
  };

  const toolCalls = message.tool_calls as ToolCall[] | undefined;
  const isToolCalls = toolCalls?.length ?? 0 > 0;

  return (
    <div className="group flex flex-col gap-2">
      <div className="mr-auto flex max-w-xl flex-col gap-2 rounded-3xl bg-gray-100 p-4 text-black">
        <MarkdownText>{contentString}</MarkdownText>
        {isToolCalls && <ToolCalls toolCalls={toolCalls!} />}
      </div>

      <div
        className={cn(
          "mr-auto flex items-center gap-2 transition-opacity",
          "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
        )}
      >
        <BranchSwitcher
          branch={meta?.branch}
          branchOptions={meta?.branchOptions}
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
