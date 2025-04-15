# Using Supabase Persistence with LangGraph

This guide explains how to use the Supabase persistence layer with LangGraph agents in simple terms.

## What is Persistence and Why Do We Need It?

When users interact with LangGraph agents (like our Research Agent), the conversation and state need to be maintained across interactions. Without persistence:

- If the server restarts, all ongoing conversations would be lost
- Users couldn't continue conversations after closing their browser
- Long-running tasks would fail if interrupted

Persistence saves the entire state of the conversation, allowing users to return later and continue from where they left off.

## How Our Persistence Works

We use two Supabase tables:

1. **`proposal_checkpoints`** - Stores the actual LangGraph state data
2. **`proposal_sessions`** - Tracks metadata about active sessions

This system works like a "save game" feature in video games:

- The state is automatically saved after each step
- Users can continue from their last saved point
- Each user only sees their own sessions

## Using Persistence in Your Code

### 1. Starting a New Session

To start a new research session:

```typescript
import { researchAgent } from "../agents/research";

// Generate a unique thread ID for the session
const threadId = researchAgent.generateThreadId(proposalId);

// Start the agent with persistence
const result = await researchAgent.invoke(documentId, {
  userId: currentUser.id,
  proposalId: proposal.id,
  threadId,
});

// ***** this needs looking at *****
// Store the threadId in your application to continue later
yourApp.saveThreadId(threadId);
```

### 2. Continuing an Existing Session

To resume a session later:

```typescript
import { researchAgent } from "../agents/research";

// Get the stored thread ID
const threadId = yourApp.getStoredThreadId();

// Continue the session
const result = await researchAgent.continue(threadId, {
  userId: currentUser.id,
  proposalId: proposal.id,
});
```

### 3. Error Handling

The agent methods return a consistent structure for success or failure:

```typescript
const result = await researchAgent.invoke(documentId, options);

if (result.success) {
  // Use the agent state
  const researchFindings = result.state.deepResearchResults;

  // Display in UI
  renderFindings(researchFindings);
} else {
  // Handle errors
  displayError(result.error);

  // Optional: attempt recovery
  offerSessionRecovery();
}
```

## Under the Hood

Here's what happens behind the scenes:

1. **Thread ID Generation**:

   - Each session gets a unique ID combining `componentName_hash_timestamp`
   - Example: `research_a1b2c3d4e5_1634567890123`

2. **State Serialization**:

   - LangGraph state is converted to JSON and stored in Supabase
   - Includes conversation history, research results, and status

3. **Message Pruning**:

   - Long conversations are automatically pruned to prevent context overflow
   - System messages and recent interactions are preserved
   - This happens transparently using `pruningMessagesStateReducer`

4. **Security**:
   - Row Level Security (RLS) ensures users only access their own data
   - Service role key is used for server-side operations

## Complete Example

Here's a complete example for implementing persistence in an API route:

```typescript
// API route: /api/research/[proposalId].ts
import { researchAgent } from "@/backend/agents/research";
import { getUser } from "@/lib/auth";

export async function POST(req: Request) {
  // Get the current user
  const user = await getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Parse request body
  const { documentId, threadId } = await req.json();
  const proposalId = req.params.proposalId;

  try {
    let result;

    if (threadId) {
      // Continue existing session
      result = await researchAgent.continue(threadId, {
        userId: user.id,
        proposalId,
      });
    } else {
      // Start new session
      const newThreadId = researchAgent.generateThreadId(proposalId);
      result = await researchAgent.invoke(documentId, {
        userId: user.id,
        proposalId,
        threadId: newThreadId,
      });

      // Include the thread ID in the response
      if (result.success) {
        result.threadId = newThreadId;
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Research API error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Server error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
```

## Troubleshooting

### Common Issues

1. **Session Not Found**:

   - Ensure the thread ID exists and belongs to the current user
   - Check if the session was cleaned up due to inactivity

2. **Permission Errors**:

   - Verify the Supabase service role key is set correctly
   - Ensure RLS policies are correctly configured

3. **Large State Objects**:
   - Very large state objects may slow down storage/retrieval
   - Consider using more aggressive message pruning options

### Debugging

To debug persistence issues:

1. Check Supabase logs for database errors
2. Examine the console logs for error messages from the checkpointer
3. Verify the thread ID format is correct
4. Check that user ID and proposal ID are provided when needed

## Persistence Configuration

The SupabaseCheckpointer has several configuration options:

```typescript
const checkpointer = new SupabaseCheckpointer({
  // Required
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,

  // Optional
  tableName: "proposal_checkpoints", // Default
  sessionTableName: "proposal_sessions", // Default
  maxRetries: 3, // Default
  retryDelay: 500, // Default in ms
  logger: console, // Default

  // Functions to get user and proposal IDs
  userIdGetter: async () => userId,
  proposalIdGetter: async () => proposalId,
});
```

## Conclusion

With Supabase persistence:

- User sessions continue reliably across server restarts
- Long-running research tasks can be safely interrupted and resumed
- The system scales naturally with your Supabase database

This implementation follows best practices for both LangGraph and Supabase, providing a robust foundation for persistent agent conversations.

## Further Reading

For a complete understanding of the database schema and relationships:

- [Database Schema and Relationships](./database-schema-relationships.md) - Detailed documentation of all tables, relationships, and security policies
- [Process Handling Architecture](./process-handling-architecture.md) - How persistence integrates with the overall system architecture
