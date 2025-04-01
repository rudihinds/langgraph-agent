# Proposal Agent System - Project Planning

## Project Overview
The Proposal Agent System is an AI-powered application that assists users in creating high-quality proposals for grants and RFPs. The system uses a multi-agent architecture built with LangGraph.js to analyze RFPs, understand funder requirements, identify alignment opportunities, and generate comprehensive proposal sections.

## Scope

### Core Functionality
- RFP/grant questions analysis
- Deep research on funders and related entities
- Solution analysis to determine what the funder is seeking
- Connection pairs generation to identify alignment between applicant and funder
- Structured proposal generation following section dependencies
- Human-in-the-loop feedback and revision cycles
- Persistent state management for ongoing proposal work
- Complete proposal export functionality

### User Experience
- Google OAuth authentication
- Multiple proposal management
- Persistent sessions for continuing work
- Real-time feedback and interaction with agents
- Progress tracking throughout the proposal creation process
- Final proposal compilation and download

## Technology Stack

### Frontend
- **Framework**: Next.js (via create-agent-chat-app)
- **UI Library**: React with Tailwind CSS
- **Authentication**: Supabase Auth with Google OAuth

### Backend
- **Runtime**: Node.js
- **Language**: TypeScript
- **Agent Framework**: LangGraph.js
- **Database**: Supabase PostgreSQL
- **Storage**: Supabase Storage
- **Authentication**: Supabase Auth

### AI & Machine Learning
- **Framework**: LangGraph.js with LangChain.js
- **LLMs**: 
  - Claude 3.7 Sonnet (primary thinking/writing model)
  - Claude 3 Opus (deep research)
  - GPT-4o-mini (vector store interactions)
- **Embeddings**: Gemini Text Embeddings
- **Vector Database**: Pinecone

## Architecture

### Agent Structure
1. **Orchestrator Agent**: Manages overall flow and user interactions
2. **Research Agent**: Performs deep analysis of RFP documents
3. **Solution Sought Agent**: Determines what solution the funder is looking for
4. **Connection Pairs Agent**: Identifies alignment between applicant and funder
5. **Proposal Manager Agent**: Coordinates section generation in dependency order
6. **Section Generator Agents**: Create individual proposal sections
7. **Evaluator Agent**: Assesses quality of generated content

### Data Flow
1. User uploads RFP or enters grant questions
2. Research is performed on funder and related entities
3. Solution requirements are analyzed and presented to user
4. Connection pairs are generated and approved by user
5. Proposal sections are generated in dependency order
6. Each section is evaluated, revised as needed, and approved by user
7. Complete proposal is compiled and presented for download

### State Management
- LangGraph state persisted in Supabase
- Checkpoint-based persistence for resuming sessions
- Thread-based organization for multiple proposals
- Human-in-the-loop interactions via interrupt() function

## Development Approach
- Modular implementation with focused subgraphs
- Test-driven development for core functionality
- Iterative UI development integrated with agent capabilities
- Continuous integration with GitHub Actions
- Regular user testing for feedback and refinement

## Future Enhancements
- Template library for common proposal types
- AI-powered proposal evaluation against grant criteria
- Collaborative proposal editing
- Integration with grant databases
- Extended funder research capabilities
- Custom section addition and reordering