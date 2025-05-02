import { Button } from "@/components/ui/button";
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
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { PanelRightOpen, PanelRightClose } from "lucide-react";
import { useMediaQuery } from "../hooks/useMediaQuery";

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
        return (
          <div key={t.thread_id} className="w-full px-1">
            <Button
              variant="ghost"
              className="w-full max-w-[250px] items-start justify-start text-left font-normal overflow-hidden"
              onClick={(e) => {
                e.preventDefault();
                onThreadClick?.(t.thread_id);
                if (t.thread_id === threadId) return;
                setThreadId(t.thread_id);
              }}
            >
              <p className="truncate text-ellipsis">{itemText}</p>
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
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const [isOpen, setIsOpen] = useState(true);
  const [chatHistoryOpen, setChatHistoryOpen] = useQueryState(
    "chatHistoryOpen",
    parseAsBoolean.withDefault(false)
  );

  const { getThreads, threads, setThreads, threadsLoading, setThreadsLoading } =
    useThreads();

  useEffect(() => {
    if (typeof window === "undefined") return;
    setThreadsLoading(true);
    getThreads()
      .then(setThreads)
      .catch(console.error)
      .finally(() => setThreadsLoading(false));
  }, [getThreads, setThreads, setThreadsLoading]);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
    setChatHistoryOpen(!chatHistoryOpen);
  };

  return (
    <>
      <div
        className={`shadow-inner-right h-full border-r border-slate-200 transition-all duration-300 ease-in-out overflow-hidden ${
          isOpen && isLargeScreen ? "w-64" : "w-0"
        } flex-shrink-0 flex flex-col`}
      >
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
        {threadsLoading ? (
          <ThreadHistoryLoading />
        ) : (
          <ThreadList threads={threads} />
        )}
      </div>

      {/* Toggle button when sidebar is closed */}
      {(!isOpen || !isLargeScreen) && (
        <Button
          className="absolute top-20 left-0 z-10 rounded-r-full rounded-l-none hover:bg-gray-100 border border-l-0 border-slate-200"
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
        >
          <PanelRightOpen className="size-5" />
        </Button>
      )}

      {/* Mobile sheet */}
      <div className="lg:hidden">
        <Sheet
          open={!!chatHistoryOpen && !isLargeScreen}
          onOpenChange={(open) => {
            if (isLargeScreen) return;
            setChatHistoryOpen(open);
          }}
        >
          <SheetContent side="left" className="flex lg:hidden">
            <SheetHeader>
              <SheetTitle>Thread History</SheetTitle>
            </SheetHeader>
            <ThreadList
              threads={threads}
              onThreadClick={() => setChatHistoryOpen((o) => !o)}
            />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
