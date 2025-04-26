/**
 * Basic types for the Chat UI components
 */

export interface Message {
  id: string;
  role: "human" | "assistant";
  content: string;
  createdAt: string;
}

export interface StreamContextType {
  messages: Message[];
  sendMessage: (message: string) => Promise<void>;
  isLoading: boolean;
  threadId: string | null;
  error: Error | null;
  interruptGeneration: () => void;
}

export interface ThreadContextType {
  threads: any[];
  selectedThread: any | null;
  setSelectedThread: (thread: any) => void;
}
