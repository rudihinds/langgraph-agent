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
import { BaseInterruptPayload } from "../providers/StreamProvider";

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
    interrupt, // Get interrupt state for HITL handling
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

      // Check if we're responding to an interrupt
      if (isInterrupted) {
        console.log("[Thread] Responding to interrupt with natural language");
        await handleInterruptResume(messageContent);
        return;
      }

      // Use the submit method from our context for normal messages
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

  // Handle interrupt resume with natural language - user types response normally
  const handleInterruptResume = async (naturalLanguageResponse: string) => {
    if (!submit) {
      toast.error("Unable to respond to interrupt");
      return;
    }

    try {
      console.log("[Thread] Resuming interrupt with natural language response:", naturalLanguageResponse);
      console.log("[Thread] Current interrupt state:", interrupt);
      
      // Use LangGraph SDK resume pattern - pass undefined as first param, command in options
      await submit(undefined, { 
        command: { 
          resume: naturalLanguageResponse 
        } 
      });
      
      console.log("[Thread] Resume command submitted successfully");
    } catch (error) {
      console.error("Error handling interrupt resume:", error);
      toast.error("Failed to respond to interrupt");
    }
  };

  // Check if there's an active interrupt
  const isInterrupted = !!interrupt;

  return (
    <div
      className="relative flex flex-col w-full h-full min-h-0 bg-background"
      ref={outerContainerRef}
    >
      <div
        ref={messagesContainerRef}
        className={cn(
          "scrollbar-pretty flex-1 overflow-y-auto overscroll-contain min-h-0",
          "pt-4 pb-4"
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

            {/* Show interrupt information in conversation flow */}
            {isInterrupted && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-2 h-2 mt-2 bg-blue-400 rounded-full animate-pulse"></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-blue-900 mb-1">
                      Review Required
                    </div>
                    <div className="text-sm text-blue-700">
                      {typeof interrupt === 'string' 
                        ? interrupt 
                        : (interrupt as BaseInterruptPayload)?.question || 'Please provide your feedback in the message box below.'
                      }
                    </div>
                    {typeof interrupt !== 'string' && (interrupt as BaseInterruptPayload)?.options && (
                      <div className="mt-2 text-xs text-blue-600">
                        Options: {(interrupt as BaseInterruptPayload).options.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div
        className={cn(
          "flex-shrink-0 w-full",
          "border-t border-border/50 bg-background"
        )}
      >
        <div className="max-w-4xl px-4 py-3 mx-auto">
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <Textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading && (messages.length > 0 || !!threadId) && !isInterrupted}
              placeholder={
                isInterrupted
                  ? "Type your response (e.g., 'looks good', 'what are the main risks?', 'modify the opportunities section', 'reject')..."
                  : isLoading && (messages.length > 0 || !!threadId)
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
                  (isLoading && (messages.length > 0 || !!threadId) && !isInterrupted) ||
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
