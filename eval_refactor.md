# Evaluation Framework Refactor Plan

This document outlines the plan for refactoring the evaluation integration to address critical issues identified in the current implementation. The refactor will align the codebase with the architecture defined in `AGENT_ARCHITECTURE.md` and `AGENT_BASESPEC.md`.

## ✅ COMPLETED

## 1. State Structure Consistency ✅

### Issue

The state structure currently mixes two different access patterns:

1. Object property access (`state.sections[sectionId]`)
2. Map methods (`state.sections.get(sectionId)`)

This inconsistency causes runtime errors when code expects one pattern but encounters the other. The architecture documents specify using a Map for sections, but implementation is inconsistent.

### Evidence

```typescript
// From evaluation_integration.test.ts - using direct object access
const section = state.sections[sectionId];

// vs elsewhere using Map access
const section = state.sections.get(sectionId);

// In createTestState, a mix of styles
const createTestState = () => ({
  sections: {
    "test-section": {
      /* direct object */
    },
  },
});

// Vs in AGENT_ARCHITECTURE.md showing a Map-based structure
sections: Map<SectionType, SectionData>;
```

### Implementation Steps

- [x] Ensure consistent use of Map for sections throughout codebase
- [x] Update section access in content extractors and check for downstream consumers
- [x] Update test state creation to use Maps instead of object literals
- [x] Update section modification functions to use proper Map methods

#### 1. Update OverallProposalState Interface ✅

- [x] Ensure consistent use of Map for sections throughout codebase
- [x] Update section access in content extractors and check for downstream consumers

```typescript
// In apps/backend/state/modules/types.ts

import { SectionType } from "./enums.js";

// Before:
export interface OverallProposalState {
  // ...
  sections: { [sectionId: string]: SectionData | undefined };
  // ...
}

// After:
export interface OverallProposalState {
  // ...
  sections: Map<SectionType, SectionData>;
  // ...
}
```

#### 2. Update Section Access in Content Extractors ✅

- [x] Convert section access to use Map methods instead of object property access

```typescript
// In apps/backend/evaluation/contentExtractors.ts

// Before:
export function extractSectionContent(
  state: OverallProposalState,
  sectionId: string
): string {
  const section = state.sections[sectionId];
  if (!section) throw new Error(`Section ${sectionId} not found`);
  return section.content || "";
}

// After:
export function extractSectionContent(
  state: OverallProposalState,
  sectionId: SectionType
): string {
  const section = state.sections.get(sectionId);
  if (!section) {
    throw new Error(`Section ${sectionId} not found`);
  }
  return section.content || "";
}
```

#### 3. Update Test State Creation ✅

- [x] Modify test utilities to create Map-based section structures

```typescript
// In apps/backend/agents/proposal-generation/__tests__/evaluation_integration.test.ts

// Before:
const createTestState = (evaluation, status) => ({
  sections: {
    "test-section": {
      evaluation,
      status,
    },
  },
  // ...
});

// After:
const createTestState = (evaluation, status) => {
  const sections = new Map();
  sections.set("test-section", {
    evaluation,
    status,
  });

  return {
    sections,
    // ...
  };
};
```

#### 4. Update Section Modification Functions ✅

- [x] Refactor all functions that modify section data to use Map operations

```typescript
// In apps/backend/agents/proposal-generation/nodes.ts

// Before:
function updateSectionStatus(state, sectionId, newStatus) {
  const sectionsCopy = { ...state.sections };
  sectionsCopy[sectionId] = {
    ...sectionsCopy[sectionId],
    status: newStatus,
  };
  return { ...state, sections: sectionsCopy };
}

// After:
function updateSectionStatus(state, sectionId, newStatus) {
  const sectionsCopy = new Map(state.sections);
  const section = sectionsCopy.get(sectionId);

  if (!section) {
    throw new Error(`Section ${sectionId} not found in state`);
  }

  sectionsCopy.set(sectionId, {
    ...section,
    status: newStatus,
  });

  return { ...state, sections: sectionsCopy };
}
```

#### 5. Check Downstream Consumers ✅

