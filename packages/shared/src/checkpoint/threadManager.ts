/**
 * Thread ID management for proposal sessions
 *
 * This utility helps generate, validate, and manage thread IDs for proposal sessions.
 * It ensures consistent naming conventions and provides helper methods for thread
 * namespaces used with the checkpoint system.
 */

import { v4 as uuidv4 } from "uuid";

/**
 * Format for thread ID strings
 */
export interface ThreadIdFormat {
  /**
   * The user ID (from authentication)
   */
  userId: string;

  /**
   * The proposal ID
   */
  proposalId: string;

  /**
   * Optional subgraph identifier
   */
  subgraph?: string;
}

/**
 * Thread manager for proposal sessions
 */
export class ThreadManager {
  private checkpointer: {
    listNamespaces: (op: {
      match: string;
      matchType: string;
    }) => Promise<string[]>;
    get: (op: { namespace: string }) => Promise<any>;
  };

  /**
   * Create a new ThreadManager instance
   *
   * @param checkpointer The checkpoint store instance
   */
  constructor(checkpointer: {
    listNamespaces: (op: {
      match: string;
      matchType: string;
    }) => Promise<string[]>;
    get: (op: { namespace: string }) => Promise<any>;
  }) {
    this.checkpointer = checkpointer;
  }

  /**
   * Generate a new thread ID
   *
   * @param format Thread ID format parameters
   * @returns A formatted thread ID string
   */
  static generateThreadId(format: ThreadIdFormat): string {
    const { userId, proposalId, subgraph } = format;
    const base = `proposal:${proposalId}:user:${userId}`;

    if (subgraph) {
      return `${base}:subgraph:${subgraph}`;
    }

    return base;
  }

  /**
   * Generate a new proposal ID
   *
   * @returns A new UUID for a proposal
   */
  static generateProposalId(): string {
    return uuidv4();
  }

  /**
   * Extract components from a thread ID
   *
   * @param threadId The thread ID to parse
   * @returns Parsed components or null if invalid format
   */
  static parseThreadId(threadId: string): ThreadIdFormat | null {
    // Expected format: proposal:{proposalId}:user:{userId}[:subgraph:{subgraph}]
    const regex = /^proposal:([^:]+):user:([^:]+)(?::subgraph:(.+))?$/;
    const match = threadId.match(regex);

    if (!match) {
      return null;
    }

    const [, proposalId, userId, subgraph] = match;

    return {
      proposalId,
      userId,
      subgraph: subgraph || undefined,
    };
  }

  /**
   * Check if a thread ID is valid
   *
   * @param threadId The thread ID to validate
   * @returns True if the thread ID matches the expected format
   */
  static isValidThreadId(threadId: string): boolean {
    return ThreadManager.parseThreadId(threadId) !== null;
  }

  /**
   * Get all thread IDs for a specific proposal
   *
   * @param checkpointer The checkpoint store instance
   * @param proposalId The proposal ID to search for
   * @returns Promise resolving to an array of thread IDs
   */
  static async getProposalThreadIds(
    checkpointer: {
      listNamespaces: (op: {
        match: string;
        matchType: string;
      }) => Promise<string[]>;
    },
    proposalId: string
  ): Promise<string[]> {
    try {
      // Search for all thread IDs that contain this proposal ID
      const threadIds = await checkpointer.listNamespaces({
        match: `proposal:${proposalId}:`,
        matchType: "PREFIX",
      });

      return threadIds;
    } catch (error) {
      console.error("Failed to get proposal thread IDs:", error);
      return [];
    }
  }

  /**
   * Create a namespace path for a specific thread and channel
   *
   * @param threadId The thread ID
   * @param channel Optional channel name
   * @returns Formatted namespace path
   */
  static createNamespacePath(threadId: string, channel?: string): string {
    if (channel) {
      return `${threadId}:channel:${channel}`;
    }

    return threadId;
  }

  /**
   * Create a thread for a proposal
   *
   * @param params Parameters for thread creation
   * @returns The created thread ID
   */
  async createThread(params: {
    proposalId: string;
    userId: string;
    subgraph?: string;
  }): Promise<string> {
    const threadId = ThreadManager.generateThreadId({
      proposalId: params.proposalId,
      userId: params.userId,
      subgraph: params.subgraph,
    });

    // Store some basic metadata about this thread
    const namespace = ThreadManager.createNamespacePath(threadId);
    await this.checkpointer.get({ namespace });

    return threadId;
  }

  /**
   * Get the thread ID for a specific proposal
   *
   * @param proposalId The proposal ID
   * @returns The primary thread ID for the proposal, or null if not found
   */
  async getThreadForProposal(proposalId: string): Promise<string | null> {
    try {
      const threadIds = await ThreadManager.getProposalThreadIds(
        this.checkpointer,
        proposalId
      );

      if (threadIds.length === 0) {
        return null;
      }

      // Find the main thread (one without a subgraph)
      for (const threadId of threadIds) {
        const parsed = ThreadManager.parseThreadId(threadId);
        if (parsed && !parsed.subgraph) {
          return threadId;
        }
      }

      // If no main thread, just return the first one
      return threadIds[0];
    } catch (error) {
      console.error("Failed to get thread for proposal:", error);
      return null;
    }
  }
}
