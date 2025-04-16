/**
 * LangGraphJS Checkpointer Adapter
 *
 * This adapter implements the BaseCheckpointSaver interface required by LangGraph,
 * wrapping our custom SupabaseCheckpointer implementation.
 */
import { BaseCheckpointSaver } from "@langchain/langgraph";
import { SupabaseCheckpointer } from "./supabase-checkpointer.js";

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
   * Store a checkpoint
   *
   * @param threadId The thread ID
   * @param checkpoint The checkpoint data
   */
  async put(threadId: string, checkpoint: object): Promise<void> {
    return this.checkpointer.put(threadId, checkpoint);
  }

  /**
   * Retrieve a checkpoint
   *
   * @param threadId The thread ID
   * @returns The checkpoint data or null if not found
   */
  async get(threadId: string): Promise<object | null> {
    return this.checkpointer.get(threadId);
  }

  /**
   * List all checkpoints
   *
   * @returns A list of thread IDs
   */
  async list(): Promise<string[]> {
    return this.checkpointer.list();
  }

  /**
   * Delete a checkpoint
   *
   * @param threadId The thread ID
   */
  async delete(threadId: string): Promise<void> {
    return this.checkpointer.delete(threadId);
  }
}
