import { BaseCheckpointSaver } from "@langchain/langgraph/checkpoints";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { logger } from "../../agents/logger";

const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;

interface SupabaseCheckpointerOptions<T> {
  supabaseUrl?: string;
  supabaseKey?: string;
  tableName?: string;
  sessionTableName?: string;
  validator?: z.ZodType<T>;
}

export class SupabaseCheckpointer<T> implements BaseCheckpointSaver<T> {
  private supabase;
  private tableName: string;
  private sessionTableName: string;
  private validator?: z.ZodType<T>;

  constructor(options: SupabaseCheckpointerOptions<T> = {}) {
    this.supabase = createClient(
      options.supabaseUrl || process.env.SUPABASE_URL || "",
      options.supabaseKey || process.env.SUPABASE_ANON_KEY || ""
    );
    this.tableName = options.tableName || "proposal_checkpoints";
    this.sessionTableName = options.sessionTableName || "proposal_sessions";
    this.validator = options.validator;
  }

  /**
   * Generate a unique thread ID for a new session
   */
  generateThreadId(): string {
    return uuidv4();
  }

  /**
   * Get the checkpoint data for a thread
   */
  async get(threadId: string): Promise<T | null> {
    let attempts = 0;
    
    while (attempts < RETRY_ATTEMPTS) {
      try {
        logger.debug(`Fetching checkpoint for thread: ${threadId}`);
        
        const { data, error } = await this.supabase
          .from(this.tableName)
          .select("checkpoint_data")
          .eq("thread_id", threadId)
          .single();

        if (error) {
          logger.error(`Error fetching checkpoint: ${error.message}`);
          throw new Error(`Failed to get checkpoint: ${error.message}`);
        }

        if (!data) {
          logger.debug(`No checkpoint found for thread: ${threadId}`);
          return null;
        }

        try {
          const parsedData = JSON.parse(data.checkpoint_data);
          
          // Validate parsed data if validator is provided
          if (this.validator) {
            return this.validator.parse(parsedData);
          }
          
          return parsedData as T;
        } catch (parseError) {
          logger.error(`Error parsing checkpoint data: ${parseError}`);
          throw new Error(`Failed to parse checkpoint data: ${parseError}`);
        }
      } catch (error) {
        attempts++;
        
        if (attempts >= RETRY_ATTEMPTS) {
          logger.error(`Max retry attempts reached for get operation`, { threadId });
          throw error;
        }
        
        logger.debug(`Retrying get operation (${attempts}/${RETRY_ATTEMPTS})`, { threadId });
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempts));
      }
    }
    
    return null;
  }

  /**
   * Store checkpoint data for a thread
   */
  async put(threadId: string, checkpoint: T): Promise<void> {
    let attempts = 0;
    
    while (attempts < RETRY_ATTEMPTS) {
      try {
        logger.debug(`Storing checkpoint for thread: ${threadId}`);
        
        const checkpointData = JSON.stringify(checkpoint);
        
        // Get status from checkpoint if available
        const status = (checkpoint as any)?.status || "ACTIVE";
        
        // Store checkpoint data
        const { error: checkpointError } = await this.supabase
          .from(this.tableName)
          .upsert({
            thread_id: threadId,
            checkpoint_data: checkpointData,
            updated_at: new Date().toISOString(),
          });

        if (checkpointError) {
          logger.error(`Error storing checkpoint: ${checkpointError.message}`);
          throw new Error(`Failed to save checkpoint: ${checkpointError.message}`);
        }

        // Update session activity
        const { error: sessionError } = await this.supabase
          .from(this.sessionTableName)
          .upsert({
            thread_id: threadId,
            last_active: new Date().toISOString(),
            status,
          });

        if (sessionError) {
          logger.error(`Error updating session: ${sessionError.message}`);
          // Don't fail the operation if session update fails
          // Just log the error and continue
        }

        return;
      } catch (error) {
        attempts++;
        
        if (attempts >= RETRY_ATTEMPTS) {
          logger.error(`Max retry attempts reached for put operation`, { threadId });
          throw error;
        }
        
        logger.debug(`Retrying put operation (${attempts}/${RETRY_ATTEMPTS})`, { threadId });
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempts));
      }
    }
  }

  /**
   * Delete checkpoint data for a thread
   */
  async delete(threadId: string): Promise<void> {
    let attempts = 0;
    
    while (attempts < RETRY_ATTEMPTS) {
      try {
        logger.debug(`Deleting checkpoint for thread: ${threadId}`);
        
        const { error } = await this.supabase
          .from(this.tableName)
          .delete()
          .eq("thread_id", threadId);

        if (error) {
          logger.error(`Error deleting checkpoint: ${error.message}`);
          throw new Error(`Failed to delete checkpoint: ${error.message}`);
        }

        // Note: We're not deleting the session record here,
        // as it might be useful to keep track of past sessions
        // Even if their checkpoints are deleted

        return;
      } catch (error) {
        attempts++;
        
        if (attempts >= RETRY_ATTEMPTS) {
          logger.error(`Max retry attempts reached for delete operation`, { threadId });
          throw error;
        }
        
        logger.debug(`Retrying delete operation (${attempts}/${RETRY_ATTEMPTS})`, { threadId });
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempts));
      }
    }
  }

  /**
   * Create a new session
   */
  async createSession(props: {
    threadId?: string;
    proposalId: string;
    userId: string;
    metadata?: Record<string, any>;
  }): Promise<string> {
    const threadId = props.threadId || this.generateThreadId();
    
    const { error } = await this.supabase
      .from(this.sessionTableName)
      .insert({
        thread_id: threadId,
        proposal_id: props.proposalId,
        user_id: props.userId,
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
        status: "CREATED",
        metadata: props.metadata || {},
      });

    if (error) {
      logger.error(`Error creating session: ${error.message}`);
      throw new Error(`Failed to create session: ${error.message}`);
    }

    return threadId;
  }

  /**
   * Get session details
   */
  async getSession(threadId: string): Promise<any | null> {
    const { data, error } = await this.supabase
      .from(this.sessionTableName)
      .select("*")
      .eq("thread_id", threadId)
      .single();

    if (error) {
      logger.error(`Error fetching session: ${error.message}`);
      return null;
    }

    return data;
  }

  /**
   * List active sessions for a user or proposal
   */
  async listSessions(props: {
    userId?: string;
    proposalId?: string;
    status?: string;
    limit?: number;
  }): Promise<any[]> {
    let query = this.supabase
      .from(this.sessionTableName)
      .select("*")
      .order("last_active", { ascending: false });

    if (props.userId) {
      query = query.eq("user_id", props.userId);
    }

    if (props.proposalId) {
      query = query.eq("proposal_id", props.proposalId);
    }

    if (props.status) {
      query = query.eq("status", props.status);
    }

    if (props.limit) {
      query = query.limit(props.limit);
    }

    const { data, error } = await query;

    if (error) {
      logger.error(`Error listing sessions: ${error.message}`);
      return [];
    }

    return data || [];
  }
}

