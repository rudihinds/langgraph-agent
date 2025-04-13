# Supabase Persistence Implementation for LangGraph

This document outlines the implementation details for integrating Supabase with LangGraph's persistence layer to provide robust session management for the Research Agent.

## Database Schema

First, we need to create the appropriate tables in Supabase:

```sql
-- Create table for storing LangGraph checkpoints
CREATE TABLE proposal_checkpoints (
  id BIGSERIAL PRIMARY KEY,
  thread_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  proposal_id UUID NOT NULL REFERENCES proposals(id),
  checkpoint_data JSONB NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- For efficient lookups
  UNIQUE (thread_id, user_id)
);

-- Add indexes for faster queries
CREATE INDEX idx_proposal_checkpoints_thread_id ON proposal_checkpoints (thread_id);
CREATE INDEX idx_proposal_checkpoints_user_id ON proposal_checkpoints (user_id);
CREATE INDEX idx_proposal_checkpoints_proposal_id ON proposal_checkpoints (proposal_id);

-- Add Row Level Security
ALTER TABLE proposal_checkpoints ENABLE ROW LEVEL SECURITY;

-- Create policy to restrict access to the user's own checkpoints
CREATE POLICY "Users can only access their own checkpoints"
  ON proposal_checkpoints
  USING (auth.uid() = user_id);

-- Create policy for inserting checkpoints
CREATE POLICY "Users can insert their own checkpoints"
  ON proposal_checkpoints
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy for updating checkpoints
CREATE POLICY "Users can update their own checkpoints"
  ON proposal_checkpoints
  FOR UPDATE
  USING (auth.uid() = user_id);
  
-- Create policy for deleting checkpoints
CREATE POLICY "Users can delete their own checkpoints"
  ON proposal_checkpoints
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create session tracking table for metadata
CREATE TABLE proposal_sessions (
  id BIGSERIAL PRIMARY KEY,
  thread_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  proposal_id UUID NOT NULL REFERENCES proposals(id),
  status TEXT NOT NULL DEFAULT 'active',
  start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::JSONB,
  
  -- For efficient lookups
  UNIQUE (thread_id)
);

-- Add indexes
CREATE INDEX idx_proposal_sessions_thread_id ON proposal_sessions (thread_id);
CREATE INDEX idx_proposal_sessions_user_id ON proposal_sessions (user_id);
CREATE INDEX idx_proposal_sessions_proposal_id ON proposal_sessions (proposal_id);
CREATE INDEX idx_proposal_sessions_status ON proposal_sessions (status);

-- Add Row Level Security
ALTER TABLE proposal_sessions ENABLE ROW LEVEL SECURITY;

-- Create policy to restrict access to the user's own sessions
CREATE POLICY "Users can only access their own sessions"
  ON proposal_sessions
  USING (auth.uid() = user_id);
```

## SupabaseCheckpointer Implementation

We'll implement a custom `SupabaseCheckpointer` class that implements LangGraph's checkpointer interface:

