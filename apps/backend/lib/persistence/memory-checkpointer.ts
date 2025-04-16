/**
 * In-Memory Checkpointer
 *
 * A simple in-memory implementation of basic checkpointer functionality
 * for testing and fallback scenarios when Supabase is not available.
 */
// Note: We don't import BaseCheckpointSaver here as this is our basic implementation
// The adapter classes handle the LangGraph interface compatibility

/**
 * Simple in-memory checkpointer implementation
 * Only suitable for testing - does not persist across server restarts!
 */
export class InMemoryCheckpointer {
  private checkpoints: Record<string, unknown> = {};

  /**
   * Store a checkpoint
   *
   * @param threadId - Thread ID to store the checkpoint under
   * @param checkpoint - Checkpoint data to store
   * @returns The stored checkpoint
   */
  async put(threadId: string, checkpoint: unknown): Promise<unknown> {
    this.checkpoints[threadId] = checkpoint;
    return checkpoint;
  }

  /**
   * Retrieve a checkpoint
   *
   * @param threadId - Thread ID to retrieve the checkpoint for
   * @returns The checkpoint data, or null if not found
   */
  async get(threadId: string): Promise<unknown> {
    return this.checkpoints[threadId] || null;
  }

  /**
   * List all thread IDs with checkpoints
   *
   * @returns Array of thread IDs
   */
  async list(): Promise<string[]> {
    return Object.keys(this.checkpoints);
  }

  /**
   * List checkpoint namespaces matching a pattern
   *
   * @param match Optional pattern to match
   * @param matchType Optional type of matching to perform
   * @returns Array of namespace strings
   */
  async listNamespaces(match?: string, matchType?: string): Promise<string[]> {
    // For the in-memory implementation, namespaces and thread IDs are the same
    return this.list();
  }

  /**
   * Delete a checkpoint
   *
   * @param threadId - Thread ID to delete the checkpoint for
   */
  async delete(threadId: string): Promise<void> {
    delete this.checkpoints[threadId];
  }
}
