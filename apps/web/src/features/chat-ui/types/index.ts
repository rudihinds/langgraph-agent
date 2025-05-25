import { BaseMessage } from "@langchain/core/messages";
import { Thread as LangGraphThread, ThreadStatus } from "@langchain/langgraph-sdk";
import { HumanInterrupt, HumanResponse } from "@langchain/langgraph/prebuilt";

export type HumanResponseWithEdits = HumanResponse &
  (
    | { acceptAllowed?: false; editsMade?: never }
    | { acceptAllowed?: true; editsMade?: boolean }
  );

export type Email = {
  id: string;
  thread_id: string;
  from_email: string;
  to_email: string;
  subject: string;
  page_content: string;
  send_time: string | undefined;
  read?: boolean;
  status?: "in-queue" | "processing" | "hitl" | "done";
};

export interface ThreadValues {
  email: Email;
  messages: BaseMessage[];
  triage: {
    logic: string;
    response: string;
  };
}

export type ThreadData<
  ThreadValues extends Record<string, any> = Record<string, any>,
> = {
  thread: LangGraphThread<ThreadValues>;
} & (
  | {
      status: "interrupted";
      interrupts: HumanInterrupt[] | undefined;
    }
  | {
      status: "idle" | "busy" | "error";
      interrupts?: never;
    }
);

export type ThreadStatusWithAll = ThreadStatus | "all";

export type SubmitType = "accept" | "response" | "edit";

export interface AgentInbox {
  /**
   * A unique identifier for the inbox.
   */
  id: string;
  /**
   * The ID of the graph.
   */
  graphId: string;
  /**
   * The URL of the deployment. Either a localhost URL, or a deployment URL.
   */
  deploymentUrl: string;
  /**
   * Optional name for the inbox, used in the UI to label the inbox.
   */
  name?: string;
  /**
   * Whether or not the inbox is selected.
   */
  selected: boolean;
}

/**
 * Roles for chat messages
 */
export enum Role {
  USER = "user",
  ASSISTANT = "assistant",
  SYSTEM = "system",
  TOOL = "tool",
}

/**
 * Message interface for chat messages
 */
export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Interrupt response interface for agent interrupts
 */
export interface InterruptResponse {
  type: string;
  reason: string;
  sectionContent?: string;
  sectionId?: string;
  options?: string[];
  agentState?: Record<string, any>;
}

/**
 * Represents a chat thread (basic chat interface)
 */
export interface ChatThread {
  id: string;
  title?: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

// Export Thread as an alias for ChatThread for backward compatibility
export type Thread = ChatThread;

/**
 * Chat context state
 */
export interface ChatState {
  threads: ChatThread[];
  activeThreadId: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Chat context actions
 */
export interface ChatActions {
  createThread: () => Promise<string>;
  setActiveThread: (threadId: string) => void;
  addMessage: (message: Omit<Message, "id" | "createdAt">) => Promise<void>;
  deleteThread: (threadId: string) => void;
  clearThreads: () => void;
}

/**
 * Combined chat context value
 */
export interface ChatContextValue extends ChatState, ChatActions {}