```typescript
// apps/backend/lib/persistence/supabase-checkpointer.ts

import { Checkpoint, Checkpointer } from "@langchain/langgraph";
import { createClient } from "@supabase/supabase-js";
import { Logger } from "../logging";
import { z } from "zod";
import { exponentialBackoff } from "../utils/backoff";
import { createHash } from "crypto";

/**
 * Configuration for the SupabaseCheckpointer
 */
export interface SupabaseCheckpointerConfig {
  supabaseUrl: string;
  supabaseKey: string;
  tableName?: string;
  maxRetries?: number;
  retryDelay?: number;
  logger?: Logger;
  userIdGetter?: () => Promise<string | null>;
  proposalIdGetter?: (threadId: string) => Promise<string | null>;
}

// Ensure shape of checkpoint data
const CheckpointSchema = z.object({
  thread_id: z.string(),
  config: z.record(z.any()).optional(),
  state: z.record(z.any()),
});

/**
 * SupabaseCheckpointer implements LangGraph's Checkpointer interface
 * to store and retrieve checkpoint state from Supabase
 */
export class SupabaseCheckpointer implements Checkpointer {
  private supabase;
  private tableName: string;
  private maxRetries: number;
  private retryDelay: number;
  private logger: Logger;
  private userIdGetter: () => Promise<string | null>;
  private proposalIdGetter: (threadId: string) => Promise<string | null>;

  constructor({
    supabaseUrl,
    supabaseKey,
    tableName = "proposal_checkpoints",
    maxRetries = 3,
    retryDelay = 500,
    logger = console,
    userIdGetter = async () => null,
    proposalIdGetter = async () => null,
  }: SupabaseCheckpointerConfig) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.tableName = tableName;
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
    this.logger = logger;
    this.userIdGetter = userIdGetter;
    this.proposalIdGetter = proposalIdGetter;
  }

  /**
   * Generate a consistent thread ID with optional prefix
   */
  public static generateThreadId(
    proposalId: string,
    componentName: string = "research"
  ): string {
    // Create a hash of the proposalId for shorter IDs
    const hash = createHash("sha256")
      .update(proposalId)
      .digest("hex")
      .substring(0, 10);
    
    return `${componentName}_${hash}_${Date.now()}`;
  }

  /**
   * Get a checkpoint by thread_id
   */
  async get(threadId: string): Promise<Checkpoint | null> {
    try {
      // Use exponential backoff for retries
      return await exponentialBackoff(
        async () => {
          const { data, error } = await this.supabase
            .from(this.tableName)
            .select("checkpoint_data")
            .eq("thread_id", threadId)
            .single();

          if (error) {
            // Only throw on errors other than not found
            if (error.code !== "PGRST116") {
              throw new Error(`Error fetching checkpoint: ${error.message}`);
            }
            return null;
          }

          if (!data || !data.checkpoint_data) {
            return null;
          }

          // Validate the checkpoint data
          try {
            const parsed = CheckpointSchema.parse(data.checkpoint_data);
            return data.checkpoint_data as Checkpoint;
          } catch (validationError) {
            this.logger.error("Invalid checkpoint data format", {
              threadId,
              error: validationError,
            });
            throw new Error("Invalid checkpoint data format");
          }
        },
        {
          maxRetries: this.maxRetries,
          baseDelayMs: this.retryDelay,
        }
      );
    } catch (error) {
      this.logger.error("Failed to get checkpoint after retries", {
        threadId,
        error,
      });
      // Return null instead of throwing to allow LangGraph to continue
      return null;
    }
  }

  /**
   * Store a checkpoint by thread_id
   */
  async put(threadId: string, checkpoint: Checkpoint): Promise<void> {
    try {
      // Validate the checkpoint
      CheckpointSchema.parse({
        ...checkpoint,
        thread_id: threadId,
      });

      // Get the associated user and proposal
      const userId = await this.userIdGetter();
      const proposalId = await this.proposalIdGetter(threadId);

      if (!userId || !proposalId) {
        throw new Error(
          "Cannot store checkpoint without user ID and proposal ID"
        );
      }

      // Use exponential backoff for retries
      await exponentialBackoff(
        async () => {
          // Use upsert to handle both insert and update
          const { error } = await this.supabase
            .from(this.tableName)
            .upsert(
              {
                thread_id: threadId,
                user_id: userId,
                proposal_id: proposalId,
                checkpoint_data: checkpoint,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "thread_id, user_id" }
            );

          if (error) {
            throw new Error(`Error storing checkpoint: ${error.message}`);
          }

          // Also update session tracking
          await this.updateSessionActivity(threadId, userId, proposalId);
        },
        {
          maxRetries: this.maxRetries,
          baseDelayMs: this.retryDelay,
        }
      );
    } catch (error) {
      this.logger.error("Failed to store checkpoint after retries", {
        threadId,
        error,
      });
      // Throw to notify LangGraph of persistence failure
      throw error;
    }
  }

  /**
   * Delete a checkpoint by thread_id
   */
  async delete(threadId: string): Promise<void> {
    try {
      await exponentialBackoff(
        async () => {
          const { error } = await this.supabase
            .from(this.tableName)
            .delete()
            .eq("thread_id", threadId);

          if (error) {
            throw new Error(`Error deleting checkpoint: ${error.message}`);
          }
        },
        {
          maxRetries: this.maxRetries,
          baseDelayMs: this.retryDelay,
        }
      );
    } catch (error) {
      this.logger.error("Failed to delete checkpoint after retries", {
        threadId,
        error,
      });
      // Don't throw on deletion errors to avoid blocking the application
    }
  }

  /**
   * Update session activity tracking
   */
  private async updateSessionActivity(
    threadId: string,
    userId: string,
    proposalId: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from("proposal_sessions")
        .upsert(
          {
            thread_id: threadId,
            user_id: userId,
            proposal_id: proposalId,
            last_activity: new Date().toISOString(),
          },
          { onConflict: "thread_id" }
        );

      if (error) {
        this.logger.warn("Error updating session activity", {
          threadId,
          error: error.message,
        });
      }
    } catch (error) {
      this.logger.warn("Failed to update session activity", {
        threadId,
        error,
      });
    }
  }
}
```

