/**
 * ICheckpointer Interface
 *
 * Defines the standard interface for checkpoint persistence in the proposal generation system.
 * This interface ensures consistent persistence behavior across different storage implementations.
 */

import { RunnableConfig } from "@langchain/core/runnables";
import { Checkpoint, CheckpointMetadata } from "@langchain/langgraph";

/**
 * Interface for checkpoint persistence operations
 */
export interface ICheckpointer {
  /**
   * Retrieve a checkpoint by thread_id from the persistence layer
   *
   * @param config - The runnable configuration containing thread_id
   * @returns The checkpoint if found, undefined otherwise
   */
  get(config: RunnableConfig): Promise<Checkpoint | undefined>;

  /**
   * Store a checkpoint by thread_id in the persistence layer
   *
   * @param config - The runnable configuration containing thread_id
   * @param checkpoint - The checkpoint data to store
   * @param metadata - Metadata about the checkpoint
   * @param newVersions - Information about new versions (implementation-specific)
   * @returns The updated runnable config
   */
  put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    newVersions: unknown
  ): Promise<RunnableConfig>;

  /**
   * Delete a checkpoint by thread_id
   *
   * @param threadId - The thread ID to delete
   */
  delete(threadId: string): Promise<void>;

  /**
   * List checkpoint namespaces matching a pattern
   *
   * @param match - Optional pattern to match
   * @param matchType - Optional type of matching to perform
   * @returns Array of namespace strings
   */
  listNamespaces(match?: string, matchType?: string): Promise<string[]>;

  /**
   * Generate a consistent thread ID
   *
   * @param proposalId - The proposal ID
   * @param componentName - Optional component name (default: "proposal")
   * @returns A formatted thread ID
   */
  generateThreadId?(proposalId: string, componentName?: string): string;
}

/**
 * Extended interface for Checkpointer with user and proposal ID management
 */
export interface IExtendedCheckpointer extends ICheckpointer {
  /**
   * Get all checkpoints for a user
   *
   * @param userId - The user ID
   * @returns Array of checkpoint data with metadata
   */
  getUserCheckpoints(userId: string): Promise<CheckpointSummary[]>;

  /**
   * Get all checkpoints for a proposal
   *
   * @param proposalId - The proposal ID
   * @returns Array of checkpoint data with metadata
   */
  getProposalCheckpoints(proposalId: string): Promise<CheckpointSummary[]>;
}

/**
 * Summary information about a checkpoint
 */
export interface CheckpointSummary {
  threadId: string;
  userId: string;
  proposalId: string;
  lastUpdated: Date;
  size: number;
}

/**
 * Configuration options for checkpointer implementations
 */
export interface CheckpointerConfig {
  maxRetries?: number;
  retryDelayMs?: number;
  logger?: Console;
  userIdGetter?: () => Promise<string | null>;
  proposalIdGetter?: (threadId: string) => Promise<string | null>;
}
