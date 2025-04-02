/**
 * SessionManager class
 *
 * Manages proposal sessions including timeout handling and recovery.
 * Tracks active sessions and provides mechanisms to recover interrupted sessions.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { PostgresCheckpointer } from "./PostgresCheckpointer";
import { ProposalManager } from "./ProposalManager";
import { ThreadManager } from "./threadManager";
import { ProposalStateType } from "../state/proposalState";

/**
 * Configuration for the SessionManager
 */
export interface SessionManagerConfig {
  /**
   * ProposalManager instance
   */
  proposalManager: ProposalManager;

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

  /**
   * Session timeout in milliseconds (default: 30 minutes)
   */
  sessionTimeout?: number;

  /**
   * Time interval in milliseconds to check for active sessions (default: 1 minute)
   */
  checkInterval?: number;

  /**
   * Maximum time in milliseconds a session can be kept alive without activity (default: 24 hours)
   */
  maxSessionLifetime?: number;
}

/**
 * Session metadata stored for active sessions
 */
export interface SessionMetadata {
  /**
   * Session ID
   */
  sessionId: string;

  /**
   * Proposal ID
   */
  proposalId: string;

  /**
   * User ID
   */
  userId: string;

  /**
   * Thread ID
   */
  threadId: string;

  /**
   * Last activity timestamp
   */
  lastActivity: string;

  /**
   * Session creation timestamp
   */
  createdAt: string;

  /**
   * Session state (running, paused, completed, error)
   */
  state: "running" | "paused" | "completed" | "error";

  /**
   * Error details if session is in error state
   */
  errorDetails?: string;

  /**
   * Current phase of the proposal
   */
  currentPhase: string;

  /**
   * Current step within the phase
   */
  currentStep?: string;
}

/**
 * SessionManager manages proposal sessions, handling timeouts and recoveries
 */
export class SessionManager {
  private proposalManager: ProposalManager;
  private checkpointer: PostgresCheckpointer;
  private threadManager: ThreadManager;
  private supabaseClient?: SupabaseClient;
  private sessionTimeout: number;
  private checkInterval: number;
  private maxSessionLifetime: number;
  private activeSessions: Map<string, SessionMetadata>;
  private checkIntervalId: NodeJS.Timeout | null = null;
  private namespace = "proposal_sessions";

  /**
   * Create a new SessionManager
   * @param config Configuration options
   */
  constructor(config: SessionManagerConfig) {
    this.proposalManager = config.proposalManager;
    this.checkpointer = config.checkpointer;
    this.threadManager = config.threadManager;
    this.supabaseClient = config.supabaseClient;
    this.sessionTimeout = config.sessionTimeout || 30 * 60 * 1000; // 30 minutes default
    this.checkInterval = config.checkInterval || 60 * 1000; // 1 minute default
    this.maxSessionLifetime = config.maxSessionLifetime || 24 * 60 * 60 * 1000; // 24 hours default
    this.activeSessions = new Map<string, SessionMetadata>();
  }

  /**
   * Start session management
   */
  public start(): void {
    // Load existing sessions from persistence
    this.loadSessions().catch((error) => {
      console.error("Failed to load sessions:", error);
    });

    // Start the session check interval
    this.checkIntervalId = setInterval(() => {
      this.checkSessions().catch((error) => {
        console.error("Failed to check sessions:", error);
      });
    }, this.checkInterval);
  }

  /**
   * Stop session management
   */
  public stop(): void {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
  }

  /**
   * Create a new session for a proposal
   * @param proposalId Proposal ID
   * @param userId User ID
   * @returns Session ID
   */
  public async createSession(
    proposalId: string,
    userId: string
  ): Promise<string> {
    // Get thread ID for this proposal
    const threadId = await this.threadManager.getThreadForProposal(proposalId);

    if (!threadId) {
      throw new Error(`Thread not found for proposal: ${proposalId}`);
    }

    // Get current proposal state
    const proposal = await this.proposalManager.getProposal(proposalId);

    if (!proposal) {
      throw new Error(`Proposal not found: ${proposalId}`);
    }

    // Verify user has access to this proposal
    if (proposal.metadata.userId !== userId) {
      throw new Error("User does not have access to this proposal");
    }

    // Generate session ID based on proposal and thread
    const sessionId = `session:${proposalId}:${Date.now()}`;

    // Create session metadata
    const sessionMetadata: SessionMetadata = {
      sessionId,
      proposalId,
      userId,
      threadId,
      lastActivity: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      state: "running",
      currentPhase: proposal.currentPhase,
      currentStep: undefined,
    };

    // Store in active sessions map
    this.activeSessions.set(sessionId, sessionMetadata);

    // Persist session
    await this.persistSession(sessionId, sessionMetadata);

    return sessionId;
  }

