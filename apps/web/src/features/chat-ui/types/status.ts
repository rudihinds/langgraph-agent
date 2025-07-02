/**
 * Status message types for LangGraph agent status updates
 * These are sent via config.writer from backend agents
 */

export interface StatusMessage {
  /** Type of status update */
  type: 'status';
  
  /** The status message text */
  message: string;
  
  /** Unique identifier for the agent */
  agentId?: string;
  
  /** Human-readable name of the agent */
  agentName?: string;
  
  /** Optional timestamp (added by frontend) */
  timestamp?: Date;
}

export interface StatusInfo extends StatusMessage {
  /** Timestamp is required in frontend state */
  timestamp: Date;
}

/**
 * Type guard to check if data is a status message
 */
export function isStatusMessage(data: unknown): data is StatusMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    data.type === 'status' &&
    'message' in data &&
    typeof data.message === 'string'
  );
}

/**
 * Helper to extract status message from LangGraph custom event
 * LangGraph sends custom events as ["custom", data] tuples
 */
export function extractStatusFromChunk(chunk: unknown): StatusMessage | null {
  if (Array.isArray(chunk) && chunk[0] === 'custom' && chunk[1]) {
    const data = chunk[1];
    if (isStatusMessage(data)) {
      return data;
    }
    // Backward compatibility: plain message object
    if (typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
      return {
        type: 'status',
        message: data.message
      };
    }
  }
  return null;
}