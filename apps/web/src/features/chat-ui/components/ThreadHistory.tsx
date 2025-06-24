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
import { PanelRightOpen, PanelRightClose } from "lucide-react";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { cn } from "@/lib/utils/utils";


function ThreadList({
  threads,
  applicationThreads,
  onThreadClick,
}: {
  threads: Thread[];
  applicationThreads: any[];
  onThreadClick?: (threadId: string) => void;
}) {
  const [threadId, setThreadId] = useQueryState("threadId");

  return (
    <div className="flex h-full w-full flex-col items-start justify-start gap-2 overflow-y-auto pb-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
      {threads.map((t) => {
        let itemText = t.thread_id;
        
        // First priority: Check applicationThreads for RFP info using thread ID
        const appThread = applicationThreads?.find(
          (app) => app.appGeneratedThreadId === t.thread_id
        );
        
        if (appThread?.proposalTitle) {
          itemText = appThread.proposalTitle;
        }
        // Check for RFP document info in the rfpDocument object
        else if (t.values?.rfpDocument?.metadata?.fileName) {
          // Remove file extension for cleaner display
          itemText = t.values.rfpDocument.metadata.fileName.replace(/\.[^/.]+$/, "");
        }
        else if (t.values?.rfpDocument?.title) {
          itemText = t.values.rfpDocument.title;
        }
        else if (t.values?.rfpDocument?.name) {
          itemText = t.values.rfpDocument.name;
        }
        else if (t.values?.rfpDocument?.fileName) {
          itemText = t.values.rfpDocument.fileName;
        }
        else if (t.values?.rfpDocument?.originalName) {
          itemText = t.values.rfpDocument.originalName;
        }
        // Check for RFP document title/name in various locations
        else if (t.values?.metadata?.rfpDocumentTitle) {
          itemText = t.values.metadata.rfpDocumentTitle;
        }
        else if (t.values?.metadata?.rfpTitle) {
          itemText = t.values.metadata.rfpTitle;
        }
        else if (t.values?.metadata?.documentName) {
          itemText = t.values.metadata.documentName;
        }
        else if (t.values?.metadata?.fileName) {
          itemText = t.values.metadata.fileName;
        }
        else if (t.metadata?.rfpDocumentTitle) {
          itemText = t.metadata.rfpDocumentTitle;
        }
        else if (t.metadata?.rfpTitle) {
          itemText = t.metadata.rfpTitle;
        }
        else if (t.metadata?.documentName) {
          itemText = t.metadata.documentName;
        }
        else if (t.metadata?.fileName) {
          itemText = t.metadata.fileName;
        }
        // Check if there's RFP info in the state values
        else if (t.values?.rfp?.title) {
          itemText = t.values.rfp.title;
        }
        else if (t.values?.rfp?.name) {
          itemText = t.values.rfp.name;
        }
        // Last resort: Use a generic name
        else {
          itemText = "RFP Analysis";
        }
        
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
              <p className="truncate text-ellipsis w-full">{itemText}</p>
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

  const { getThreads, threads, setThreads, threadsLoading, setThreadsLoading, applicationThreads } =
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

  // Auto-refresh removed - threads will be updated when new threads are created

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
          "h-full border-r border-slate-200 transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 flex flex-col",
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
                  applicationThreads={applicationThreads}
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
                    applicationThreads={applicationThreads}
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
