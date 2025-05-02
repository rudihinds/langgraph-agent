import { v4 as uuidv4 } from "uuid";
import { ReactNode, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useStreamContext } from "../providers/StreamProvider";
import { cn } from "@/lib/utils/utils";
import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Checkpoint, Message } from "@langchain/langgraph-sdk";
import { AIMessage } from "./messages/ai";
import { HumanMessage } from "./messages/human";
import { ensureToolCallsHaveResponses } from "@/lib/ensure-tool-responses";
import { isAgentInboxInterruptSchema } from "@/lib/agent-inbox-interrupt";
import { AgentInbox } from "./agent-inbox";
import { useInterrupt } from "../providers/InterruptProvider";
import { Textarea } from "@/components/ui/textarea";
import { useStickToBottom } from "use-stick-to-bottom";
import { LayoutGrid } from "lucide-react";
import useResizeObserver from "use-resize-observer";

const NoMessagesView = () => (
  <div className="my-4 px-4 py-12 flex flex-col items-center w-full max-w-2xl gap-4 mx-auto">
    <div className="w-12 h-12 rounded-full border border-slate-300 flex items-center justify-center">
      <LayoutGrid className="h-6 w-6 text-slate-400" />
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
}

const ChatMessage = ({ message, isLoading }: ChatMessageProps) => {
  if (message.type === "human") {
    return <HumanMessage message={message} isLoading={isLoading} />;
  } else if (message.type === "ai") {
    return <AIMessage message={message} isLoading={isLoading} />;
  } else if (message.type === "tool") {
    return null; // Tool messages are rendered as part of AI messages
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

type StreamContextType = {
  messages?: Message[];
  threadId?: string;
  checkpoint?: Checkpoint;
  isStreaming?: boolean;
  addMessage?: (content: string) => Promise<void>;
  stream?: any;
  stateValue?: Record<string, unknown>;
  patchCheckpoint?: (patch: any) => Promise<void>;
  clearCache?: () => void;
  urlThreadId?: string;
  setUrlThreadId?: (id: string) => void;
  client?: any;
  deploymentUrl?: string;
  assistantId?: string;
};

export function Thread() {
  const {
    messages = [],
    threadId = "",
    checkpoint,
    isStreaming = false,
    addMessage,
    stream,
    stateValue = {},
    patchCheckpoint,
    clearCache,
    urlThreadId,
    setUrlThreadId,
    client,
    deploymentUrl = "",
    assistantId,
  } = useStreamContext() as StreamContextType;

  const { isInterrupted, handleInterrupt } = useInterrupt();

  const [inputValue, setInputValue] = useState("");
  const [lastHumanMessageRef, setLastHumanMessageRef] =
    useState<Message | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Handle interrupts
  useEffect(() => {
    if (!stateValue) return;

    // Check for interrupt in state and handle it
    const interrupt =
      (stateValue as any)?.config_interrupts ||
      (stateValue as any)?.interrupts ||
      null;

    if (interrupt && !isInterrupted) {
      console.log("Interrupt detected:", interrupt);
      // Pass to interrupt handler
      handleInterrupt(interrupt);
    }
  }, [stateValue, isInterrupted, handleInterrupt]);

  // Make sure we stay scrolled to the bottom
  const containerRef = useRef<HTMLDivElement>(null);
  const { ref } = useResizeObserver<HTMLDivElement>();

  // Process messages to ensure all tool calls have responses
  const messagesWithToolResponses = ensureToolCallsHaveResponses(
    messages || []
  );

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();

    if (!inputValue.trim() || !addMessage) return;

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
    <div
      className="relative flex flex-col w-full h-full bg-background"
      ref={ref}
    >
      <div
        ref={containerRef}
        className={cn(
          "scrollbar-pretty flex-1 overflow-y-auto overscroll-contain",
          "pt-4 pb-0"
        )}
      >
        {!messages || messages.length === 0 ? (
          <NoMessagesView />
        ) : (
          <div className="flex flex-col gap-8 px-4 pb-4 max-w-4xl mx-auto w-full">
            {messagesWithToolResponses.map((message, idx) => (
              <ChatMessage
                key={message.id || `msg-${idx}`}
                message={message}
                isLoading={
                  isStreaming &&
                  idx === messagesWithToolResponses.length - 1 &&
                  message.type === "ai"
                }
              />
            ))}
          </div>
        )}
      </div>

      {isInterrupted && stateValue && (
        <AgentInbox
          interrupts={[
            (stateValue as any).interrupts ||
              (stateValue as any).config_interrupts,
          ]
            .flat()
            .filter(Boolean)}
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
          state={stateValue as Record<string, unknown>}
        />
      )}

      <div
        className={cn(
          "sticky bottom-0 z-10 w-full",
          "border-t border-border/50 bg-background/80 backdrop-blur"
        )}
      >
        <div className="mx-auto max-w-4xl px-4 py-3">
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
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
                "min-h-12 max-h-32 resize-none bg-background",
                "border-input"
              )}
            />
            <div className="flex w-full justify-end">
              <Button
                type="submit"
                disabled={
                  !inputValue.trim() ||
                  isStreaming ||
                  isInterrupted ||
                  !addMessage
                }
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