- [x] Review and update any additional code accessing or modifying sections:
  - Orchestrator Service
  - Other content extraction utilities
  - UI state transformations
  - API response handlers

## 2. Status Value Inconsistencies ✅

### Issue

Status values are inconsistently used throughout the code, sometimes as string literals and sometimes from enums. This leads to potential mismatches and runtime errors in status checks and routing logic.

### Evidence

```typescript
// String literals in tests
const sectionStatus = "awaiting_review";

// vs enum values in some implementations
const sectionStatus = SectionStatus.AWAITING_REVIEW;

// Condition checking sometimes uses literals
if (status === "awaiting_review") { ... }

// vs enum values in other places
if (status === SectionStatus.AWAITING_REVIEW) { ... }
```

### Implementation Steps

- [x] Standardize status values using centralized enums

#### 1. Create Central Status Constants ✅

- [x] Create centralized enums for status values in a new constants.ts file

```typescript
// In apps/backend/state/modules/constants.ts

export enum SectionStatus {
  NOT_STARTED = "not_started",
  QUEUED = "queued",
  GENERATING = "generating",
  AWAITING_REVIEW = "awaiting_review",
  APPROVED = "approved",
  EDITED = "edited",
  STALE = "stale",
  ERROR = "error",
}

export enum ProcessingStatus {
  NOT_STARTED = "not_started",
  LOADING = "loading",
  LOADED = "loaded",
  QUEUED = "queued",
  RUNNING = "running",
  AWAITING_REVIEW = "awaiting_review",
  APPROVED = "approved",
  EDITED = "edited",
  STALE = "stale",
  ERROR = "error",
  COMPLETE = "complete",
}
```

#### 2. Update Imports and Types ✅

- [x] Update type definitions to use enums instead of string literal unions
- [x] Update Zod schemas to use enums with z.nativeEnum

#### 3. Use Constants in Conditional Logic ✅

- [x] Update conditional statements to use enum values instead of string literals

```typescript
// In apps/backend/agents/proposal-generation/conditionals.ts

import {
  SectionStatus,
  ProcessingStatus,
} from "../../state/modules/constants.js";

// Before:
export function routeAfterEvaluation(state: OverallProposalState): string {
  if (state.sectionStatus === "awaiting_review") {
    return "interrupt";
  }
  if (state.sectionStatus === "approved") {
    return "continue";
  }
  return "revise";
}

// After:
export function routeAfterEvaluation(state: OverallProposalState): string {
  if (state.sectionStatus === ProcessingStatus.AWAITING_REVIEW) {
    return "interrupt";
  }
  if (state.sectionStatus === ProcessingStatus.APPROVED) {
    return "continue";
  }
  return "revise";
}
```

Note: Updated all string literal status checks in:

- apps/backend/agents/proposal-generation/conditionals.ts
- apps/backend/agents/proposal-agent/conditionals.ts

#### 4. Update Tests to Use Constants ✅

- [x] Refactor test files to import and use enum values instead of string literals

```typescript
// In apps/backend/agents/proposal-generation/__tests__/evaluation_integration.test.ts

import { SectionStatus } from "../../../state/modules/constants.js";

// Before:
const createTestState = (evaluation, status = "awaiting_review") => {
  // ...
};

// After:
const createTestState = (
  evaluation,
  status = SectionStatus.AWAITING_REVIEW
) => {
  // ...
};
```

Note: Updated all string literal status values in test files:

- apps/backend/agents/proposal-generation/**tests**/evaluation_integration.test.ts
- apps/backend/agents/proposal-agent/**tests**/conditionals.test.ts

## 3. Error Recovery & Resilience using `.withRetry()` ✅

**Issue:** Network calls, particularly to LLMs or external tools, can experience transient failures (timeouts, temporary service unavailability, rate limits). The system needs a standard, robust way to retry these calls automatically.

**Decision:** Utilize the built-in `.withRetry()` method available on LangChain `Runnable` objects (like Chat Models, ToolExecutors) instead of implementing a custom backoff utility.

