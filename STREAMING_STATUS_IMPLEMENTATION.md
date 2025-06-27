# Intelligence Gathering Status Messages Implementation

## Overview
We've implemented proper LangGraph streaming patterns to show ephemeral status messages during intelligence gathering instead of accumulating AI messages.

## Components

### 1. SearchStatusIndicator Component ✅
- Located at: `/apps/web/src/features/chat-ui/components/SearchStatusIndicator.tsx`
- Displays status messages with animated dots
- Auto-fades after 5 seconds
- Blue-themed with proper dark mode support

### 2. Backend Status Emission ✅
- **Intelligence Search Tool**: Uses `config.writer` to emit status messages
- **Research Agent**: Emits planning status via `config.writer`
- Status format:
  ```json
  {
    "type": "search_status" | "agent_status",
    "message": "Looking into company initiatives...",
    "timestamp": "2024-01-01T00:00:00Z"
  }
  ```

### 3. Frontend Integration ✅
- **Thread Component**: Handles custom streaming when `intelligenceGatheringStatus === "running"`
- Uses `streamMode: ["custom", "updates"]` to receive both status and state updates
- Parses custom events and updates `currentStatus` state
- SearchStatusIndicator renders when `currentStatus` is set

### 4. Message Accumulation Prevention ✅
- **Research Agent**: Only returns messages when no tool calls (research complete)
- **ToolNode**: LangGraph's prebuilt component handles tool execution without adding messages
- Result: Clean UI with only final intelligence briefing

## Fixed Issue
- Changed status comparison from `"RUNNING"` to `"running"` to match the ProcessingStatus enum

## Testing
When intelligence gathering runs:
1. Status messages appear: "Looking into company's recent initiatives..."
2. Status updates as searches progress
3. No intermediate AI messages in chat
4. Only final intelligence briefing persists in conversation

## Key Pattern
This follows LangGraph's documented approach:
- Use `config.writer` for ephemeral data
- Stream with multiple modes for different data types
- Keep tool execution separate from conversation state