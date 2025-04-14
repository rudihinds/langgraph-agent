import { SupabaseClient } from "@supabase/supabase-js";
import { serverSupabase } from "./client.js";
import { exponentialBackoff } from "../utils/backoff.js";

/**
 * Configuration options for SupabaseStorage
 */
interface SupabaseStorageOptions {
  /**
   * Name of the table to store checkpoints in
   * @default 'proposal_states'
   */
  tableName?: string;

  /**
   * Custom Supabase client instance
   * If not provided, a server client will be created
   */
  supabaseClient?: SupabaseClient;

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;

  /**
   * Default namespace for the checkpoints
   * @default 'default'
   */
  namespace?: string;
}

/**
 * Interface for stored items
 */
export interface StorageItem {
  [key: string]: unknown;
}

/**
 * Custom storage provider for persisting agent state using Supabase as the backend
 * Used for persisting agent state between runs
 */
export class SupabaseStorage {
  private client: SupabaseClient;
  private tableName: string;
  private debug: boolean;
  private defaultNamespace: string;

  /**
   * Create a new Supabase storage provider
   *
   * @param options Configuration options
   */
  constructor(options: SupabaseStorageOptions = {}) {
    const {
      tableName = "proposal_states",
      supabaseClient,
      debug = false,
      namespace = "default",
    } = options;

    this.client = supabaseClient || serverSupabase;
    this.tableName = tableName;
    this.debug = debug;
    this.defaultNamespace = namespace;

    if (this.debug) {
      console.log(
        `SupabaseStorage initialized with table: ${this.tableName}, namespace: ${this.defaultNamespace}`
      );
    }
  }

  /**
   * Get a checkpoint by ID
   *
   * @param namespace Namespace array for organizing data hierarchically
   * @param key The unique identifier for the checkpoint
   * @returns The checkpoint state or null if not found
   */
  async get(namespace: string[], key: string): Promise<StorageItem | null> {
    try {
      const fullKey = this.getFullKey(namespace, key);

      if (this.debug) {
        console.log(`Getting checkpoint ${fullKey}`);
      }

      const { data, error } = await this.client
        .from(this.tableName)
        .select("state")
        .eq("id", fullKey)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // Not found error
          if (this.debug) {
            console.log(`Checkpoint ${fullKey} not found`);
          }
          return null;
        }

        console.error(`Error retrieving checkpoint ${fullKey}:`, error);
        throw error;
      }

      if (!data) {
        if (this.debug) {
          console.log(`Checkpoint ${fullKey} not found`);
        }
        return null;
      }

      // Parse the JSON state
      const state: StorageItem =
        typeof data.state === "string" ? JSON.parse(data.state) : data.state;

      if (this.debug) {
        console.log(`Retrieved checkpoint ${fullKey}`);
      }

