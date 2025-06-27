# Testing Intelligence Gathering Streaming

## Test Scenario

1. Start the development servers:
   ```bash
   npm run dev
   ```

2. Create a new proposal and upload an RFP document

3. When intelligence gathering starts, you should see:
   - Status messages like "Looking into company's recent initiatives..." appear temporarily
   - These status messages update as new searches are performed
   - NO accumulating AI messages saying "I'll search for X, Y, Z"
   - Only the final intelligence briefing message appears in the chat

## Expected Behavior

### Before Fix:
- Multiple AI messages accumulate: "I'll search for strategic initiatives", "I found X results", etc.
- Each search adds a new message to the UI
- UI becomes cluttered with intermediate messages

### After Fix:
- Only status indicators appear during searches
- Status messages show what's being searched (e.g., "Researching vendor relationships...")
- Final intelligence briefing appears as a single message
- Clean, uncluttered UI

## Implementation Details

1. **Research Agent**: Only returns messages when tool_calls is empty/null
2. **ToolNode**: Automatically handles tool execution without adding to state
3. **Intelligence Search Tool**: Emits status via config.writer
4. **Frontend**: Handles custom stream events for status display

## Verification Steps

1. Check browser console for:
   - `[Thread] Received status: Looking into...` messages
   - `[Research Agent] Generated X search queries` logs
   - No duplicate message additions

2. Check UI for:
   - Temporary status indicators during search
   - Single final intelligence briefing message
   - No intermediate AI planning messages