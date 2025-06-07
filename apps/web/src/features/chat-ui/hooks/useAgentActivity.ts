import { useState, useEffect } from "react";

/**
 * Generic hook to detect when the agent is actively working
 *
 * This provides a universal way to show loading states during agent processing,
 * regardless of the specific task (RFP analysis, document generation, etc.)
 *
 * @param isStreaming - Whether the agent is currently streaming a response
 * @param messages - Current message list in the conversation
 * @returns Object with agent activity state
 */
export const useAgentActivity = (isStreaming: boolean, messages: any[]) => {
  const [isAgentWorking, setIsAgentWorking] = useState(false);

  useEffect(() => {
    // Agent is working if:
    // 1. Stream is active (isStreaming = true)
    // 2. Last message was from user (agent hasn't responded yet)
    const lastMessage = messages[messages.length - 1];
    const userWaitingForResponse = lastMessage?.role === "user";

    const working = isStreaming || userWaitingForResponse;
    setIsAgentWorking(working);
  }, [isStreaming, messages]);

  return {
    isAgentWorking,
    shouldShowLoading: isAgentWorking,
  };
};
