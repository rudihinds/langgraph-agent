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
      <div className="font-medium text-blue-800">Assistant</div>
      <div className="mt-1 text-gray-700">{message.content}</div>
    </div>
  );
};

export const AssistantMessageLoading: React.FC = () => {
  return (
    <div className="p-4 mb-4 bg-blue-50 rounded-lg">
      <div className="font-medium text-blue-800">Assistant</div>
      <div className="mt-1 text-gray-700">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
          <div
            className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
            style={{ animationDelay: "0.2s" }}
          ></div>
          <div
            className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
            style={{ animationDelay: "0.4s" }}
          ></div>
        </div>
      </div>
    </div>
  );
};
