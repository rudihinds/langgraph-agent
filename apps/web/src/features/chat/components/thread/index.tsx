import React, { useRef, useEffect } from "react";
import { useStream } from "../providers/Stream.js";
import { AssistantMessage, AssistantMessageLoading } from "./messages/ai.js";
import { HumanMessage } from "./messages/human.js";
import { Message } from "../lib/types.js";

export const Thread: React.FC = () => {
  const { messages, sendMessage, isLoading } = useStream();
  const [inputValue, setInputValue] = React.useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      sendMessage(inputValue);
      setInputValue("");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 overflow-auto">
        {messages &&
          messages.map((message: Message) => {
            if (message.role === "human") {
              return <HumanMessage key={message.id} message={message} />;
            } else {
              return <AssistantMessage key={message.id} message={message} />;
            }
          })}
        {isLoading && <AssistantMessageLoading />}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isLoading}
            placeholder="Type a message..."
            className="flex-1 p-2 border rounded"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 text-white bg-blue-500 rounded disabled:bg-blue-300"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};
