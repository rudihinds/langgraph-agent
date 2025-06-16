import { Button } from "@/features/ui/components/button";
import { useThreads } from "../providers/ThreadProvider";
import { Thread } from "@langchain/langgraph-sdk";
import { useEffect, useState } from "react";

import { getContentString } from "../utils/message-utils";
import { useQueryState, parseAsBoolean } from "nuqs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/features/ui/components/sheet";
import { Skeleton } from "@/features/ui/components/skeleton";
import { PanelRightOpen, PanelRightClose, MessageCircle, Pause, CheckCircle, AlertCircle } from "lucide-react";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { cn } from "@/lib/utils/utils";

// Thread status helper function
function getThreadStatus(thread: Thread): {
  status: 'active' | 'paused' | 'idle' | 'error' | 'unknown';
  icon: React.ReactNode;
  color: string;
} {
  const status = thread.status;
  
  switch (status) {
    case 'busy':
      return {
        status: 'active',
        icon: <MessageCircle className="h-3 w-3" />,
        color: 'text-blue-500'
      };
    case 'interrupted':
      return {
        status: 'paused',
        icon: <Pause className="h-3 w-3" />,
        color: 'text-yellow-500'
      };
    case 'idle':
      return {
        status: 'idle',
        icon: <CheckCircle className="h-3 w-3" />,
        color: 'text-green-500'
      };
    case 'error':
      return {
        status: 'error',
        icon: <AlertCircle className="h-3 w-3" />,
        color: 'text-red-500'
      };
    default:
      return {
        status: 'unknown',
        icon: <MessageCircle className="h-3 w-3" />,
        color: 'text-gray-400'
      };
  }
}

function ThreadList({
  threads,
  onThreadClick,
}: {
  threads: Thread[];
  onThreadClick?: (threadId: string) => void;
}) {
  const [threadId, setThreadId] = useQueryState("threadId");

  return (
    <div className="flex h-full w-full flex-col items-start justify-start gap-2 overflow-y-auto pb-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
      {threads.map((t) => {
        let itemText = t.thread_id;
        if (
          typeof t.values === "object" &&
          t.values &&
          "messages" in t.values &&
          Array.isArray(t.values.messages) &&
          t.values.messages?.length > 0
        ) {
          const firstMessage = t.values.messages[0];
          itemText = getContentString(firstMessage.content);
        }
        
        const threadStatus = getThreadStatus(t);
        const isActive = t.thread_id === threadId;
        
        return (
          <div key={t.thread_id} className="w-full px-1">
            <Button
              variant="ghost"
              className={cn(
                "w-full max-w-[250px] items-start justify-start text-left font-normal overflow-hidden",
                isActive && "bg-accent"
              )}
              onClick={(e) => {
                e.preventDefault();
                onThreadClick?.(t.thread_id);
                if (t.thread_id === threadId) return;
                setThreadId(t.thread_id);
              }}
            >
              <div className="flex items-center gap-2 w-full min-w-0">
                <span className={cn("flex-shrink-0", threadStatus.color)}>
                  {threadStatus.icon}
                </span>
                <p className="truncate text-ellipsis flex-1 min-w-0">{itemText}</p>
              </div>
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function ThreadHistoryLoading() {
  return (
    <div className="flex h-full w-full flex-col items-start justify-start gap-2 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
      {Array.from({ length: 10 }).map((_, i) => (
        <Skeleton key={`skeleton-${i}`} className="h-10 w-full max-w-[250px]" />
      ))}
    </div>
  );
}

export function ThreadHistory() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [isOpen, setIsOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [chatHistoryOpen, setChatHistoryOpen] = useQueryState(
    "chatHistoryOpen",
    parseAsBoolean.withDefault(false)
  );

  const { getThreads, threads, setThreads, threadsLoading, setThreadsLoading } =
    useThreads();

  // Initial thread loading
  useEffect(() => {
    if (typeof window === "undefined") return;
    setThreadsLoading(true);
    getThreads()
      .then(setThreads)
      .catch(console.error)
      .finally(() => setThreadsLoading(false));
  }, [getThreads, setThreads, setThreadsLoading]);

  // Auto-refresh threads every 30 seconds when sidebar is open for real-time updates
  useEffect(() => {
    if (!isOpen && !mobileOpen) return; // Only refresh when sidebar is visible
    
    const interval = setInterval(async () => {
      try {
        const updatedThreads = await getThreads();
        setThreads(updatedThreads);
      } catch (error) {
        console.warn("[ThreadHistory] Auto-refresh failed:", error);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [isOpen, mobileOpen, getThreads, setThreads]);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
    setChatHistoryOpen(!chatHistoryOpen);
  };

  const handleThreadClick = (threadId: string) => {
    if (!isDesktop) {
      setMobileOpen(false);
    }
  };

  return (
    <>
      {/* Desktop sidebar */}
      <div
        className={cn(
          "h-full border-r border-slate-200 transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 flex flex-col -ml-6",
          isOpen && isDesktop ? "w-64" : "w-0"
        )}
      >
        {isOpen && (
          <>
            <div className="flex w-full items-center justify-between px-4 py-3 border-b border-slate-200">
              <h1 className="text-xl font-semibold tracking-tight">
                Thread History
              </h1>
              <Button
                className="hover:bg-gray-100"
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
              >
                <PanelRightClose className="size-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto">
              {threadsLoading ? (
                <ThreadHistoryLoading />
              ) : (
                <ThreadList
                  threads={threads}
                  onThreadClick={handleThreadClick}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Toggle button when sidebar is closed on desktop */}
      {!isOpen && isDesktop && (
        <Button
          className="absolute top-16 left-0 z-10 rounded-r-full rounded-l-none hover:bg-gray-100 border border-l-0 border-slate-200"
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
        >
          <PanelRightOpen className="size-5" />
        </Button>
      )}

      {/* Mobile toggle and sheet */}
      {!isDesktop && (
        <>
          <Button
            className="absolute top-16 left-0 z-10 rounded-r-full rounded-l-none hover:bg-gray-100 border border-l-0 border-slate-200"
            variant="ghost"
            size="sm"
            onClick={() => setMobileOpen(true)}
          >
            <PanelRightOpen className="size-5" />
          </Button>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="w-80 p-0">
              <SheetHeader className="px-4 py-3 border-b border-slate-200">
                <SheetTitle>Thread History</SheetTitle>
              </SheetHeader>
              <div className="overflow-auto p-2">
                {threadsLoading ? (
                  <ThreadHistoryLoading />
                ) : (
                  <ThreadList
                    threads={threads}
                    onThreadClick={handleThreadClick}
                  />
                )}
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}
    </>
  );
}
