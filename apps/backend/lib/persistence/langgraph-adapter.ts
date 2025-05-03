/**
 * LangGraphJS Checkpointer Adapter
 *
 * This adapter implements the BaseCheckpointSaver interface required by LangGraph,
 * wrapping our custom SupabaseCheckpointer implementation.
 */
import {
  BaseCheckpointSaver,
  type Checkpoint,
  type CheckpointMetadata,
  type CheckpointSaved,
  type RunnableConfig,
} from "@langchain/langgraph";
import { SupabaseCheckpointer } from "./supabase-checkpointer.js";

// Placeholder for ChannelVersions until import path is resolved
// We will use 'any' for now
type ChannelVersions = any;

/**
 * LangGraph-compatible adapter for SupabaseCheckpointer
 * Implements the BaseCheckpointSaver interface
 */
export class LangGraphCheckpointer implements BaseCheckpointSaver {
  private checkpointer: SupabaseCheckpointer;

  constructor(checkpointer: SupabaseCheckpointer) {
    this.checkpointer = checkpointer;
  }

  /**
   * Store a checkpoint following the BaseCheckpointSaver interface.
   *
   * @param config RunnableConfig containing thread_id
   * @param checkpoint The checkpoint data
   * @param metadata Additional metadata (currently ignored by underlying checkpointer)
   * @param newVersions Channel versions (currently ignored by underlying checkpointer)
   * @returns The input RunnableConfig as required by the interface.
   */
  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    newVersions: ChannelVersions
  ): Promise<RunnableConfig> {
    const threadId = config.configurable?.thread_id;
    if (!threadId) {
      throw new Error("thread_id missing from config.configurable");
    }
    // Underlying checkpointer uses non-standard signature, ignores metadata and newVersions
    await this.checkpointer.put(threadId, checkpoint);
    // Return the config as per BaseCheckpointSaver interface
    return config;
  }

  /**
   * Retrieve a checkpoint following the BaseCheckpointSaver interface.
   *
   * @param config RunnableConfig containing thread_id
   * @returns The checkpoint data wrapped as CheckpointSaved, or null if not found
   */
  async get(config: RunnableConfig): Promise<CheckpointSaved | null> {
    const threadId = config.configurable?.thread_id;
    if (!threadId) {
      throw new Error("thread_id missing from config.configurable");
    }
    const checkpoint = await this.checkpointer.get(threadId);

    // The standard interface expects CheckpointSaved | null.
    // We need to adapt the return type if the underlying 'get' returns just the checkpoint.
    // Assuming the underlying checkpointer.get returns the Checkpoint object or null.
    if (checkpoint) {
      // Construct a CheckpointSaved object. Requires metadata, which we don't have stored.
      // We'll return a minimal CheckpointSaved structure.
      // TODO: Revisit if metadata persistence becomes necessary.
      return {
        checkpoint: checkpoint as Checkpoint, // Cast underlying result
        metadata: {
          source: "supabase",
          ts: new Date().toISOString(),
          thread_id: threadId,
        }, // Provide minimal metadata
        versions_seen: {}, // Provide empty placeholder
        pending_sends: [], // Provide empty placeholder
      };
    }
    return null;
  }

  /**
   * List all checkpoints (assuming underlying checkpointer lists thread IDs)
   *
   * @returns A list of thread IDs wrapped as RunnableConfig stubs
   * TODO: Verify if BaseCheckpointSaver expects a different return type for list()
   */
  async list(config?: RunnableConfig | undefined): Promise<RunnableConfig[]> {
    const threadIds = await this.checkpointer.list();
    // Convert thread IDs to RunnableConfig stubs as expected by BaseCheckpointSaver
    return threadIds.map((tid) => ({ configurable: { thread_id: tid } }));
  }

  /**
   * Delete a checkpoint
   *
   * @param config RunnableConfig containing thread_id
   */
  async delete(config: RunnableConfig): Promise<void> {
    const threadId = config.configurable?.thread_id;
    if (!threadId) {
      throw new Error("thread_id missing from config.configurable");
    }
    return this.checkpointer.delete(threadId);
  }
}
