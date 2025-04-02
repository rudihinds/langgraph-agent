/**
 * ProposalManager class
 *
 * Manages proposal state operations using the PostgresCheckpointer for persistence.
 * Handles proposal creation, state validation, and retrieval of proposals.
 */

import { v4 as uuidv4 } from "uuid";
import { SupabaseClient } from "@supabase/supabase-js";
import { PostgresCheckpointer } from "./PostgresCheckpointer";
import {
  ProposalStateType,
  defaultProposalState,
} from "../state/proposalState";
import { serializeState, deserializeState } from "./serializers";
import { ThreadManager } from "./threadManager";

/**
 * Configuration for the ProposalManager
 */
export interface ProposalManagerConfig {
  /**
   * PostgresCheckpointer instance
   */
  checkpointer: PostgresCheckpointer;

  /**
   * ThreadManager instance
   */
  threadManager: ThreadManager;

  /**
   * Optional Supabase client for direct table operations
   */
  supabaseClient?: SupabaseClient;
}

/**
 * Proposal creation parameters
 */
export interface CreateProposalParams {
  /**
   * Title of the proposal
   */
  title: string;

  /**
   * User ID who owns the proposal
   */
  userId: string;

  /**
   * Optional initial state to override defaults
   */
  initialState?: Partial<ProposalStateType>;
}

/**
 * Proposal update parameters
 */
export interface UpdateProposalParams {
  /**
   * ID of the proposal to update
   */
  proposalId: string;

  /**
   * User ID who owns the proposal
   */
  userId: string;

  /**
   * Partial state updates to apply
   */
  updates: Partial<ProposalStateType>;
}

/**
 * Manages proposal states using the PostgresCheckpointer
 */
export class ProposalManager {
  private checkpointer: PostgresCheckpointer;
  private threadManager: ThreadManager;
  private supabaseClient?: SupabaseClient;

  /**
   * Create a new ProposalManager
   * @param config Configuration options
   */
  constructor(config: ProposalManagerConfig) {
    this.checkpointer = config.checkpointer;
    this.threadManager = config.threadManager;
    this.supabaseClient = config.supabaseClient;
  }