      return state;
    } catch (error) {
      console.error("Error in SupabaseStorage.get:", error);
      throw error;
    }
  }

  /**
   * Store a checkpoint with the given ID
   *
   * @param namespace Namespace array for organizing data hierarchically
   * @param key The unique identifier for the checkpoint
   * @param value The state to store
   */
  async set(
    namespace: string[],
    key: string,
    value: StorageItem
  ): Promise<void> {
    try {
      const fullKey = this.getFullKey(namespace, key);

      if (this.debug) {
        console.log(`Setting checkpoint ${fullKey}`);
      }

      // Convert state to JSON string if it's not already a string
      const stateJson =
        typeof value === "string" ? value : JSON.stringify(value);

      // Current timestamp for updated_at
      const now = new Date().toISOString();

      // Get the namespace string for the agent_type field
      const namespaceString =
        namespace.length > 0 ? namespace.join("/") : this.defaultNamespace;

      // Upsert the checkpoint
      const { error } = await this.client.from(this.tableName).upsert(
        {
          id: fullKey,
          state: stateJson,
          updated_at: now,
          agent_type: namespaceString,
        },
        {
          onConflict: "id",
        }
      );

      if (error) {
        console.error(`Error storing checkpoint ${fullKey}:`, error);
        throw error;
      }

      if (this.debug) {
        console.log(`Stored checkpoint ${fullKey}`);
      }
    } catch (error) {
      console.error("Error in SupabaseStorage.set:", error);
      throw error;
    }
  }

  /**
   * Delete a checkpoint by ID
   *
   * @param namespace Namespace array for organizing data hierarchically
   * @param key The unique identifier for the checkpoint
   */
  async delete(namespace: string[], key: string): Promise<void> {
    try {
      const fullKey = this.getFullKey(namespace, key);

      if (this.debug) {
        console.log(`Deleting checkpoint ${fullKey}`);
      }

      const { error } = await this.client
        .from(this.tableName)
        .delete()
        .eq("id", fullKey);

      if (error) {
        console.error(`Error deleting checkpoint ${fullKey}:`, error);
        throw error;
      }

      if (this.debug) {
        console.log(`Deleted checkpoint ${fullKey}`);
      }
    } catch (error) {
      console.error("Error in SupabaseStorage.delete:", error);
      throw error;
    }
  }

  /**
   * List all checkpoints for a namespace
   *
   * @param namespace Namespace array for organizing data hierarchically
   * @returns Array of checkpoint keys
   */
  async list(namespace: string[]): Promise<string[]> {
    try {
      const namespaceString =
        namespace.length > 0 ? namespace.join("/") : this.defaultNamespace;

      const namespacePrefix =
        namespace.length > 0
          ? `${namespaceString}/`
          : `${this.defaultNamespace}/`;

      if (this.debug) {
        console.log(`Listing checkpoints for namespace '${namespaceString}'`);
      }

      // Match only checkpoints that belong to this namespace
      const { data, error } = await this.client
        .from(this.tableName)
        .select("id")
        .eq("agent_type", namespaceString);

      if (error) {
        console.error(`Error listing checkpoints:`, error);
        throw error;
      }

      // Extract just the keys, removing the namespace prefix
      const keys = data
        .map((item) => {
          // Remove namespace prefix to get the original key
          if (item.id.startsWith(namespacePrefix)) {
            return item.id.substring(namespacePrefix.length);
          }
          return null;
        })
        .filter(Boolean) as string[];

      if (this.debug) {
        console.log(
          `Listed ${keys.length} checkpoints for namespace '${namespaceString}'`
        );
      }

      return keys;
    } catch (error) {
      console.error("Error in SupabaseStorage.list:", error);
      throw error;
    }
  }

  /**
   * Create a full key with namespace
   *
   * @param namespace Namespace array for organizing data hierarchically
   * @param key The base key
   * @returns Namespaced key
   */
  private getFullKey(namespace: string[], key: string): string {
    const namespaceString =
      namespace.length > 0 ? namespace.join("/") : this.defaultNamespace;

    return `${namespaceString}/${key}`;
  }

  /**
   * Connect this storage to a LangGraph Graph instance (helper method)
   *
   * @param graph The LangGraph graph to connect to
   * @param options Configuration options
   * @returns Connection information including threadId and namespace
   */
  connectToGraph(
    graph: any,
    options: {
      /**
       * The user ID associated with this graph
       */
      userId: string;

      /**
       * The proposal ID associated with this graph
       */
      proposalId: string;

      /**
       * Whether to enable checkpointing (default: true)
       */
      enableCheckpointing?: boolean;

      /**
       * Additional metadata to store with checkpoints
       */
      metadata?: Record<string, any>;
    }
  ): { threadId: string; namespace: string[] } {
    const {
      userId,
      proposalId,
      enableCheckpointing = true,
      metadata = {},
    } = options;

    if (!userId || !proposalId) {
      throw new Error(
        "userId and proposalId are required to connect storage to a graph"
      );
    }

    // Generate a standard thread ID format for persistence
    const threadId = `proposal_${proposalId}_${userId}`;

    // Set namespace for this graph instance
    const namespace = ["proposals", proposalId];

    if (this.debug) {
      console.log(
        `Connecting storage to graph with thread ID: ${threadId}, namespace: ${namespace.join("/")}`
      );
    }

    // Add metadata about this session
    const combinedMetadata = {
      ...metadata,
      userId,
      proposalId,
      threadId,
      createdAt: new Date().toISOString(),
    };

    if (enableCheckpointing && graph.addCheckpointCallback) {
      // Set up checkpoint callback to persist state
      graph.addCheckpointCallback(async (state: any) => {
        try {
          await this.set(namespace, threadId, state);

          if (this.debug) {
            console.log(`Saved checkpoint for thread ${threadId}`);
          }
        } catch (error) {
          console.error(
            `Failed to save checkpoint for thread ${threadId}:`,
            error
          );
        }

        return state;
      });

      if (this.debug) {
        console.log(
          `Checkpoint callback configured for graph with thread ID: ${threadId}`
        );
      }
    }

    return { threadId, namespace };
  }

  /**
   * Restore a checkpoint for a graph
   *
   * @param options Options for restoring a checkpoint
   * @returns The restored state or null if not found
   */
  async restoreCheckpoint(options: {
    /**
     * The proposal ID to restore
     */
    proposalId: string;

    /**
     * The user ID associated with the checkpoint
     */
    userId: string;

    /**
     * Custom thread ID (optional, will use standard format if not provided)
     */
    threadId?: string;
  }): Promise<StorageItem | null> {
    const { proposalId, userId, threadId: customThreadId } = options;

    // Use the provided thread ID or generate a standard one
    const threadId = customThreadId || `proposal_${proposalId}_${userId}`;

    // Standard namespace for proposals
    const namespace = ["proposals", proposalId];

    if (this.debug) {
      console.log(
        `Restoring checkpoint for thread ${threadId} in namespace ${namespace.join("/")}`
      );
    }

    try {
      // Try to get the checkpoint from storage
      const state = await this.get(namespace, threadId);

      if (!state) {
        if (this.debug) {
          console.log(`No checkpoint found for thread ${threadId}`);
        }
        return null;
      }

      if (this.debug) {
        console.log(`Successfully restored checkpoint for thread ${threadId}`);
      }

      return state;
    } catch (error) {
      console.error(
        `Error restoring checkpoint for thread ${threadId}:`,
        error
      );
      throw error;
    }
  }
}