**Justification:** `.withRetry()` is the idiomatic LangChain/LangGraph approach, integrates seamlessly, benefits from the library's built-in handling of common retryable errors (e.g., HTTP 429, 5xx), avoids code duplication, and keeps the code cleaner by associating the retry logic directly with the runnable instance.

**Implementation Steps:**

**3.1 Locate Target `Runnable` Instantiations & Invocations:** ✅

- [x] Identify all places where LangChain `Runnables` that make external network calls (primarily `ChatModel` instances, potentially `ToolExecutor` or others) are _instantiated_ or _invoked_.
- [x] **Strategy:**
  1.  **Search for Model Instantiations:** Use codebase search to find where models are created
  2.  **Search for Invocations:** Search for `.invoke(` and `.stream(` method calls
  3.  **Cross-reference:** Compare instantiation locations with invocation locations
  4.  **List Files:** Compile a list of files requiring modification

**3.2 Apply `.withRetry()` Incrementally (Hoisting Preferred):** ✅

- [x] Modify the identified instantiation points (preferred) or invocation points one by one or in logical groups to add retry logic.
- [x] **Default Configuration:** Implemented standard retry configuration: `{ stopAfterAttempt: 3 }`.
- [x] **Refactoring Steps (Iterative):**

  1.  **Evaluation Framework:** ✅

      - Applied `.withRetry()` to LLM instantiation within the evaluation components

  2.  **Core Generation Nodes:** ✅

      - Applied `.withRetry()` to LLM instantiation or invocation within various agent nodes

  3.  **Editing/Revision Logic:** ✅

      - Applied `.withRetry()` to the relevant LLM instances

  4.  **Tool Execution:** ✅
      - Applied `.withRetry()` to the `ToolExecutor` instances where needed

**3.3 Update Error Handling Logic:** ✅

- [x] Ensured that existing `try...catch` blocks surrounding runnable invocations correctly handle errors that persist _after_ all retry attempts from `.withRetry()` have failed.
- [x] **Strategy:**
  1.  **Review `catch` Blocks:** Examined `catch` blocks associated with the modified runnables.
  2.  **Verify Error Type:** Ensured handlers are robust to both standard `Error` or specific LangChain error types
  3.  **Update State Correctly:** Confirmed that errors are logged and state is updated properly

## 🔄 NEXT STEPS

## 4. Dependency Chain Management ✅

### Issue

There is no proper implementation for managing dependencies between sections. When one section is edited, dependent sections need to be marked as stale, but this functionality is missing.

### Evidence

- No dependency map loading implementation
- No traversal of dependencies when content is edited
- Missing stale marking of dependent sections
- No system for guided regeneration

### Implementation Steps

#### 1. Create Dependency Map Definition ✅

```json
// In apps/backend/config/dependencies.json

{
  "problem_statement": [],
  "organizational_capacity": [],
  "solution": ["problem_statement"],
  "implementation_plan": ["solution"],
  "evaluation_approach": ["solution", "implementation_plan"],
  "budget": ["solution", "implementation_plan"],
  "executive_summary": [
    "problem_statement",
    "organizational_capacity",
    "solution",
    "implementation_plan",
    "evaluation_approach",
    "budget"
  ],
  "conclusion": [
    "problem_statement",
    "organizational_capacity",
    "solution",
    "implementation_plan",
    "evaluation_approach",
    "budget"
  ]
}

// Note: "solution_sought" is not part of the section dependencies as it refers to the research node


// that investigates what the funder is looking for, not an actual proposal section.
```

#### 2. Create Dependency Service ✅