## Message History Management

To prevent memory bloat and context overflow, we'll implement a message management utility:

```typescript
// apps/backend/lib/state/messages.ts

import { BaseMessage } from "@langchain/core/messages";
import { getTokenCount, countTokens } from "../utils/tokens";
import { z } from "zod";

// Maximum allowed tokens in the history (based on context window)
const MAX_HISTORY_TOKENS = 4000;
const MIN_MESSAGES_TO_KEEP = 4; // Always keep the latest few messages

/**
 * Interface for message pruning options
 */
export interface MessagePruningOptions {
  maxTokens?: number;
  minMessagesToKeep?: number;
  keepSystemMessages?: boolean;
  summarize?: boolean;
}

/**
 * Validates message array format
 */
export const MessagesArraySchema = z.array(
  z.object({
    type: z.string(),
    content: z.union([z.string(), z.array(z.any())]),
    additional_kwargs: z.record(z.any()).optional(),
  })
);

/**
 * Prunes message history to stay under token limits
 */
export function pruneMessageHistory(
  messages: BaseMessage[],
  options: MessagePruningOptions = {}
): BaseMessage[] {
  // Set defaults
  const {
    maxTokens = MAX_HISTORY_TOKENS,
    minMessagesToKeep = MIN_MESSAGES_TO_KEEP,
    keepSystemMessages = true,
    summarize = false,
  } = options;

  // If we don't have enough messages to worry about, return as is
  if (messages.length <= minMessagesToKeep) {
    return messages;
  }

  // Get total token count
  const tokenCounts = messages.map((msg) => getTokenCount(msg));
  const totalTokens = tokenCounts.reduce((sum, count) => sum + count, 0);

  // If under the limit, return as is
  if (totalTokens <= maxTokens) {
    return messages;
  }

  // Identify which messages to keep
  const systemMessages = keepSystemMessages
    ? messages.filter((msg) => msg._getType() === "system")
    : [];
  
  // Always keep most recent messages
  const recentMessages = messages.slice(-minMessagesToKeep);
  
  // If we already need to keep all the messages, return them
  if (systemMessages.length + recentMessages.length >= messages.length) {
    return messages;
  }

  // Calculate how many tokens we need to remove
  const tokenBudget = maxTokens;
  const recentTokens = recentMessages.reduce(
    (sum, msg, i) => sum + getTokenCount(msg),
    0
  );
  const systemTokens = systemMessages.reduce(
    (sum, msg) => sum + getTokenCount(msg),
    0
  );
  
  const remainingBudget = tokenBudget - recentTokens - systemTokens;
  
  // If we're summarizing history, create a summary
  if (summarize && remainingBudget > 0) {
    // This would involve an LLM call to summarize previous messages
    // For now, we just return system messages + recent messages
    return [...systemMessages, ...recentMessages];
  }
  
  // Otherwise, keep as many older messages as possible under the budget
  const middleMessages = messages.slice(
    systemMessages.length,
    messages.length - recentMessages.length
  );
  
  // Start keeping from newest to oldest
  let budgetLeft = remainingBudget;
  const keepMessages: BaseMessage[] = [];
  
  for (let i = middleMessages.length - 1; i >= 0; i--) {
    const msg = middleMessages[i];
    const tokenCount = getTokenCount(msg);
    
    if (tokenCount <= budgetLeft) {
      keepMessages.unshift(msg);
      budgetLeft -= tokenCount;
    } else {
      break;
    }
  }
  
  return [...systemMessages, ...keepMessages, ...recentMessages];
}

/**
 * Create a custom messages state reducer that automatically prunes history
 */
export function pruningMessagesStateReducer(
  currentValue: BaseMessage[] = [],
  newValue: BaseMessage[],
  options: MessagePruningOptions = {}
): BaseMessage[] {
  // First apply the standard reducer logic (appending messages)
  const updatedMessages = [...currentValue, ...newValue];
  
  // Then prune if needed
  return pruneMessageHistory(updatedMessages, options);
}
```

