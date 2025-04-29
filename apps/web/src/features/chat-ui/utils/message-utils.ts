import type { Message } from "@langchain/langgraph-sdk";
import { Message as MessageType } from "../types";

export function getContentString(content: Message["content"]): string {
  if (typeof content === "string") return content;
  const texts = content
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text);
  return texts.join(" ");
}

/**
 * Format a timestamp for display in the UI
 * @param date Date to format
 * @returns Formatted date string
 */
export function formatMessageTime(date?: Date): string {
  if (!date) return "";

  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Truncate a message to a specific length
 * @param message Message to truncate
 * @param maxLength Maximum length to truncate to
 * @returns Truncated message
 */
export function truncateMessage(message: string, maxLength = 50): string {
  if (message.length <= maxLength) return message;
  return `${message.substring(0, maxLength).trim()}...`;
}

/**
 * Group messages by date for display
 * @param messages Array of messages to group
 * @returns Object with date strings as keys and arrays of messages as values
 */
export function groupMessagesByDate(
  messages: MessageType[]
): Record<string, MessageType[]> {
  const groupedMessages: Record<string, MessageType[]> = {};

  messages.forEach((message) => {
    if (!message.createdAt) return;

    const date = new Date(message.createdAt);
    const dateString = date.toLocaleDateString();

    if (!groupedMessages[dateString]) {
      groupedMessages[dateString] = [];
    }

    groupedMessages[dateString].push(message);
  });

  return groupedMessages;
}

/**
 * Get the last message from a thread
 * @param messages Array of messages
 * @returns The last message or undefined if no messages
 */
export function getLastMessage(
  messages: MessageType[]
): MessageType | undefined {
  if (!messages.length) return undefined;
  return messages[messages.length - 1];
}

/**
 * Calculate how long ago a message was sent
 * @param date Date to calculate from
 * @returns String representation of time ago
 */
export function getTimeAgo(date?: Date): string {
  if (!date) return "";

  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}