```typescript
// In apps/backend/services/DependencyService.ts

import { SectionType } from "../state/modules/enums.js";
import * as fs from "fs";
import * as path from "path";

export class DependencyService {
  private dependencyMap: Map<SectionType, SectionType[]>;

  constructor(dependencyMapPath?: string) {
    this.dependencyMap = new Map();
    this.loadDependencyMap(dependencyMapPath);
  }

  private loadDependencyMap(dependencyMapPath?: string): void {
    const mapPath =
      dependencyMapPath ||
      path.resolve(__dirname, "../config/dependencies.json");

    try {
      const mapData = JSON.parse(fs.readFileSync(mapPath, "utf8"));

      Object.entries(mapData).forEach(([section, deps]) => {
        this.dependencyMap.set(section as SectionType, deps as SectionType[]);
      });
    } catch (error) {
      throw new Error(`Failed to load dependency map: ${error.message}`);
    }
  }

  /**
   * Get sections that depend on the given section
   */
  getDependentsOf(sectionId: SectionType): SectionType[] {
    const dependents: SectionType[] = [];

    this.dependencyMap.forEach((dependencies, section) => {
      if (dependencies.includes(sectionId)) {
        dependents.push(section);
      }
    });

    return dependents;
  }

  /**
   * Get all dependencies for a section
   */
  getDependenciesOf(sectionId: SectionType): SectionType[] {
    return this.dependencyMap.get(sectionId) || [];
  }

  /**
   * Get the full dependency tree for a section (recursively)
   */
  getAllDependents(sectionId: SectionType): SectionType[] {
    const directDependents = this.getDependentsOf(sectionId);
    const allDependents = new Set<SectionType>(directDependents);

    directDependents.forEach((dependent) => {
      this.getAllDependents(dependent).forEach((item) =>
        allDependents.add(item)
      );
    });

    return Array.from(allDependents);
  }
}
```

#### 3. Enhance Orchestrator to Handle Dependencies ✅

```typescript
// In apps/backend/services/OrchestratorService.ts

import { DependencyService } from "./DependencyService.js";
import { SectionStatus, SectionType } from "../state/modules/constants.js";
import { OverallProposalState } from "../state/modules/types.js";

export class OrchestratorService {
  private dependencyService: DependencyService;

  constructor() {
    this.dependencyService = new DependencyService();
  }

  /**
   * Mark dependent sections as stale after a section has been edited
   */
  async markDependentSectionsAsStale(
    state: OverallProposalState,
    editedSectionId: SectionType
  ): Promise<OverallProposalState> {
    const dependentSections =
      this.dependencyService.getAllDependents(editedSectionId);
    const sectionsCopy = new Map(state.sections);

    // Mark each dependent section as stale if it was previously approved/edited
    dependentSections.forEach((sectionId) => {
      const section = sectionsCopy.get(sectionId);

      if (
        section &&
        (section.status === SectionStatus.APPROVED ||
          section.status === SectionStatus.EDITED)
      ) {
        sectionsCopy.set(sectionId, {
          ...section,
          status: SectionStatus.STALE,
          previousStatus: section.status, // Store previous status for potential fallback
        });
      }
    });

    return {
      ...state,
      sections: sectionsCopy,
    };
  }

  /**
   * Handle stale section decision (keep or regenerate)
   */
  async handleStaleDecision(
    state: OverallProposalState,
    sectionId: SectionType,
    decision: "keep" | "regenerate",
    guidance?: string
  ): Promise<OverallProposalState> {
    const sectionsCopy = new Map(state.sections);
    const section = sectionsCopy.get(sectionId);

    if (!section) {
      throw new Error(`Section ${sectionId} not found`);
    }

    if (section.status !== SectionStatus.STALE) {
      throw new Error(
        `Cannot handle stale decision for non-stale section ${sectionId}`
      );
    }

    if (decision === "keep") {
      // Restore previous status (approved or edited)
      sectionsCopy.set(sectionId, {
        ...section,
        status: section.previousStatus || SectionStatus.APPROVED,
        previousStatus: undefined,
      });

      return {
        ...state,
        sections: sectionsCopy,
      };
    } else {
      // Set to queued for regeneration
      sectionsCopy.set(sectionId, {
        ...section,
        status: SectionStatus.QUEUED,
        previousStatus: undefined,
      });

      // Add regeneration guidance to messages if provided
      let updatedMessages = [...state.messages];

      if (guidance) {
        updatedMessages.push({
          type: "regeneration_guidance",
          sectionId,
          content: guidance,
          timestamp: new Date().toISOString(),
        });
      }

      return {
        ...state,
        sections: sectionsCopy,
        messages: updatedMessages,
      };
    }
  }
}
```

## 5. Checkpoint Integration & Interrupt Handling 🔄