  /**
   * Record activity for a session to prevent timeout
   * @param sessionId Session ID
   */
  public async recordActivity(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Update last activity timestamp
    session.lastActivity = new Date().toISOString();

    // Update in active sessions map
    this.activeSessions.set(sessionId, session);

    // Persist updated session
    await this.persistSession(sessionId, session);
  }

  /**
   * Update session state
   * @param sessionId Session ID
   * @param updates Updates to apply to session metadata
   */
  public async updateSession(
    sessionId: string,
    updates: Partial<
      Omit<
        SessionMetadata,
        "sessionId" | "proposalId" | "userId" | "threadId" | "createdAt"
      >
    >
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Update session metadata
    const updatedSession: SessionMetadata = {
      ...session,
      ...updates,
      lastActivity: new Date().toISOString(),
    };

    // Update in active sessions map
    this.activeSessions.set(sessionId, updatedSession);

    // Persist updated session
    await this.persistSession(sessionId, updatedSession);
  }

  /**
   * Get active sessions for a user
   * @param userId User ID
   * @returns Array of active session metadata
   */
  public async getUserSessions(userId: string): Promise<SessionMetadata[]> {
    // Convert Map to array and filter by userId
    return Array.from(this.activeSessions.values()).filter(
      (session) => session.userId === userId
    );
  }

  /**
   * Get active sessions for a proposal
   * @param proposalId Proposal ID
   * @returns Array of active session metadata
   */
  public async getProposalSessions(
    proposalId: string
  ): Promise<SessionMetadata[]> {
    // Convert Map to array and filter by proposalId
    return Array.from(this.activeSessions.values()).filter(
      (session) => session.proposalId === proposalId
    );
  }

  /**
   * Get session by ID
   * @param sessionId Session ID
   * @returns Session metadata or null if not found
   */
  public getSession(sessionId: string): SessionMetadata | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Close a session
   * @param sessionId Session ID
   * @param state Final state of the session
   * @param error Optional error details if session ended with error
   */
  public async closeSession(
    sessionId: string,
    state: "completed" | "error" = "completed",
    error?: string
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Update session state
    session.state = state;

    if (error) {
      session.errorDetails = error;
    }

    // Remove from active sessions
    this.activeSessions.delete(sessionId);

    // Persist final session state before removing
    await this.persistSession(sessionId, session);

    // Remove from persistent storage if completed successfully
    if (state === "completed") {
      await this.deleteSession(sessionId);
    }
  }

  /**
   * Recover a session that was interrupted or timed out
   * @param sessionId Session ID
   * @returns Recovered session metadata
   */
  public async recoverSession(sessionId: string): Promise<SessionMetadata> {
    // First check if session is still in memory
    let session = this.activeSessions.get(sessionId);

    // If not in memory, try to load from persistence
    if (!session) {
      session = await this.loadSessionById(sessionId);

      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // Add to active sessions map
      this.activeSessions.set(sessionId, session);
    }

    // Update session state to running
    session.state = "running";
    session.lastActivity = new Date().toISOString();

    // Update in active sessions map
    this.activeSessions.set(sessionId, session);

    // Persist updated session
    await this.persistSession(sessionId, session);

    return session;
  }

  /**
   * Pause a session temporarily
   * @param sessionId Session ID
   * @param reason Optional reason for pausing
   */
  public async pauseSession(sessionId: string, reason?: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Update session state
    session.state = "paused";

    if (reason) {
      session.errorDetails = reason;
    }

    // Update in active sessions map
    this.activeSessions.set(sessionId, session);

    // Persist updated session
    await this.persistSession(sessionId, session);
  }

  /**
   * Resume a paused session
   * @param sessionId Session ID
   */
  public async resumeSession(sessionId: string): Promise<SessionMetadata> {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.state !== "paused") {
      throw new Error(`Session is not paused: ${sessionId}`);
    }

