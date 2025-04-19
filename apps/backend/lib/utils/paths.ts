/**
 * Path utility constants for consistent imports
 *
 * This file provides standardized import paths to use throughout the codebase.
 * Using these constants helps avoid path-related import errors, especially in tests.
 *
 * REMEMBER: Always use .js extensions for imports even when the file is .ts
 * This is required by ESM + TypeScript with moduleResolution: NodeNext
 */

// State imports
export const STATE_MODULES = {
  TYPES: "@/state/modules/types.js",
  ANNOTATIONS: "@/state/modules/annotations.js",
  REDUCERS: "@/state/modules/reducers.js",
  SCHEMAS: "@/state/modules/schemas.js",
  UTILS: "@/state/modules/utils.js",
};

export const STATE = {
  PROPOSAL_STATE: "@/state/proposal.state.js",
  ...STATE_MODULES,
};

// Proposal generation imports
export const PROPOSAL_GENERATION = {
  GRAPH: "@/proposal-generation/graph.js",
  NODES: "@/proposal-generation/nodes.js",
  CONDITIONALS: "@/proposal-generation/conditionals.js",
  EVALUATION_INTEGRATION: "@/proposal-generation/evaluation_integration.js",
};

// Evaluation imports
export const EVALUATION = {
  FACTORY: "@/evaluation/evaluationNodeFactory.js",
  EXTRACTORS: "@/evaluation/extractors.js",
  CRITERIA: "@/evaluation/criteria.js",
};

// LangGraph imports (with correct paths)
export const LANGGRAPH = {
  STATE_GRAPH: "@langchain/langgraph",
  ANNOTATIONS: "@langchain/langgraph/annotations",
  MESSAGES: "@langchain/core/messages",
};

// Agent imports
export const AGENTS = {
  PROPOSAL_GENERATION: PROPOSAL_GENERATION,
  EVALUATION: EVALUATION,
  ORCHESTRATOR: {
    MANAGER: "@/orchestrator/manager.js",
    STATE: "@/orchestrator/state.js",
  },
};

export default {
  STATE,
  AGENTS,
  LANGGRAPH,
  PROPOSAL_GENERATION,
  EVALUATION,
};