### Issue

The integration with the checkpointer is incomplete, and interrupt handling has inconsistent metadata structures.

### Evidence

- No standard DB schema for the checkpointer
- Inconsistent interrupt metadata format
- Incomplete resume logic after interrupts

### Implementation Steps

#### 1. Create Supabase Checkpointer

```typescript
// In apps/backend/lib/supabase/checkpointer.ts

import { SupabaseClient } from "@supabase/supabase-js";
import { BaseCheckpointSaver } from "@langchain/langgraph";
import { OverallProposalState } from "../../state/modules/types.js";

export class SupabaseCheckpointer implements BaseCheckpointSaver {
  private client: SupabaseClient;
  private tableName: string;

  constructor(
    supabaseClient: SupabaseClient,
    tableName: string = "checkpoints"
  ) {
    this.client = supabaseClient;
    this.tableName = tableName;
  }

  /**
   * Get a checkpoint from the database
   */
  async get(threadId: string): Promise<OverallProposalState | null> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select("state")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        throw error;
      }

      return data ? JSON.parse(data.state) : null;
    } catch (error) {
      console.error(`Error getting checkpoint for thread ${threadId}:`, error);
      return null;
    }
  }

  /**
   * Save a checkpoint to the database
   */
  async put(threadId: string, state: OverallProposalState): Promise<void> {
    try {
      const { error } = await this.client.from(this.tableName).insert({
        thread_id: threadId,
        state: JSON.stringify(state),
        created_at: new Date().toISOString(),
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error(`Error saving checkpoint for thread ${threadId}:`, error);
      throw error;
    }
  }

  /**
   * List all checkpoints for a thread
   */
  async list(threadId?: string): Promise<string[]> {
    try {
      let query = this.client
        .from(this.tableName)
        .select("thread_id")
        .order("created_at", { ascending: false });

      if (threadId) {
        query = query.eq("thread_id", threadId);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data.map((item) => item.thread_id);
    } catch (error) {
      console.error("Error listing checkpoints:", error);
      return [];
    }
  }

  /**
   * Delete a checkpoint from the database
   */
  async delete(threadId: string): Promise<void> {
    try {
      const { error } = await this.client
        .from(this.tableName)
        .delete()
        .eq("thread_id", threadId);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error(`Error deleting checkpoint for thread ${threadId}:`, error);
      throw error;
    }
  }
}
```

#### 2. Standardize Interrupt Metadata

```typescript
// In apps/backend/agents/proposal-generation/graph.ts

import { StateGraph } from "@langchain/langgraph";
import { OverallProposalState } from "../../state/modules/types.js";

// Standardized interrupt metadata structure
interface InterruptMetadata {
  type: "evaluation" | "edit" | "stale" | "system";
  contentId: string;
  contentType: "research" | "solution" | "section" | "connection";
  actions: Array<"approve" | "revise" | "edit" | "regenerate" | "keep">;
  evaluationResult?: any;
  message?: string;
}

// Configure graph with interrupt points
const graph = new StateGraph<OverallProposalState>({
  channels: {
    /* ... */
  },
});

// Add nodes and edges...

// Configure interrupts consistently
const compiledGraph = graph.compile({
  interruptAfter: [
    "evaluateResearch",
    "evaluateSolution",
    "evaluateConnectionPairs",
    // Section evaluation nodes
    "evaluateProblemStatement",
    "evaluateMethodology",
    // etc...
  ],
});
```

#### 3. Enhance Orchestrator's Resume Logic

```typescript
// In apps/backend/services/OrchestratorService.ts

/**
 * Resume execution after an interrupt
 */
async resumeExecution(
  threadId: string,
  action: 'approve' | 'revise' | 'edit' | 'regenerate' | 'keep',
  feedback?: string,
  editedContent?: string
): Promise<OverallProposalState> {
  // Load state from checkpointer
  const state = await this.checkpointer.get(threadId);

  if (!state) {
    throw new Error(`No state found for thread ${threadId}`);
  }

  // Check if state has interrupt status
  if (!state.interruptStatus) {
    throw new Error(`Thread ${threadId} is not in an interrupted state`);
  }

  const { contentId, contentType } = state.interruptStatus;

  // Handle different actions
  switch (action) {
    case 'approve':
      return this.handleApproval(state, contentId, contentType);

    case 'revise':
      return this.handleRevisionRequest(state, contentId, contentType, feedback);

    case 'edit':
      return this.handleEdit(state, contentId, contentType, editedContent);

    case 'regenerate':
      return this.handleRegeneration(state, contentId, contentType, feedback);

    case 'keep':
      return this.handleKeepStaleSection(state, contentId);

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
```

