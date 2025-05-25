import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { v4 as uuidv4 } from "uuid";
import { Message, ChatContextValue, Thread, Role } from "../types";

// Create the context with a default value
const ChatContext = createContext<ChatContextValue | undefined>(undefined);

// Provider props
interface ChatProviderProps {
  children: ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createThread = useCallback(async () => {
    const newThread: Thread = {
      id: uuidv4(),
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setThreads((prev) => [...prev, newThread]);
    setActiveThreadId(newThread.id);

    return newThread.id;
  }, []);

  const setActiveThread = useCallback((threadId: string) => {
    setActiveThreadId(threadId);
  }, []);

  const addMessage = useCallback(
    async (message: Omit<Message, "id" | "createdAt">) => {
      if (!activeThreadId) {
        setError("No active thread");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const newMessage: Message = {
          ...message,
          id: uuidv4(),
          createdAt: new Date(),
        };

        setThreads((prev) =>
          prev.map((thread) => {
            if (thread.id === activeThreadId) {
              return {
                ...thread,
                messages: [...thread.messages, newMessage],
                updatedAt: new Date(),
              };
            }
            return thread;
          })
        );

        // If the message is from a user, simulate an assistant response
        if (message.role === Role.USER) {
          // Wait a bit to simulate network delay
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Add a simulated response
          const assistantMessage: Message = {
            id: uuidv4(),
            role: Role.ASSISTANT,
            content: `This is a simulated response to: "${message.content}"`,
            createdAt: new Date(),
          };

          setThreads((prev) =>
            prev.map((thread) => {
              if (thread.id === activeThreadId) {
                return {
                  ...thread,
                  messages: [...thread.messages, assistantMessage],
                  updatedAt: new Date(),
                };
              }
              return thread;
            })
          );
        }
      } catch (err) {
        setError("Failed to add message");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    },
    [activeThreadId]
  );

  const deleteThread = useCallback(
    (threadId: string) => {
      setThreads((prev) => prev.filter((thread) => thread.id !== threadId));

      if (activeThreadId === threadId) {
        setActiveThreadId(threads.length > 0 ? threads[0].id : null);
      }
    },
    [activeThreadId, threads]
  );

  const clearThreads = useCallback(() => {
    setThreads([]);
    setActiveThreadId(null);
  }, []);

  const value: ChatContextValue = {
    threads,
    activeThreadId,
    isLoading,
    error,
    createThread,
    setActiveThread,
    addMessage,
    deleteThread,
    clearThreads,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

// Custom hook to use the chat context
export function useChatContext() {
  const context = useContext(ChatContext);

  if (context === undefined) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }

  return context;
}
