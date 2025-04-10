import { StateGraph } from "@langchain/langgraph";
import { Serialized } from "@langchain/core/load/serializable";
import { serverSupabase } from "../supabase-client.js";

/**
 * Interface for agent state checkpoint data
 */
export interface AgentStateCheckpoint {
  id?: string;
  agent_type: string;
  user_id: string;
  state: Serialized;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

/**
 * Options for the SupabaseStateStore constructor
 */
export interface SupabaseStateStoreOptions {
  /**
   * Table name in Supabase (defaults to "proposal_states")
   */
  tableName?: string;

  /**
   * Optional metadata to include with all state records
   */
  defaultMetadata?: Record<string, any>;

  /**
   * Enable debug logging
   */
  debug?: boolean;
}

/**
 * Class for storing LangGraph state in Supabase
 * Implements persistence layer for checkpointing and recovery
 */
export class SupabaseStateStore {
  private readonly tableName: string;
  private readonly defaultMetadata: Record<string, any>;
  private readonly debug: boolean;

  /**
   * Create a new SupabaseStateStore
   * @param options Configuration options
   */
  constructor(options: SupabaseStateStoreOptions = {}) {
    this.tableName = options.tableName || "proposal_states";
    this.defaultMetadata = options.defaultMetadata || {};
    this.debug = options.debug || false;
  }

  /**
   * Save a state checkpoint to Supabase
   * @param threadId Unique thread identifier
   * @param agentType Type of agent (e.g., "proposal_agent")
   * @param userId User ID associated with this state
   * @param state Serialized state object
   * @param metadata Additional metadata to store
   * @returns ID of the saved checkpoint
   */
  async saveCheckpoint(
    threadId: string,
    agentType: string,
    userId: string,
    state: Serialized,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    try {
      // Combine default and custom metadata
      const combinedMetadata = {
        ...this.defaultMetadata,
        ...metadata,
        threadId,
      };

      const payload: AgentStateCheckpoint = {
        id: threadId, // Use threadId as the primary key
        agent_type: agentType,
        user_id: userId,
        state,
        metadata: combinedMetadata,
      };

      if (this.debug) {
        console.log(`Saving checkpoint for thread ${threadId}`);
      }

      const { data, error } = await serverSupabase
        .from(this.tableName)
        .upsert(payload, { onConflict: "id" })
        .select("id")
        .single();

      if (error) {
        throw new Error(`Failed to save checkpoint: ${error.message}`);
      }

      return data.id;
    } catch (err) {
      console.error("Error saving checkpoint:", err);
      throw err;
    }
  }

  /**
   * Load a state checkpoint from Supabase
   * @param threadId Unique thread identifier
   * @returns The saved state checkpoint or null if not found
   */
  async loadCheckpoint(threadId: string): Promise<AgentStateCheckpoint | null> {
    try {
      if (this.debug) {
        console.log(`Loading checkpoint for thread ${threadId}`);
      }

      const { data, error } = await serverSupabase
        .from(this.tableName)
        .select("*")
        .eq("id", threadId)
        .single();

      if (error) {
        // If the error is because no rows were returned, return null
        if (error.code === "PGRST116") {
          return null;
        }
        throw new Error(`Failed to load checkpoint: ${error.message}`);
      }

      return data as AgentStateCheckpoint;
    } catch (err) {
      console.error("Error loading checkpoint:", err);
      throw err;
    }
  }

  /**
   * Delete a state checkpoint from Supabase
   * @param threadId Unique thread identifier
   * @returns Whether the deletion was successful
   */
  async deleteCheckpoint(threadId: string): Promise<boolean> {
    try {
      if (this.debug) {
        console.log(`Deleting checkpoint for thread ${threadId}`);
      }

      const { error } = await serverSupabase
        .from(this.tableName)
        .delete()
        .eq("id", threadId);

      if (error) {
        throw new Error(`Failed to delete checkpoint: ${error.message}`);
      }

      return true;
    } catch (err) {
      console.error("Error deleting checkpoint:", err);
      throw err;
    }
  }

  /**
   * List all checkpoints for a user
   * @param userId User ID to filter by
   * @param agentType Optional agent type to filter by
   * @returns Array of checkpoint summaries
   */
  async listCheckpoints(
    userId: string,
    agentType?: string
  ): Promise<
    Pick<
      AgentStateCheckpoint,
      "id" | "agent_type" | "metadata" | "updated_at"
    >[]
  > {
    try {
      let query = serverSupabase
        .from(this.tableName)
        .select("id, agent_type, metadata, updated_at")
        .eq("user_id", userId);

      if (agentType) {
        query = query.eq("agent_type", agentType);
      }

      const { data, error } = await query.order("updated_at", {
        ascending: false,
      });

      if (error) {
        throw new Error(`Failed to list checkpoints: ${error.message}`);
      }

      return data;
    } catch (err) {
      console.error("Error listing checkpoints:", err);
      throw err;
    }
  }

  /**
   * Setup persistence for a StateGraph
   * @param graph LangGraph StateGraph instance
   * @param threadId Unique thread identifier
   * @param userId User ID associated with this graph
   * @param metadata Additional metadata to store
   */
  configureGraphPersistence(
    graph: StateGraph<any, any>,
    threadId: string,
    userId: string,
    metadata: Record<string, any> = {}
  ): void {
    const agentType = metadata.agentType || "default_agent";

    // Configure checkpointing callbacks
    graph.addCheckpointCallback(async (state) => {
      await this.saveCheckpoint(
        threadId,
        agentType,
        userId,
        state as Serialized,
        metadata
      );

      if (this.debug) {
        console.log(`Checkpoint saved for thread ${threadId}`);
      }

      return state;
    });
  }
}
