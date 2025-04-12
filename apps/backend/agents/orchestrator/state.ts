import { z } from "zod";
import { StateFingerprint } from "../../lib/llm/loop-prevention-utils.js";

/**
 * Status of a workflow step
 */
export enum StepStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed",
  SKIPPED = "skipped",
}

/**
 * Agent roles in the system
 */
export enum AgentRole {
  COORDINATOR = "coordinator",
  PROPOSAL = "proposal",
  RESEARCH = "research",
  MEETING = "meeting",
  OUTREACH = "outreach",
}

/**
 * Message type for inter-agent communication
 */
export interface Message {
  role: string;
  content: string;
  agentId?: string;
  timestamp?: number;
}

/**
 * Metadata about a registered agent
 */
export interface AgentMetadata {
  id: string;
  name: string;
  role: AgentRole;
  description: string;
  capabilities: string[];
}

/**
 * The structure of a workflow step
 */
export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  agentId: string;
  status: StepStatus;
  result?: any;
  error?: string;
  startTime?: number;
  endTime?: number;
  dependencies: string[];
}

/**
 * Structure of a full workflow
 */
export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  currentStepId?: string;
  status: StepStatus;
  startTime?: number;
  endTime?: number;
  metadata?: Record<string, any>;
}

/**
 * Interface for the orchestrator state
 */
export interface OrchestratorState {
  userId: string;
  projectId: string;
  agents: AgentMetadata[];
  workflows: Workflow[];
  currentWorkflowId?: string;
  messages: Message[];
  errors: string[];
  lastAgentResponse?: any;
  lastUserQuery?: string;
  context: Record<string, any>;
  stateHistory?: StateFingerprint[]; // Track state history for loop detection
  metadata?: {
    updatedAt?: string;
    initialized?: boolean;
    lastNodeVisited?: string;
    [key: string]: any;
  };
  config?: {
    maxRetries?: number;
    retryDelay?: number;
    timeoutSeconds?: number;
    [key: string]: any;
  };
}

/**
 * Define the state validator schema
 */
export const orchestratorStateSchema = z.object({
  userId: z.string(),
  projectId: z.string(),
  agents: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      role: z.nativeEnum(AgentRole),
      description: z.string(),
      capabilities: z.array(z.string()),
    })
  ),
  workflows: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      steps: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string(),
          agentId: z.string(),
          status: z.nativeEnum(StepStatus),
          result: z.any().optional(),
          error: z.string().optional(),
          startTime: z.number().optional(),
          endTime: z.number().optional(),
          dependencies: z.array(z.string()),
        })
      ),
      currentStepId: z.string().optional(),
      status: z.nativeEnum(StepStatus),
      startTime: z.number().optional(),
      endTime: z.number().optional(),
      metadata: z.record(z.any()).optional(),
    })
  ),
  currentWorkflowId: z.string().optional(),
  messages: z.array(
    z.object({
      role: z.string(),
      content: z.string(),
      agentId: z.string().optional(),
      timestamp: z.number().optional(),
    })
  ),
  errors: z.array(z.string()),
  lastAgentResponse: z.any().optional(),
  lastUserQuery: z.string().optional(),
  context: z.record(z.any()),
  stateHistory: z
    .array(
      z.object({
        hash: z.string(),
        originalState: z.any(),
        timestamp: z.number(),
        sourceNode: z.string().optional(),
      })
    )
    .optional(),
  metadata: z
    .object({
      updatedAt: z.string().optional(),
      initialized: z.boolean().optional(),
      lastNodeVisited: z.string().optional(),
    })
    .optional(),
  config: z
    .object({
      maxRetries: z.number().optional(),
      retryDelay: z.number().optional(),
      timeoutSeconds: z.number().optional(),
    })
    .optional(),
});

/**
 * Get initial state for the orchestrator
 */
export function getInitialOrchestratorState(
  userId: string,
  projectId: string
): OrchestratorState {
  return {
    userId,
    projectId,
    agents: [],
    workflows: [],
    messages: [],
    errors: [],
    context: {},
    stateHistory: [],
    metadata: {
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Returns true if a workflow can be executed (all dependencies are met)
 */
export function canExecuteWorkflow(workflow: Workflow): boolean {
  // A workflow can be executed if it's in pending state
  return workflow.status === StepStatus.PENDING;
}

/**
 * Returns true if a step can be executed (all dependencies are met)
 */
export function canExecuteStep(
  step: WorkflowStep,
  workflow: Workflow
): boolean {
  // A step can be executed if:
  // 1. It's in pending state
  // 2. All its dependencies are in completed state
  if (step.status !== StepStatus.PENDING) {
    return false;
  }

  // If there are no dependencies, the step can be executed
  if (step.dependencies.length === 0) {
    return true;
  }

  // Check if all dependencies are completed
  const dependentSteps = workflow.steps.filter((s) =>
    step.dependencies.includes(s.id)
  );
  return dependentSteps.every((s) => s.status === StepStatus.COMPLETED);
}

/**
 * Get the next executable step in a workflow
 */
export function getNextExecutableStep(workflow: Workflow): WorkflowStep | null {
  if (workflow.status !== StepStatus.IN_PROGRESS) {
    return null;
  }

  // Find the first step that can be executed
  const pendingSteps = workflow.steps.filter(
    (step) => step.status === StepStatus.PENDING
  );

  for (const step of pendingSteps) {
    if (canExecuteStep(step, workflow)) {
      return step;
    }
  }

  return null;
}

/**
 * Check if a workflow is completed
 */
export function isWorkflowCompleted(workflow: Workflow): boolean {
  return workflow.steps.every(
    (step) =>
      step.status === StepStatus.COMPLETED ||
      step.status === StepStatus.SKIPPED ||
      step.status === StepStatus.FAILED
  );
}

/**
 * Check if a workflow has failed
 */
export function hasWorkflowFailed(workflow: Workflow): boolean {
  return workflow.steps.some((step) => step.status === StepStatus.FAILED);
}
