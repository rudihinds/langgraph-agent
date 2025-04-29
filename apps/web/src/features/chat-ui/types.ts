/**
 * Represents a message in the chat interface
 */
export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: Date;
}

/**
 * Represents a chat thread
 */
export interface Thread {
  id: string;
  title?: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Chat context state
 */
export interface ChatState {
  threads: Thread[];
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
