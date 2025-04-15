# State Management

This directory contains the core state management implementation for the proposal generation system, following the architecture defined in `AGENT_ARCHITECTURE.md`.

## Key Components

### `proposal.state.ts`

Contains the primary state interface `OverallProposalState` which serves as the single source of truth for the application. It includes:

- TypeScript interfaces and type definitions for all state components
- Status enums for different phases of the workflow
- LangGraph state annotations with appropriate reducers
- Schema validation using Zod
- Helper functions for state creation and validation

The state is designed around several key phases of proposal generation:
- Document loading and analysis
- Research generation and evaluation
- Solution identification and evaluation
- Connection pairs identification and evaluation
- Section generation and evaluation

Each component in the state maintains its own status field to track progress through the workflow.

### `reducers.ts`

Contains helper functions for creating immutable state updates in a type-safe manner, including:

- Field and nested field updates
- Object merging utilities
- Array item manipulation
- Specialized reducers for common operations

## State Structure

The `OverallProposalState` follows this structure:

```typescript
interface OverallProposalState {
  // Document handling
  rfpDocument: { id: string, fileName?: string, text?: string, metadata?: {...}, status: LoadingStatus };

  // Research phase
  researchResults?: Record<string, any>;
  researchStatus: ProcessingStatus;
  researchEvaluation?: EvaluationResult | null;
  
  // Solution sought phase
  solutionSoughtResults?: Record<string, any>;
  solutionSoughtStatus: ProcessingStatus;
  solutionSoughtEvaluation?: EvaluationResult | null;
  
  // Connection pairs phase
  connectionPairs?: any[];
  connectionPairsStatus: ProcessingStatus;
  connectionPairsEvaluation?: EvaluationResult | null;
  
  // Proposal sections
  sections: { [sectionId: string]: SectionData | undefined };
  requiredSections: string[];
  
  // Workflow tracking
  currentStep: string | null;
  activeThreadId: string;
  
  // Communication and errors
  messages: BaseMessage[];
  errors: string[];
  
  // Metadata
  projectName?: string;
  userId?: string;
  createdAt: string;
  lastUpdatedAt: string;
}
```

## Status Types

The system uses several status types to track the state of various components:

- `LoadingStatus`: `'not_started' | 'loading' | 'loaded' | 'error'`
- `ProcessingStatus`: `'queued' | 'running' | 'awaiting_review' | 'approved' | 'edited' | 'stale' | 'complete' | 'error'`
- `SectionProcessingStatus`: `'queued' | 'generating' | 'awaiting_review' | 'approved' | 'edited' | 'stale' | 'error'`

## Custom Reducers

The system implements custom reducers for complex state updates:

- `sectionsReducer`: Handles immutable updates to the sections map
- `errorsReducer`: Ensures errors are always appended
- `messagesStateReducer`: (Built-in from LangGraph) Handles message updates

## Usage

### Creating Initial State

```typescript
import { createInitialProposalState } from './proposal.state';

const state = createInitialProposalState('thread-123', 'user-456', 'My Project');
```

### Updating State with Annotations

```typescript
import { ProposalStateAnnotation } from './proposal.state';

// Update a single field
const newState = ProposalStateAnnotation.applyUpdate(state, {
  currentStep: 'generateResearch'
});

// Update a section
const updatedState = ProposalStateAnnotation.applyUpdate(state, {
  sections: {
    introduction: {
      id: 'introduction',
      content: 'Updated content',
      status: 'approved'
    }
  }
});

// Add a message
const stateWithMessage = ProposalStateAnnotation.applyUpdate(state, {
  messages: [new HumanMessage('New input')]
});
```

### Using Reducers for Complex Updates

```typescript
import { createReducers } from './reducers';

const reducers = createReducers();

// Update section status
const update = reducers.updateSectionStatus('introduction', 'approved');
const newState = ProposalStateAnnotation.applyUpdate(state, update);
```

## Testing

Tests for the state management can be found in the `__tests__` directory. Run them with:

```bash
npm test -- apps/backend/state/__tests__
```