## Research Agent Integration

Now, let's update the Research Agent to use our Supabase persistence:

```typescript
// apps/backend/agents/research/index.ts

import { StateGraph } from "@langchain/langgraph";
import { ResearchStateAnnotation, ResearchState } from "./state";
import { documentLoaderNode, deepResearchNode, solutionSoughtNode } from "./nodes";
import { SupabaseCheckpointer } from "../../lib/persistence/supabase-checkpointer";
import { pruningMessagesStateReducer } from "../../lib/state/messages";
import { logger } from "../../lib/logging";

/**
 * Creates the research agent graph
 * 
 * This function constructs the LangGraph workflow for the research agent,
 * defining the nodes and edges that control the flow of execution
 */
export const createResearchGraph = (options: {
  userId?: string;
  proposalId?: string;
  threadId?: string;
}) => {
  // Create the research state graph
  const researchGraph = new StateGraph(ResearchStateAnnotation)
    .addNode("documentLoader", documentLoaderNode)
    .addNode("deepResearch", deepResearchNode)
    .addNode("solutionSought", solutionSoughtNode)
    
    // Define workflow sequence
    .addEdge("__start__", "documentLoader")
    .addConditionalEdges(
      "documentLoader",
      (state: ResearchState) => state.status.documentLoaded ? "deepResearch" : "__end__"
    )
    .addConditionalEdges(
      "deepResearch",
      (state: ResearchState) => state.status.researchComplete ? "solutionSought" : "__end__"
    )
    .addEdge("solutionSought", "__end__");

  // Initialize SupabaseCheckpointer for persistence
  const checkpointer = new SupabaseCheckpointer({
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    logger,
    userIdGetter: async () => options.userId || null,
    proposalIdGetter: async () => options.proposalId || null,
  });
  
  // Compile the graph with persistence
  const compiledGraph = researchGraph.compile({ 
    checkpointer,
    // Add custom state serialization/deserialization if needed
  });
  
  return compiledGraph;
};

/**
 * Research agent interface
 * 
 * Provides a simplified API for interacting with the research agent
 * from other parts of the application
 */
export const researchAgent = {
  /**
   * Generate a thread ID for a research session
   */
  generateThreadId: (proposalId: string): string => {
    return SupabaseCheckpointer.generateThreadId(proposalId, "research");
  },

  /**
   * Invoke the research agent on an RFP document
   * 
   * @param rfpDocumentId - The ID of the RFP document to analyze
   * @param options - Additional options including user ID, proposal ID, and thread ID
   * @returns The final state of the research agent
   */
  invoke: async (
    rfpDocumentId: string, 
    options: {
      userId?: string;
      proposalId?: string;
      threadId?: string;
    } = {}
  ) => {
    try {
      // Create graph with persistence options
      const graph = createResearchGraph(options);
      
      // Initial state with document ID
      const initialState = {
        rfpDocument: {
          id: rfpDocumentId,
          text: "",
          metadata: {}
        }
      };
      
      // Invoke the graph with thread_id for persistence
      const config = options.threadId ? { 
        configurable: { 
          thread_id: options.threadId 
        } 
      } : undefined;
      
      const finalState = await graph.invoke(initialState, config);
      
      return {
        success: true,
        state: finalState
      };
    } catch (error) {
      logger.error("Error invoking research agent", {
        rfpDocumentId,
        options,
        error,
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
  
  /**
   * Continue an existing research session
   * 
   * @param threadId - The thread ID of the existing session
   * @param options - Additional options including user ID and proposal ID
   * @returns The updated state of the research agent
   */
  continue: async (
    threadId: string,
    options: {
      userId?: string;
      proposalId?: string;
    } = {}
  ) => {
    try {
      // Create graph with persistence options
      const graph = createResearchGraph({
        ...options,
        threadId,
      });
      
      // Invoke the graph with thread_id for loading existing state
      const finalState = await graph.invoke(
        {}, // Empty initial state, will load from checkpoint
        { 
          configurable: { 
            thread_id: threadId 
          } 
        }
      );
      
      return {
        success: true,
        state: finalState
      };
    } catch (error) {
      logger.error("Error continuing research session", {
        threadId,
        options,
        error,
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
};

// Export all components
export * from "./state";
export * from "./nodes";
export * from "./tools";
export * from "./agents";
```

