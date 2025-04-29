/**
 * Chat UI Feature
 *
 * This module provides the main components for the LangGraph Agent Chat UI integration.
 */

// Export components and hooks
export { ChatProvider, useChatContext } from "./context/ChatContext";
export { Thread } from "./components/Thread";
export { useMediaQuery } from "./hooks/useMediaQuery";

// Export utility functions
export {
  formatMessageTime,
  truncateMessage,
  groupMessagesByDate,
  getLastMessage,
  getTimeAgo,
  getContentString,
} from "./utils/message-utils";

// Export types explicitly to avoid name conflicts
export type { Message, Thread as ThreadType, ChatContextValue } from "./types";