## 6. Enum & Constants Usage

### Issue

The codebase inconsistently uses string literals for status values, section types, and other constants, rather than centralized enums.

### Evidence

- String literals for section types (`"problem_statement"` vs. `SectionType.PROBLEM_STATEMENT`)
- Inconsistent status definitions
- Duplicated enum-like values across files

### Implementation Steps

#### 1. Centralize Status Constants

```typescript
// In apps/backend/state/modules/constants.ts

// Section types
export enum SectionType {
  PROBLEM_STATEMENT = "problem_statement",
  METHODOLOGY = "methodology",
  SOLUTION = "solution",
  OUTCOMES = "outcomes",
  BUDGET = "budget",
  TIMELINE = "timeline",
  TEAM = "team",
  EVALUATION_PLAN = "evaluation_plan",
  SUSTAINABILITY = "sustainability",
  RISKS = "risks",
  CONCLUSION = "conclusion",
}

// Status constants (already defined in previous section)
export enum SectionStatus {
  NOT_STARTED = "not_started",
  QUEUED = "queued",
  // ...
}

export enum ProcessingStatus {
  NOT_STARTED = "not_started",
  LOADING = "loading",
  // ...
}

// Content types
export enum ContentType {
  RESEARCH = "research",
  SOLUTION = "solution",
  CONNECTION = "connection",
  SECTION = "section",
}

// Action types
export enum ActionType {
  APPROVE = "approve",
  REVISE = "revise",
  EDIT = "edit",
  REGENERATE = "regenerate",
  KEEP = "keep",
}
```

#### 2. Use Constants in Conditional Logic

```typescript
// In apps/backend/agents/proposal-generation/conditionals.ts

import { SectionStatus, SectionType } from "../../state/modules/constants.js";

export function routeAfterEvaluation(state: OverallProposalState): string {
  // Use enum values consistently
  if (state.currentSectionId === SectionType.SOLUTION) {
    // Solution-specific logic
    if (state.solutionSoughtStatus === ProcessingStatus.AWAITING_REVIEW) {
      return "interrupt";
    }
  }

  // Default routing logic
  // ...
}
```

## 7. Validation & Type Safety

### Issue

The codebase lacks systematic validation of state structure, making it vulnerable to runtime errors when state shape changes or is inconsistent.

### Evidence

- Missing Zod schemas for state validation
- No validation checks at key entry points
- Inconsistent error handling for invalid state structures

### Implementation Steps

#### 1. Create State Validation Schema

```typescript
// In apps/backend/validation/stateValidation.ts

import { z } from "zod";
import {
  SectionStatus,
  SectionType,
  ProcessingStatus,
} from "../state/modules/constants.js";

// Basic validation schemas
const SectionDataSchema = z.object({
  content: z.string().optional(),
  status: z.nativeEnum(SectionStatus),
  evaluation: z.any().optional(),
  previousStatus: z.nativeEnum(SectionStatus).optional(),
  lastError: z.any().optional(),
});

// State schema for validation
export const OverallProposalStateSchema = z.object({
  rfpDocument: z.object({
    id: z.string(),
    fileName: z.string().optional(),
    text: z.string().optional(),
    metadata: z.record(z.any()).optional(),
    status: z.nativeEnum(ProcessingStatus),
  }),
  researchResults: z.record(z.any()).optional(),
  researchStatus: z.nativeEnum(ProcessingStatus),
  researchEvaluation: z.any().optional().nullable(),
  solutionSoughtResults: z.record(z.any()).optional(),
  solutionSoughtStatus: z.nativeEnum(ProcessingStatus),
  solutionSoughtEvaluation: z.any().optional().nullable(),
  connectionPairs: z.array(z.any()).optional(),
  connectionPairsStatus: z.nativeEnum(ProcessingStatus),
  connectionPairsEvaluation: z.any().optional().nullable(),
  // For Map validation we need a custom refinement
  sections: z.custom<Map<SectionType, any>>((val) => val instanceof Map, {
    message: "sections must be a Map",
  }),
  requiredSections: z.array(z.string()),
  currentStep: z.string().nullable(),
  activeThreadId: z.string(),
  messages: z.array(z.any()),
  errors: z.array(z.string()),
  projectName: z.string().optional(),
  userId: z.string().optional(),
  createdAt: z.string(),
  lastUpdatedAt: z.string(),
});

// Validation function
export function validateState(state: any): { valid: boolean; errors?: any } {
  try {
    OverallProposalStateSchema.parse(state);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      errors: error.errors,
    };
  }
}
```

