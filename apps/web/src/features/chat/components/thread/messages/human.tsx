import React from "react";
import { Message } from "../../lib/types.js";

interface HumanMessageProps {
  message: Message;
}

export const HumanMessage: React.FC<HumanMessageProps> = ({ message }) => {
  return (
    <div className="p-4 mb-4 bg-gray-100 rounded-lg">
      <div className="font-medium text-gray-900">You</div>
      <div className="mt-1 text-gray-700">{message.content}</div>
    </div>
  );
};
