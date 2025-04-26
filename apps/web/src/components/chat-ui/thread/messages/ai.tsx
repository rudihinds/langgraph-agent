import React from "react";
import { Message } from "../../lib/types.js";

interface AssistantMessageProps {
  message: Message;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({
  message,
}) => {
  return (
    <div className="p-4 mb-4 bg-blue-50 rounded-lg">
      <div className="font-medium text-blue-900">Assistant</div>
      <div className="mt-1 text-gray-700">{message.content}</div>
    </div>
  );
};

export const AssistantMessageLoading: React.FC = () => {
  return (
    <div
      className="p-4 mb-4 bg-blue-50 rounded-lg"
      data-testid="loading-indicator"
    >
      <div className="font-medium text-blue-900">Assistant</div>
      <div className="mt-1 text-gray-700 flex items-center">
        <div className="animate-pulse mr-2">Thinking</div>
        <div className="animate-bounce">...</div>
      </div>
    </div>
  );
};
