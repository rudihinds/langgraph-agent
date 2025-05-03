/**
 * Memory-based LangGraph adapter for testing
 *
 * This adapter wraps our InMemoryCheckpointer implementation to make it
 * compatible with LangGraph's BaseCheckpointSaver interface.
 */

import {
  BaseCheckpointSaver,
  Checkpoint,
  CheckpointMetadata,
  CheckpointSaved,
  type SupportedSerializers,
} from "@langchain/langgraph";
import { RunnableConfig } from "@langchain/core/runnables";
import { InMemoryCheckpointer } from "./memory-checkpointer.js";

// Placeholder for ChannelVersions until import path is resolved
// We will use 'any' for now
type ChannelVersions = any;

/**
 * MemoryLangGraphCheckpointer adapter class
 *
 * This class adapts our InMemoryCheckpointer to match LangGraph's BaseCheckpointSaver interface.
 */
export class MemoryLangGraphCheckpointer extends BaseCheckpointSaver {
  private checkpointer: InMemoryCheckpointer;

  /**
   * Create a new MemoryLangGraphCheckpointer
   *
   * @param checkpointer The InMemoryCheckpointer instance to wrap
   */
  constructor(checkpointer: InMemoryCheckpointer) {
    super();
    this.checkpointer = checkpointer;
  }

  /**
   * Get a checkpoint by thread_id from config
   *
   * @param config The runnable configuration containing thread_id
   * @returns The checkpoint data wrapped as CheckpointSaved, or null if not found
   */
  async get(config: RunnableConfig): Promise<CheckpointSaved | null> {
    const checkpoint = await this.checkpointer.get(config);
    const threadId = config.configurable?.thread_id;

    if (checkpoint && threadId) {
      return {
        checkpoint: checkpoint,
        metadata: {
          source: "memory",
          ts: new Date().toISOString(),
          thread_id: threadId,
        },
        versions_seen: {},
        pending_sends: [],
      };
    }
    return null;
  }

  /**
   * Store a checkpoint by thread_id
   *
   * @param config The runnable configuration containing thread_id
   * @param checkpoint The checkpoint data to store
   * @param metadata Metadata about the checkpoint
   * @param newVersions Information about new versions
   * @returns The updated runnable config
   */
  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    newVersions: ChannelVersions
  ): Promise<RunnableConfig> {
    return this.checkpointer.put(config, checkpoint, metadata, newVersions);
  }

  /**
   * List checkpoint namespaces (thread IDs) as RunnableConfig stubs.
   *
   * @param config Optional config (currently unused by underlying listNamespaces)
   * @returns Array of RunnableConfig stubs containing thread IDs.
   */
  async list(config?: RunnableConfig): Promise<RunnableConfig[]> {
    const threadIds = await this.checkpointer.listNamespaces();
    return threadIds.map((tid) => ({ configurable: { thread_id: tid } }));
  }

  /**
   * Not used in this implementation, but required by the LangGraph interface.
   * Returns an empty tuple by default.
   */
  async getTuple(
    _namespace: string,
    _key: string
  ): Promise<[SupportedSerializers, unknown] | undefined> {
    return undefined;
  }

  /**
   * Not used in this implementation, but required by the LangGraph interface
   */
  async putWrites(
    _writes: Map<string, Map<string, [SupportedSerializers, unknown]>>,
    _versions: Map<string, Map<string, number>> = new Map()
  ): Promise<void> {
    // Not used in this implementation
  }

  /**
   * Not used in this implementation, but required by the LangGraph interface
   */
  async getNextVersion(
    _namespace: string,
    _key: string
  ): Promise<number | undefined> {
    return 0;
  }

  /**
   * Delete a checkpoint by thread_id from config.
   *
   * @param config Config containing the thread_id
   */
  async delete(config: RunnableConfig): Promise<void> {
    const threadId = config.configurable?.thread_id as string;

    if (threadId) {
      await this.checkpointer.delete(threadId);
    }
  }
}
