import React from 'react';
import { Loader2 } from 'lucide-react';
import { StatusInfo } from '../types/status';
import { cn } from '@/lib/utils';

interface StatusMessageProps {
  status: StatusInfo;
  className?: string;
}

/**
 * Component for displaying agent status messages
 * Visually distinct from regular chat messages with blue theme and loading indicator
 */
export function StatusMessage({ status, className }: StatusMessageProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div
      className={cn(
        "status-message-container",
        "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500",
        "p-3 rounded-r-lg mb-2 flex items-center gap-3",
        "animate-in slide-in-from-left duration-300",
        className
      )}
    >
      {/* Loading indicator */}
      <div className="status-indicator text-blue-600 dark:text-blue-400">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
      
      {/* Status content */}
      <div className="status-content flex-1">
        {status.agentName && (
          <span className="agent-name font-medium text-blue-700 dark:text-blue-300 mr-1">
            {status.agentName}:
          </span>
        )}
        <span className="status-text text-gray-700 dark:text-gray-300 text-sm">
          {status.message}
        </span>
      </div>
      
      {/* Timestamp */}
      {status.timestamp && (
        <span className="timestamp text-xs text-gray-500 dark:text-gray-400">
          {formatTime(status.timestamp)}
        </span>
      )}
    </div>
  );
}

/**
 * Container for multiple status messages during parallel agent execution
 */
interface StatusMessagesContainerProps {
  statuses: Map<string, StatusInfo>;
  className?: string;
}

export function StatusMessagesContainer({ statuses, className }: StatusMessagesContainerProps) {
  if (statuses.size === 0) return null;

  return (
    <div className={cn("status-messages-container space-y-2", className)}>
      {Array.from(statuses.entries()).map(([agentId, status]) => (
        <StatusMessage key={agentId} status={status} />
      ))}
    </div>
  );
}