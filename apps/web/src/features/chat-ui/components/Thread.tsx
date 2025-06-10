import { v4 as uuidv4 } from "uuid";
import { ReactNode, useRef, useEffect } from "react";
import { useStreamContext } from "../providers/StreamProvider";
import { cn } from "@/lib/utils/utils";
import { useState, FormEvent } from "react";
import { Button } from "@/features/ui/components/button";
import { Message } from "@langchain/langgraph-sdk";
import { AIMessage } from "./messages/ai";
import { HumanMessage } from "./messages/human";
import { Textarea } from "@/features/ui/components/textarea";
import { LayoutGrid, FileText } from "lucide-react";
import { toast } from "sonner";
import { useAgentActivity } from "../hooks/useAgentActivity";
import { AgentLoadingState } from "./AgentLoadingState";

interface NoMessagesViewProps {
  rfpId?: string | null;
  isAgentWorking?: boolean;
}

const NoMessagesView = ({ rfpId, isAgentWorking }: NoMessagesViewProps) => {
  // Show agent working state when auto-start is happening
  if (rfpId && isAgentWorking) {
    return (
      <div className="flex flex-col items-center w-full max-w-2xl gap-4 px-4 py-12 mx-auto my-4">
        <div className="flex items-center justify-center w-12 h-12 border rounded-full border-slate-300">
          <FileText className="w-6 h-6 text-slate-400 animate-pulse" />
        </div>
        <div className="text-xl font-medium">Analyzing RFP Document</div>
        <div className="text-center text-slate-500">
          Starting analysis of your RFP document...
        </div>
      </div>
    );
  }

  // Default empty state
  return (
    <div className="flex flex-col items-center w-full max-w-2xl gap-4 px-4 py-12 mx-auto my-4">
      <div className="flex items-center justify-center w-12 h-12 border rounded-full border-slate-300">
        <LayoutGrid className="w-6 h-6 text-slate-400" />
      </div>
      <div className="text-xl font-medium">No messages yet</div>
      <div className="text-center text-slate-500">
        Start a conversation by typing a message below
      </div>
    </div>
  );
};

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

export function Thread() {
  // Use the streamContext directly from our provider
  const {
    messages = [],
    threadId = "",
    isLoading = false,
    submit,
    stop,
    values, // Get the complete graph state
  } = useStreamContext();

  // Extract RFP context from graph state
  const rfpId = values?.metadata?.rfpId;

  // Use generic agent activity detection
  const { isAgentWorking } = useAgentActivity(isLoading, messages);

  const [inputValue, setInputValue] = useState("");

  // Ref for the scrollable messages container
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // Ref for the outer container
  const outerContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Process messages to ensure all tool calls have responses
  // const messagesWithToolResponses = ensureToolCallsHaveResponses(
  //   messages || []
  // );

  // <<< ADD LOGGING HERE >>>
  // console.log(
  //   `[Thread] messagesWithToolResponses length before map: ${
  //     messagesWithToolResponses?.length ?? "undefined"
  //   }`
  // );

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();

    if (!inputValue.trim()) {
      return;
    }

    const messageContent = inputValue;
    setInputValue("");

    try {
      console.log("[Thread] Sending message:", messageContent);

      // Use the submit method from our context
      if (submit) {
        console.log("[Thread] Using submit to send message");

        // Pass message in the format expected by LangGraph
        await submit({
          messages: [
            {
              type: "human",
              content: messageContent,
              id: uuidv4(),
            },
          ],
        });
      } else {
        console.error("[Thread] No method available to send messages");
        toast.error("Failed to send message", {
          description:
            "The chat connection is not ready. Please refresh the page.",
        });
      }
    } catch (error) {
      console.error("[Thread] Error sending message:", error);
      toast.error("Failed to send message", {
        description:
          "There was an error communicating with the AI service. Please try again.",
      });
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
      ref={outerContainerRef}
    >
      <div
        ref={messagesContainerRef}
        className={cn(
          "scrollbar-pretty flex-1 overflow-y-auto overscroll-contain",
          "pt-4 pb-0"
        )}
      >
        {!messages || messages.length === 0 ? (
          <NoMessagesView rfpId={rfpId} isAgentWorking={isAgentWorking} />
        ) : (
          <div className="flex flex-col w-full max-w-4xl gap-8 px-4 pb-4 mx-auto">
            {(messages || []).map((message, idx) => {
              return (
                <ChatMessage
                  key={message.id || `msg-${idx}`}
                  message={message}
                  isLoading={
                    isLoading &&
                    idx === messages.length - 1 &&
                    message.type === "ai"
                  }
                />
              );
            })}

            {/* Show loading state at bottom when agent is working */}
            <AgentLoadingState
              isWorking={isAgentWorking}
              context={rfpId ? "rfp" : "general"}
              className="justify-center py-4"
            />
          </div>
        )}
      </div>

      <div
        className={cn(
          "sticky bottom-0 z-10 w-full",
          "border-t border-border/50 bg-background/80 backdrop-blur"
        )}
      >
        <div className="max-w-4xl px-4 py-2 mx-auto">
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <Textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading && (messages.length > 0 || !!threadId)}
              placeholder={
                isLoading && (messages.length > 0 || !!threadId)
                  ? "Waiting for response..."
                  : "Type a message..."
              }
              className={cn(
                "min-h-10 max-h-24 resize-none bg-background",
                "border-input"
              )}
            />
            <div className="flex justify-end w-full">
              <Button
                type="submit"
                size="sm"
                disabled={
                  (isLoading && (messages.length > 0 || !!threadId)) ||
                  !inputValue.trim() ||
                  !submit
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