## API Integration

Finally, let's create the API route for the Research Agent:

```typescript
// apps/web/src/app/api/research/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { z } from "zod";
import { researchAgent } from "@/backend/agents/research";

// Validate the request body for starting a new research session
const StartResearchSchema = z.object({
  proposalId: z.string().uuid(),
  documentId: z.string(),
});

// Validate the request body for continuing an existing session
const ContinueResearchSchema = z.object({
  threadId: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    // Initialize Supabase client
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    
    // Handle continuing an existing session
    if ("threadId" in body) {
      try {
        const { threadId } = ContinueResearchSchema.parse(body);
        
        // Verify the user has access to this thread
        const { data: sessionData, error: sessionError } = await supabase
          .from("proposal_sessions")
          .select("proposal_id")
          .eq("thread_id", threadId)
          .eq("user_id", user.id)
          .single();
        
        if (sessionError || !sessionData) {
          return NextResponse.json(
            { error: "Session not found or access denied" },
            { status: 404 }
          );
        }
        
        // Continue the research session
        const result = await researchAgent.continue(threadId, {
          userId: user.id,
          proposalId: sessionData.proposal_id,
        });
        
        return NextResponse.json(result);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: "Invalid request format", details: error.format() },
            { status: 400 }
          );
        }
        throw error;
      }
    }
    
    // Handle starting a new research session
    try {
      const { proposalId, documentId } = StartResearchSchema.parse(body);
      
      // Verify the user has access to this proposal
      const { data: proposalData, error: proposalError } = await supabase
        .from("proposals")
        .select("id")
        .eq("id", proposalId)
        .eq("user_id", user.id)
        .single();
      
      if (proposalError || !proposalData) {
        return NextResponse.json(
          { error: "Proposal not found or access denied" },
          { status: 404 }
        );
      }
      
      // Generate a thread ID for this session
      const threadId = researchAgent.generateThreadId(proposalId);
      
      // Invoke the research agent
      const result = await researchAgent.invoke(documentId, {
        userId: user.id,
        proposalId,
        threadId,
      });
      
      // Include the thread ID in the response
      return NextResponse.json({
        ...result,
        threadId,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Invalid request format", details: error.format() },
          { status: 400 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("Error in research API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

## Setup Required in Supabase

To implement this design, you'll need to:

1. Create the `proposal_checkpoints` and `proposal_sessions` tables in Supabase
2. Configure RLS policies as defined above
3. Configure a service role key (for backend operations) and add it to your environment variables
4. Ensure proper indexes are created for performance

Once these components are implemented, you'll have a robust persistence system for your LangGraph agents that:

1. Stores state in Supabase for cross-request persistence
2. Manages message history to prevent token bloat
3. Associates sessions with users and proposals
4. Provides proper error handling and recovery
5. Includes session tracking and cleanup

This implementation follows best practices for both LangGraph and Supabase, creating a seamless user experience with reliable persistence.