/**
 * SQL to create the necessary tables in Supabase
 * 
 * -- Create proposal_checkpoints table for storing LangGraph checkpoints
 * create table proposal_checkpoints (
 *   id bigint primary key generated always as identity,
 *   thread_id text unique not null,
 *   checkpoint_data jsonb not null,
 *   created_at timestamp with time zone default now() not null,
 *   updated_at timestamp with time zone default now() not null
 * );
 * 
 * -- Create proposal_sessions table for tracking session metadata
 * create table proposal_sessions (
 *   id bigint primary key generated always as identity,
 *   thread_id text unique not null references proposal_checkpoints(thread_id) on delete cascade,
 *   proposal_id text not null,
 *   user_id uuid not null references auth.users(id) on delete cascade,
 *   created_at timestamp with time zone default now() not null,
 *   last_active timestamp with time zone default now() not null,
 *   status text not null,
 *   metadata jsonb default '{}'::jsonb not null
 * );
 * 
 * -- Create indexes for performance
 * create index proposal_checkpoints_thread_id_idx on proposal_checkpoints(thread_id);
 * create index proposal_sessions_user_id_idx on proposal_sessions(user_id);
 * create index proposal_sessions_proposal_id_idx on proposal_sessions(proposal_id);
 * create index proposal_sessions_status_idx on proposal_sessions(status);
 * create index proposal_sessions_last_active_idx on proposal_sessions(last_active);
 * 
 * -- Set up Row Level Security
 * alter table proposal_checkpoints enable row level security;
 * alter table proposal_sessions enable row level security;
 * 
 * -- Create policies for proposal_checkpoints
 * create policy "Users can view their own checkpoints"
 * on proposal_checkpoints for select
 * using (
 *   auth.uid() in (
 *     select user_id from proposal_sessions
 *     where proposal_sessions.thread_id = proposal_checkpoints.thread_id
 *   )
 * );
 * 
 * create policy "Users can create their own checkpoints"
 * on proposal_checkpoints for insert
 * with check (
 *   auth.uid() in (
 *     select user_id from proposal_sessions
 *     where proposal_sessions.thread_id = proposal_checkpoints.thread_id
 *   )
 * );
 * 
 * create policy "Users can update their own checkpoints"
 * on proposal_checkpoints for update
 * using (
 *   auth.uid() in (
 *     select user_id from proposal_sessions
 *     where proposal_sessions.thread_id = proposal_checkpoints.thread_id
 *   )
 * );
 * 
 * create policy "Users can delete their own checkpoints"
 * on proposal_checkpoints for delete
 * using (
 *   auth.uid() in (
 *     select user_id from proposal_sessions
 *     where proposal_sessions.thread_id = proposal_checkpoints.thread_id
 *   )
 * );
 * 
 * -- Create policies for proposal_sessions
 * create policy "Users can view their own sessions"
 * on proposal_sessions for select
 * using (auth.uid() = user_id);
 * 
 * create policy "Users can create their own sessions"
 * on proposal_sessions for insert
 * with check (auth.uid() = user_id);
 * 
 * create policy "Users can update their own sessions"
 * on proposal_sessions for update
 * using (auth.uid() = user_id);
 * 
 * create policy "Users can delete their own sessions"
 * on proposal_sessions for delete
 * using (auth.uid() = user_id);
 */