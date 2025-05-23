# Project Brief: LangGraph Proposal Agent

## Project Overview

The LangGraph Proposal Agent is a specialized multi-agent system designed to assist users in analyzing Request for Proposals (RFPs) and generating high-quality, tailored proposal content. The system leverages LangGraph.js for managing stateful workflows with human-in-the-loop capabilities, enabling both sequential generation of proposal sections and non-sequential editing with intelligent dependency handling.

## Core Goals

1. **Streamline Proposal Generation**: Reduce the time and effort required to create professional proposal documents by automating content generation while maintaining quality and customization.

2. **Enable Intelligent Collaboration**: Facilitate seamless human-agent collaboration through structured review points and flexible editing capabilities.

3. **Ensure Proposal Coherence**: Maintain logical consistency across proposal sections through dependency tracking and guided regeneration when sections change.

4. **Provide High-Quality Output**: Deliver proposal content that meets professional standards through automated evaluation and iterative improvement.

5. **Maintain Context Across Sessions**: Support long-running proposal development through persistent state and seamless resume capabilities.

## Key Requirements

### Functional Requirements

1. **Document Analysis**: Parse and analyze RFP documents to extract key requirements, evaluation criteria, and project parameters.

2. **Research Generation**: Conduct deep research on the problem domain, potential solutions, and relevant case studies.

3. **Section Generation**: Create structured proposal sections following best practices and RFP requirements.

4. **Human Review**: Integrate mandatory review checkpoints for user approval or revision of generated content.

5. **Non-Sequential Editing**: Allow users to edit any section at any time, with intelligent handling of downstream dependencies.

6. **Dependency Tracking**: Maintain awareness of relationships between proposal sections to ensure coherence when changes occur.

7. **Regeneration Guidance**: When regenerating dependent sections, incorporate context from both the original and the edited upstream sections.

### Technical Requirements

1. **Stateful Workflow**: Implement LangGraph.js state management with robust checkpointing for persistence.

2. **Interruptible Flow**: Support pausing and resuming the generation workflow at designated points.

3. **Persistent Checkpointing**: Store state in PostgreSQL via Supabase for reliable recovery and session management.

4. **Human-in-the-Loop (HITL)**: Incorporate explicit approval steps and feedback incorporation mechanisms.

5. **Orchestration Layer**: Create a central service to manage workflow, state, user feedback, and agent coordination.

6. **API Integration**: Develop RESTful endpoints for frontend interaction with the agent system.

7. **Authentication**: Implement secure user authentication and proposal ownership via Supabase.

## Success Criteria

1. Users can generate complete proposal drafts 3-5x faster than manual writing.

2. Generated content meets or exceeds quality standards based on evaluation criteria.

3. The system successfully maintains logical consistency across sections during iterative editing.

4. Users report positive experience with the review and editing workflow.

5. The system reliably persists state and resumes from interruptions without data loss.

## Project Timeline

- **Phase 1**: Core architecture and basic workflow implementation (2 weeks)
- **Phase 2**: Section generation and evaluation capabilities (3 weeks)
- **Phase 3**: Editing and dependency handling refinement (2 weeks)
- **Phase 4**: UI integration and usability improvements (2 weeks)
- **Phase 5**: Testing, optimization, and deployment (1 week)

_This document provides the foundation for all project decisions and development activities. It should be referenced when determining scope, priorities, and technical direction._

## Chat UI Integration Progress (2024-06)

Phase 2 of the Chat UI integration is complete. All UI components and utilities have been implemented in their correct locations. The next phase will focus on backend integration, tool call handling, and UI polish, supporting the project's core goals of seamless human-agent collaboration and high-quality output.

## Recent Updates (2024-06)

- Chat UI integration Phase 2 is complete: all UI components and utilities are implemented in their correct locations. Linter errors remain due to missing dependencies (e.g., @/components/ui/tooltip, @/components/ui/button, @/lib/utils), to be resolved in the next phase.
- Backend integration, tool call handling, and UI polish are the next focus areas.
- Orchestrator and graph now support rfpId and userId for multi-tenant, document-specific workflows.
- Supabase Auth SSR integration is robust and follows best practices (getAll/setAll, getUser()).
- Adapter pattern for checkpointing ensures future-proofing against LangGraph API changes.
- Project is on track for backend integration and final polish phases.