  /**
   * Create a new proposal with initial state
   * @param params Creation parameters
   * @returns The proposal ID and thread ID
   */
  async createProposal(params: CreateProposalParams): Promise<{
    proposalId: string;
    threadId: string;
  }> {
    // Generate a new proposal ID
    const proposalId = uuidv4();

    // Create a thread for this proposal
    const threadId = await this.threadManager.createThread({
      proposalId,
      userId: params.userId,
    });

    // Create initial state by merging defaults with any provided values
    const initialState: ProposalStateType = {
      ...defaultProposalState,
      ...(params.initialState || {}),
      metadata: {
        ...defaultProposalState.metadata,
        ...(params.initialState?.metadata || {}),
        proposalId,
        userId: params.userId,
        proposalTitle: params.title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };

    // Create namespace for this proposal
    const namespace = `proposal:${proposalId}`;

    // Serialize and save the initial state
    await this.checkpointer.put({
      namespace,
      state: await serializeState(initialState),
      writes: null,
    });

    return { proposalId, threadId };
  }

  /**
   * Get a proposal's current state
   * @param proposalId The proposal ID
   * @returns The proposal state or null if not found
   */
  async getProposal(proposalId: string): Promise<ProposalStateType | null> {
    const namespace = `proposal:${proposalId}`;

    const checkpoint = await this.checkpointer.get({ namespace });

    if (!checkpoint) {
      return null;
    }

    // Deserialize the state
    return deserializeState(checkpoint.state as any);
  }

  /**
   * Update a proposal state with partial updates
   * @param params Update parameters
   * @returns The updated proposal state
   */
  async updateProposal(
    params: UpdateProposalParams
  ): Promise<ProposalStateType> {
    const { proposalId, userId, updates } = params;

    // Get the current state
    const currentState = await this.getProposal(proposalId);

    if (!currentState) {
      throw new Error(`Proposal not found: ${proposalId}`);
    }

    // Verify ownership
    if (currentState.metadata.userId !== userId) {
      throw new Error("User does not have permission to update this proposal");
    }

    // Always update the updatedAt timestamp
    const updatedState: ProposalStateType = {
      ...currentState,
      ...updates,
      metadata: {
        ...currentState.metadata,
        ...(updates.metadata || {}),
        updatedAt: new Date().toISOString(),
      },
    };

    // Save the updated state
    const namespace = `proposal:${proposalId}`;
    await this.checkpointer.put({
      namespace,
      state: await serializeState(updatedState),
      writes: null,
    });

    return updatedState;
  }

  /**
   * List all proposals for a user
   * @param userId The user ID
   * @returns Array of proposals with basic metadata
   */
  async listUserProposals(userId: string): Promise<
    Array<{
      proposalId: string;
      title: string;
      createdAt: string;
      updatedAt: string;
      currentPhase: string;
    }>
  > {
    // Check if we have a direct Supabase client (more efficient)
    if (this.supabaseClient) {
      const { data, error } = await this.supabaseClient
        .from("proposal_checkpoints")
        .select("proposal_id, namespace, state, created_at, updated_at")
        .eq("user_id", userId);

      if (error) {
        throw new Error(`Failed to list proposals: ${error.message}`);
      }

      // Extract and deserialize the minimal information needed
      return Promise.all(
        data.map(async (row) => {
          const state = await deserializeState(JSON.parse(row.state));
          return {
            proposalId: row.proposal_id,
            title: state.metadata.proposalTitle || "Untitled Proposal",
            createdAt: state.metadata.createdAt,
            updatedAt: state.metadata.updatedAt,
            currentPhase: state.currentPhase,
          };
        })
      );
    }

    // Fallback to using the checkpointer
    const namespaces = await this.checkpointer.listNamespaces({
      match: "proposal:",
      matchType: "PREFIX",
    });

    // For each namespace, get the state and extract metadata
    const proposals = await Promise.all(
      namespaces.map(async (namespace) => {
        const checkpoint = await this.checkpointer.get({ namespace });
        if (!checkpoint) return null;

        const state = await deserializeState(checkpoint.state as any);

        // Skip proposals that don't belong to this user
        if (state.metadata.userId !== userId) return null;

        return {
          proposalId: state.metadata.proposalId,
          title: state.metadata.proposalTitle || "Untitled Proposal",
          createdAt: state.metadata.createdAt,
          updatedAt: state.metadata.updatedAt,
          currentPhase: state.currentPhase,
        };
      })
    );

    // Filter out null values (proposals that don't belong to this user)
    return proposals.filter((p): p is NonNullable<typeof p> => p !== null);
  }

  /**
   * Delete a proposal
   * @param proposalId The proposal ID
   * @param userId The user ID (for authorization)
   * @returns True if deleted successfully
   */
  async deleteProposal(proposalId: string, userId: string): Promise<boolean> {
    // Get the current state
    const currentState = await this.getProposal(proposalId);

    if (!currentState) {
      throw new Error(`Proposal not found: ${proposalId}`);
    }

    // Verify ownership
    if (currentState.metadata.userId !== userId) {
      throw new Error("User does not have permission to delete this proposal");
    }

    // If we have direct access to Supabase, use it (more efficient)
    if (this.supabaseClient) {
      const { error } = await this.supabaseClient
        .from("proposal_checkpoints")
        .delete()
        .eq("proposal_id", proposalId)
        .eq("user_id", userId);

      if (error) {
        throw new Error(`Failed to delete proposal: ${error.message}`);
      }

      return true;
    }

    // No direct Supabase access, we can't delete through the checkpointer
    // This is a limitation of the BaseCheckpointSaver interface
    throw new Error(
      "Direct database access is required for deletion operations"
    );
  }

  /**
   * Validate a proposal state for consistency
   * @param state The state to validate
   * @returns An array of validation errors, empty if valid
   */
  validateProposalState(state: ProposalStateType): string[] {
    const errors: string[] = [];

    // Check required metadata
    if (!state.metadata.proposalId) {
      errors.push("Missing proposal ID in metadata");
    }

    if (!state.metadata.userId) {
      errors.push("Missing user ID in metadata");
    }

    // Check for malformed content in key fields
    if (state.messages && !Array.isArray(state.messages)) {
      errors.push("Messages must be an array");
    }

    if (state.connectionPairs && !Array.isArray(state.connectionPairs)) {
      errors.push("Connection pairs must be an array");
    }

    // Validate section status values
    const validStatusValues = [
      "not_started",
      "in_progress",
      "needs_review",
      "completed",
      "rejected",
    ];

    for (const [key, value] of Object.entries(state.sectionStatus)) {
      if (!validStatusValues.includes(value)) {
        errors.push(
          `Invalid status "${value}" for section "${key}". Must be one of: ${validStatusValues.join(
            ", "
          )}`
        );
      }
    }

    // Validate phase value
    const validPhases = [
      "research",
      "connection_pairs",
      "section_generation",
      "review",
      "complete",
    ];

    if (!validPhases.includes(state.currentPhase)) {
      errors.push(
        `Invalid phase "${state.currentPhase}". Must be one of: ${validPhases.join(
          ", "
        )}`
      );
    }

    return errors;
  }
}
