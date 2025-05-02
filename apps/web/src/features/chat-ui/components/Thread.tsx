import { v4 as uuidv4 } from "uuid";
import { ReactNode, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useStreamContext } from "../providers/StreamProvider";
import { cn } from "@/lib/utils";
import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Checkpoint, Message } from "@langchain/langgraph-sdk";
import { AIMessage } from "./messages/ai";
import { HumanMessage } from "./messages/human";
import { ensureToolCallsHaveResponses } from "../lib/ensure-tool-responses";
import { isAgentInboxInterruptSchema } from "../lib/agent-inbox-interrupt";
import { AgentInbox } from "./agent-inbox";
import { useInterrupt } from "../providers/InterruptProvider";
import { Textarea } from "@/components/ui/textarea";
import { useStickToBottom } from "use-stick-to-bottom";
import { LayoutHorizontalIcon } from "lucide-react";
import useResizeObserver from "use-resize-observer";

const NoMessagesView = () => (
  <div className="my-4 px-4 py-12 flex flex-col items-center w-full max-w-2xl gap-4 mx-auto">
    <div className="w-12 h-12 rounded-full border border-slate-300 flex items-center justify-center">
      <LayoutHorizontalIcon className="h-6 w-6 text-slate-400" />
    </div>
    <div className="text-xl font-medium">No messages yet</div>
    <div className="text-slate-500 text-center">
      Start a conversation by typing a message below
    </div>
  </div>
);

interface ChatMessageProps {
  message: Message;
  isLoading: boolean;
  onHuman?: {
    onResend: (message: Message) => void;
    onEdit: (message: Message, newContent: string) => void;
    onDelete: (message: Message) => void;
  };
}

const ChatMessage = ({ message, isLoading, onHuman }: ChatMessageProps) => {
  if (message.type === "human") {
    return (
      <HumanMessage
        message={message}
        onResend={onHuman?.onResend}
        onEdit={onHuman?.onEdit}
        onDelete={onHuman?.onDelete}
      />
    );
  } else if (message.type === "ai") {
    return <AIMessage message={message} isLoading={isLoading} />;
  } else if (message.type === "tool") {
    return null; // Tool messages are currently rendered as part of AI messages
  }

  return null;
};

function hasUnhandledInterrupts(
  messages: Message[],
  messagesWithToolResponses: Message[]
) {
  // Check if there's a gap between messages and messagesWithToolResponses
  return (
    messagesWithToolResponses.length > 0 &&
    messagesWithToolResponses[messagesWithToolResponses.length - 1] !==
      messages[messages.length - 1]
  );
}

export function Thread() {
  const {
    messages,
    threadId,
    checkpoint,
    isStreaming,
    addMessage,
    stream,
    stateValue,
    patchCheckpoint,
    clearCache,
    urlThreadId,
    setUrlThreadId,
    client,
    deploymentUrl,
    assistantId,
  } = useStreamContext();

  const { isInterrupted, handleInterrupt } = useInterrupt();

  const [inputValue, setInputValue] = useState("");
  const [lastHumanMessageRef, setLastHumanMessageRef] =
    useState<Message | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const { height, ref } = useResizeObserver();

  // Handle interrupts
  useEffect(() => {
    if (!stateValue) return;

    // Check for interrupt in state and handle it
    const interrupt =
      stateValue?.config_interrupts || stateValue?.interrupts || null;

    if (interrupt && !isInterrupted) {
      if (isAgentInboxInterruptSchema(interrupt)) {
        console.log("Interrupt detected:", interrupt);
        // Pass to interrupt handler
        handleInterrupt(interrupt);
      }
    }
  }, [stateValue, isInterrupted, handleInterrupt]);

  // Make sure we stay scrolled to the bottom
  const containerRef = useRef<HTMLDivElement>(null);
  const { stickToBottom } = useStickToBottom(containerRef, {
    deps: [messages, isStreaming, isInterrupted],
  });

  // Process messages to ensure all tool calls have responses
  const messagesWithToolResponses = ensureToolCallsHaveResponses(messages);

  const handleResendMessage = (message: Message) => {
    // TODO: Implement resend functionality
    console.log("Resend message:", message);
  };

  const handleEditMessage = (message: Message, newContent: string) => {
    // TODO: Implement edit functionality
    console.log("Edit message:", message, "New content:", newContent);
  };

  const handleDeleteMessage = (message: Message) => {
    // TODO: Implement delete functionality
    console.log("Delete message:", message);
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();

    if (!inputValue.trim()) return;

    const messageContent = inputValue;
    setInputValue("");

    try {
      await addMessage(messageContent);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden" ref={ref}>
      <div
        ref={containerRef}
        className={cn(
          "scrollbar-pretty flex flex-1 flex-col overflow-y-auto overscroll-contain",
          "pt-4 pb-0 h-full"
        )}
        onScroll={(e) => {
          // Handle scroll events if needed
        }}
      >
        {messages.length === 0 ? (
          <NoMessagesView />
        ) : (
          <div className="flex flex-col gap-8 px-4 pb-4">
            {messagesWithToolResponses.map((message, idx) => (
              <ChatMessage
                key={message.id || `msg-${idx}`}
                message={message}
                isLoading={
                  isStreaming &&
                  idx === messagesWithToolResponses.length - 1 &&
                  message.type === "ai"
                }
                onHuman={{
                  onResend: handleResendMessage,
                  onEdit: handleEditMessage,
                  onDelete: handleDeleteMessage,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {isInterrupted && stateValue && (
        <AgentInbox
          interrupts={[
            stateValue.interrupts || stateValue.config_interrupts,
          ].flat()}
          onSubmit={(interrupt, response, type) => {
            console.log(
              "Submit interrupt response:",
              interrupt,
              response,
              type
            );
            // TODO: Implement interrupt response handling
          }}
          onDiscard={(interrupt) => {
            console.log("Discard interrupt:", interrupt);
            // TODO: Implement interrupt discard handling
          }}
          threadId={threadId || ""}
          deploymentUrl={deploymentUrl || ""}
          state={stateValue}
        />
      )}

      <div
        className={cn(
          "sticky bottom-0 z-10 w-full",
          "border-t border-border/50 bg-background/80 backdrop-blur"
        )}
      >
        <div className="mx-auto max-w-3xl">
          <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-2">
            <Textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming || isInterrupted}
              placeholder={
                isStreaming ? "Waiting for response..." : "Type a message..."
              }
              className={cn(
                "min-h-24 resize-none bg-background",
                "border-input"
              )}
            />
            <div className="flex w-full justify-end">
              <Button
                type="submit"
                disabled={!inputValue.trim() || isStreaming || isInterrupted}
              >
                Send
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
