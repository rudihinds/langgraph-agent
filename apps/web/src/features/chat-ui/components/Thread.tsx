import { useState, useRef, useEffect } from "react";
import { useChatContext } from "../context/ChatContext";
import { Message as MessageType } from "../types";

// Message component to display a single message
function Message({ message }: { message: MessageType }) {
  return (
    <div
      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} mb-4`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          message.role === "user"
            ? "bg-blue-500 text-white"
            : "bg-gray-200 text-gray-800"
        }`}
      >
        <p className="text-sm">{message.content}</p>
        <div className="mt-1 text-xs text-right opacity-70">
          {new Date(message.createdAt).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

// Thread component that displays all messages and input field
export function Thread() {
  const { threads, activeThreadId, isLoading, addMessage } = useChatContext();
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Find active thread
  const activeThread = threads.find((thread) => thread.id === activeThreadId);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeThread?.messages]);

  // Handle sending a new message
  const handleSendMessage = async () => {
    if (!inputValue.trim() || !activeThreadId) return;

    await addMessage({
      role: "user",
      content: inputValue,
    });

    setInputValue("");
  };

  // Handle key press (Enter to send)
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // No active thread
  if (!activeThread) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">
          No active thread. Create a new one to start chatting.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages container */}
      <div className="flex-1 p-4 overflow-y-auto">
        {activeThread.messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">
              No messages yet. Start a conversation!
            </p>
          </div>
        ) : (
          activeThread.messages.map((message) => (
            <Message key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-4 border-t">
        <div className="flex items-center">
          <textarea
            className="flex-1 p-2 border border-gray-300 rounded-md resize-none focus:border-blue-500 focus:outline-none"
            placeholder="Type a message..."
            rows={1}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={isLoading}
          />
          <button
            className="px-4 py-2 ml-2 text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none disabled:opacity-50"
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
          >
            {isLoading ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
