/**
 * Timeout and cancellation manager for LangGraph workflows
 *
 * This module provides timeout safeguards and cancellation support for LangGraph workflows,
 * with a focus on being generous with limits for research-heavy nodes while still providing
 * protection against infinite runs.
 */

import { StateGraph } from "@langchain/langgraph";

// Default timeout values (in milliseconds)
const DEFAULT_TIMEOUTS = {
  // Overall workflow timeout (30 minutes)
  WORKFLOW: 30 * 60 * 1000,

  // Default node timeout (3 minutes)
  DEFAULT_NODE: 3 * 60 * 1000,

  // Research node timeout (10 minutes)
  RESEARCH_NODE: 10 * 60 * 1000,

  // Generation node timeout (5 minutes)
  GENERATION_NODE: 5 * 60 * 1000,
};

// Node types for specialized timeouts
type NodeType = "default" | "research" | "generation";

interface TimeoutOptions {
  // Overall workflow timeout in milliseconds
  workflowTimeout?: number;

  // Node-specific timeouts (by node name)
  nodeTimeouts?: Record<string, number>;

  // Default timeout for each node type
  defaultTimeouts?: {
    default?: number;
    research?: number;
    generation?: number;
  };

  // Names of research nodes (will use research timeout by default)
  researchNodes?: string[];

  // Names of generation nodes (will use generation timeout by default)
  generationNodes?: string[];

  // Whether to enable cancellation support
  enableCancellation?: boolean;

  // Event handler for timeout events
  onTimeout?: (nodeName: string, elapsedTime: number) => void;

  // Event handler for cancellation events
  onCancellation?: (reason: string) => void;
}

/**
 * Class for managing timeouts and cancellation in LangGraph workflows
 */
export class TimeoutManager<T extends object> {
  private options: Required<TimeoutOptions>;
  private workflowStartTime: number | null = null;
  private nodeStartTimes: Map<string, number> = new Map();
  private workflowTimeoutId: NodeJS.Timeout | null = null;
  private nodeTimeoutIds: Map<string, NodeJS.Timeout> = new Map();
  private cancelled = false;
  private cancelReason: string | null = null;

  constructor(options: TimeoutOptions = {}) {
    // Set default options with fallbacks
    this.options = {
      workflowTimeout: options.workflowTimeout ?? DEFAULT_TIMEOUTS.WORKFLOW,
      nodeTimeouts: options.nodeTimeouts ?? {},
      defaultTimeouts: {
        default:
          options.defaultTimeouts?.default ?? DEFAULT_TIMEOUTS.DEFAULT_NODE,
        research:
          options.defaultTimeouts?.research ?? DEFAULT_TIMEOUTS.RESEARCH_NODE,
        generation:
          options.defaultTimeouts?.generation ??
          DEFAULT_TIMEOUTS.GENERATION_NODE,
      },
      researchNodes: options.researchNodes ?? [],
      generationNodes: options.generationNodes ?? [],
      enableCancellation: options.enableCancellation ?? true,
      onTimeout: options.onTimeout ?? (() => {}),
      onCancellation: options.onCancellation ?? (() => {}),
    };
  }

  /**
   * Start the workflow timeout timer
   */
  startWorkflow(): void {
    this.workflowStartTime = Date.now();

    if (this.options.workflowTimeout > 0) {
      this.workflowTimeoutId = setTimeout(() => {
        this.handleWorkflowTimeout();
      }, this.options.workflowTimeout);
    }
  }

  /**
   * Start a node timeout timer
   */
  private startNodeTimer(nodeName: string): void {
    this.nodeStartTimes.set(nodeName, Date.now());

    // Determine the timeout for this node
    const timeout = this.getNodeTimeout(nodeName);

    if (timeout > 0) {
      const timeoutId = setTimeout(() => {
        this.handleNodeTimeout(nodeName);
      }, timeout);

      this.nodeTimeoutIds.set(nodeName, timeoutId);
    }
  }

  /**
   * Clear a node timeout timer
   */
  private clearNodeTimer(nodeName: string): void {
    const timeoutId = this.nodeTimeoutIds.get(nodeName);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.nodeTimeoutIds.delete(nodeName);
    }
    this.nodeStartTimes.delete(nodeName);
  }

  /**
   * Handle a workflow timeout
   */
  private handleWorkflowTimeout(): void {
    const elapsedTime = this.workflowStartTime
      ? Date.now() - this.workflowStartTime
      : 0;
    this.cancel(`Workflow timeout exceeded (${elapsedTime}ms)`);
  }

  /**
   * Handle a node timeout
   */
  private handleNodeTimeout(nodeName: string): void {
    const startTime = this.nodeStartTimes.get(nodeName);
    const elapsedTime = startTime ? Date.now() - startTime : 0;

    // Call the timeout handler
    this.options.onTimeout(nodeName, elapsedTime);

    // Cancel the workflow
    this.cancel(`Node "${nodeName}" timeout exceeded (${elapsedTime}ms)`);
  }

  /**
   * Cancel the workflow
   */
  cancel(reason: string): void {
    if (this.cancelled) return;

    this.cancelled = true;
    this.cancelReason = reason;

    // Clear all timers
    this.cleanup();

    // Call the cancellation handler
    this.options.onCancellation(reason);
  }

  /**
   * Clean up all timers and resources
   */
  cleanup(): void {
    // Clear workflow timeout
    if (this.workflowTimeoutId) {
      clearTimeout(this.workflowTimeoutId);
      this.workflowTimeoutId = null;
    }

    // Clear all node timeouts
    for (const [nodeName, timeoutId] of this.nodeTimeoutIds.entries()) {
      clearTimeout(timeoutId);
      this.nodeTimeoutIds.delete(nodeName);
    }

    // Reset state
    this.nodeStartTimes.clear();
  }

  /**
   * Check if the workflow has been cancelled
   */
  isCancelled(): boolean {
    return this.cancelled;
  }

  /**
   * Get the timeout for a specific node
   */
  private getNodeTimeout(nodeName: string): number {
    // Check for specific node timeout
    if (nodeName in this.options.nodeTimeouts) {
      return this.options.nodeTimeouts[nodeName];
    }

    // Check if it's a research node
    if (this.options.researchNodes.includes(nodeName)) {
      return this.options.defaultTimeouts.research;
    }

    // Check if it's a generation node
    if (this.options.generationNodes.includes(nodeName)) {
      return this.options.defaultTimeouts.generation;
    }

    // Use default timeout
    return this.options.defaultTimeouts.default;
  }
}

/**
 * Error thrown when a workflow is cancelled
 */
export class WorkflowCancellationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowCancellationError";
  }
}

/**
 * Error thrown when a node timeout is exceeded
 */
class NodeTimeoutError extends Error {
  nodeName: string;
  elapsedTime: number;

  constructor(nodeName: string, elapsedTime: number) {
    super(`Node "${nodeName}" timeout exceeded (${elapsedTime}ms)`);
    this.name = "NodeTimeoutError";
    this.nodeName = nodeName;
    this.elapsedTime = elapsedTime;
  }
}

/**
 * Configure a StateGraph with timeout and cancellation support
 */
export function configureTimeouts<T extends object>(
  graph: StateGraph<T>,
  options: TimeoutOptions = {}
): {
  graph: StateGraph<T>;
  timeoutManager: TimeoutManager<T>;
} {
  const timeoutManager = new TimeoutManager<T>(options);
  const configuredGraph = timeoutManager.configureGraph(graph);

  return {
    graph: configuredGraph,
    timeoutManager,
  };
}