#### 2. Add Validation Checks to Nodes

```typescript
// In apps/backend/agents/proposal-generation/nodes.ts

import { validateState } from "../../validation/stateValidation.js";

// Add validation to node entry points
export async function evaluateSectionNode(
  state: OverallProposalState,
  sectionId: SectionType
) {
  // Validate state first
  const validation = validateState(state);
  if (!validation.valid) {
    console.error("Invalid state structure:", validation.errors);
    return {
      ...state,
      errors: [
        ...state.errors,
        `Invalid state structure in evaluateSectionNode: ${JSON.stringify(validation.errors)}`,
      ],
    };
  }

  // Proceed with evaluation
  // ...
}
```

## 8. Implementation Timeline

### Phase 1: Core Structure (Week 1) ✅

- ✅ Update `OverallProposalState` interface to use Map for sections
- ✅ Create central constants file with enums
- ✅ Implement state validation schema
- ✅ Update content extractors to use Map access

### Phase 2: Resilience (Week 2) ✅

- ✅ Create backoff and retry utility
- ✅ Enhance LLM call resilience
- ✅ Implement graceful error states
- ✅ Standardize interrupt metadata

### Phase 3: Dependencies (Week 2-3) 🔄

- ⏳ Create dependency map JSON file
- ⏳ Implement `DependencyService`
- ⏳ Enhance `OrchestratorService` with dependency methods
- ⏳ Implement stale section handling logic

### Phase 4: Checkpoint Integration (Week 3) 🔄

- ⏳ Implement `SupabaseCheckpointer`
- ⏳ Create DB schema for checkpoints
- ⏳ Enhance resume logic in `OrchestratorService`

### Phase 5: Testing Improvements (Week 4) 🔄

- ⏳ Update test state creation to use Maps
- ⏳ Fix mocking implementations with `vi.hoisted()`
- ⏳ Add tests for dependency tracking
- ⏳ Implement tests for checkpoint integration

## 9. Migration Strategy

### Backward Compatibility

- Consider using a facade pattern to maintain temporary compatibility with older code
- Use TypeScript utility types to support both object and Map access during transition
- Add runtime warnings when using deprecated access patterns

### Schema Changes

- Document all changes to the `OverallProposalState` interface
- Create migration scripts if needed for existing saved states
- Add version field to state to handle multiple schema versions

### Incremental Implementation

- Deploy changes in logical batches (e.g., constants first, then state structure, then dependencies)
- Run parallel testing of old and new implementations
- Monitor errors and performance during transition

## 10. Testing Best Practices

### Proper Mocking with Vitest

- Use `vi.hoisted()` for all mock definitions to avoid reference errors
- For modules with default exports, mock both default and named exports:

```typescript
const pathMock = vi.hoisted(() => ({
  resolve: vi.fn(),
  default: { resolve: vi.fn() },
}));
vi.mock("path", () => pathMock);
```

- Reset mocks in `beforeEach`/`afterEach` hooks:

```typescript
beforeEach(() => {
  vi.clearAllMocks();
  // Reset control variables
  mockShouldFail = false;
});
```

- Use control variables for conditional mock behavior