    // Update session state
    session.state = "running";
    session.lastActivity = new Date().toISOString();
    session.errorDetails = undefined;

    // Update in active sessions map
    this.activeSessions.set(sessionId, session);

    // Persist updated session
    await this.persistSession(sessionId, session);

    return session;
  }

  /**
   * Check all active sessions for timeouts
   * @private
   */
  private async checkSessions(): Promise<void> {
    const now = new Date();
    const promises: Promise<void>[] = [];

    // Check each active session
    for (const [sessionId, session] of this.activeSessions.entries()) {
      // Skip sessions that are already paused or completed
      if (session.state !== "running") {
        continue;
      }

      // Calculate elapsed time since last activity
      const lastActivity = new Date(session.lastActivity);
      const elapsed = now.getTime() - lastActivity.getTime();

      // Calculate total session lifetime
      const createdAt = new Date(session.createdAt);
      const sessionLifetime = now.getTime() - createdAt.getTime();

      // Check if session has exceeded maximum lifetime
      if (sessionLifetime > this.maxSessionLifetime) {
        promises.push(
          this.closeSession(
            sessionId,
            "completed",
            "Session exceeded maximum lifetime"
          )
        );
        continue;
      }

      // Check if session has timed out
      if (elapsed > this.sessionTimeout) {
        promises.push(
          this.pauseSession(sessionId, "Session timed out due to inactivity")
        );
      }
    }

    // Wait for all updates to complete
    await Promise.all(promises);
  }

  /**
   * Persist session metadata to storage
   * @param sessionId Session ID
   * @param metadata Session metadata
   * @private
   */
  private async persistSession(
    sessionId: string,
    metadata: SessionMetadata
  ): Promise<void> {
    // Use checkpointer to save session metadata
    await this.checkpointer.put({
      namespace: `${this.namespace}:${sessionId}`,
      state: metadata,
      writes: null,
    });
  }

  /**
   * Delete session from persistence
   * @param sessionId Session ID
   * @private
   */
  private async deleteSession(sessionId: string): Promise<void> {
    // If we have direct Supabase access, use it (more efficient)
    if (this.supabaseClient) {
      const { error } = await this.supabaseClient
        .from("proposal_checkpoints")
        .delete()
        .eq("namespace", `${this.namespace}:${sessionId}`);

      if (error) {
        throw new Error(`Failed to delete session: ${error.message}`);
      }
    } else {
      // No direct way to delete with checkpointer, just update
      // with empty data to indicate deleted
      await this.checkpointer.put({
        namespace: `${this.namespace}:${sessionId}`,
        state: { deleted: true },
        writes: null,
      });
    }
  }

  /**
   * Load a specific session by ID
   * @param sessionId Session ID
   * @private
   */
  private async loadSessionById(
    sessionId: string
  ): Promise<SessionMetadata | null> {
    // Use checkpointer to get session metadata
    const checkpoint = await this.checkpointer.get({
      namespace: `${this.namespace}:${sessionId}`,
    });

    if (!checkpoint || (checkpoint.state as any).deleted === true) {
      return null;
    }

    return checkpoint.state as unknown as SessionMetadata;
  }

  /**
   * Load all sessions from persistent storage
   * @private
   */
  private async loadSessions(): Promise<void> {
    try {
      // List namespaces with our prefix
      const namespaces = await this.checkpointer.listNamespaces({
        match: `${this.namespace}:`,
        matchType: "PREFIX",
      });

      // Load each session
      const promises = namespaces.map(async (namespace) => {
        const checkpoint = await this.checkpointer.get({ namespace });

        if (!checkpoint || (checkpoint.state as any).deleted === true) {
          return;
        }

        const sessionId = namespace.split(":")[1];
        const sessionMetadata = checkpoint.state as unknown as SessionMetadata;

        // Only load active or paused sessions
        if (
          sessionMetadata.state === "running" ||
          sessionMetadata.state === "paused"
        ) {
          this.activeSessions.set(sessionId, sessionMetadata);
        }
      });

      await Promise.all(promises);
    } catch (error) {
      console.error("Failed to load sessions from persistence:", error);
      throw error;
    }
  }

  /**
   * Clear all sessions (for testing purposes only)
   */
  public clear(): void {
    this.activeSessions.clear();
  }
}
