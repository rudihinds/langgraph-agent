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
  type SupportedSerializers,
} from "@langchain/langgraph";
import { RunnableConfig } from "@langchain/core/runnables";
import { InMemoryCheckpointer } from "./memory-checkpointer.js";

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
   * @returns The checkpoint if found, undefined otherwise
   */
  async get(config: RunnableConfig): Promise<Checkpoint | undefined> {
    return this.checkpointer.get(config);
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
    newVersions: unknown
  ): Promise<RunnableConfig> {
    return this.checkpointer.put(config, checkpoint, metadata, newVersions);
  }

  /**
   * List checkpoint namespaces matching a pattern
   *
   * @param match Optional pattern to match
   * @param matchType Optional type of matching to perform
   * @returns Array of namespace strings
   */
  async list(match?: string, matchType?: string): Promise<string[]> {
    return this.checkpointer.listNamespaces(match, matchType);
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
   * Delete a checkpoint
   *
   * @param config Config or thread ID
   */
  async delete(config: RunnableConfig | string): Promise<void> {
    const threadId =
      typeof config === "string"
        ? config
        : (config?.configurable?.thread_id as string);

    if (threadId) {
      await this.checkpointer.delete(threadId);
    }
  }
}
