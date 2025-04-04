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
- **UI Library**: React with 21st.dev Message Component Protocol as the primary styling system
- **Styling**: Tailwind CSS with consistent design tokens aligned with 21st.dev specifications
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
 - GPT-o3-mini (deep research)
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

### Design System & Styling
- Use 21st.dev Message Component Protocol as the primary component library
- Maintain consistent styling with 21st.dev's design language across all UI components
- Implement a unified color scheme, typography, and spacing system that aligns with 21st.dev
- Prefer 21st.dev components over other UI libraries when available
- Extend 21st.dev components with consistent Tailwind utility classes when needed
- Implement responsive designs following 21st.dev's layout patterns
- Create shared style tokens for colors, spacing, and typography to ensure consistency

### Accessibility (ARIA) Compliance
- **WCAG Conformance**: Adhere to WCAG 2.1 Level AA standards throughout the application
- **Semantic HTML**: Use proper HTML elements for their intended purpose (buttons, headings, lists, etc.)
- **Keyboard Navigation**:
 - Ensure all interactive elements are keyboard accessible with logical tab order
 - Implement focus management for modals, drawers, and other dynamic content
 - Add keyboard shortcuts for frequent actions with appropriate documentation
- **ARIA Attributes**:
 - Include appropriate `aria-label`, `aria-labelledby`, and `aria-describedby` attributes
 - Implement `aria-live` regions for dynamic content updates from agents
 - Use `aria-expanded`, `aria-haspopup`, and `aria-controls` for interactive components
 - Apply proper `role` attributes when native semantics need enhancement
- **Focus Indicators**: Maintain visible focus indicators that meet contrast requirements
- **Form Accessibility**:
 - Associate labels with form controls using `for`/`id` attributes
 - Provide clear error states with `aria-invalid` and descriptive error messages
 - Group related form elements with `fieldset` and `legend`
- **Color and Contrast**:
 - Ensure 4.5:1 contrast ratio for normal text and 3:1 for large text
 - Never use color alone to convey information
- **Screen Reader Support**:
 - Provide alternative text for all non-decorative images
 - Create descriptive labels for icons and graphical UI elements
 - Hide decorative elements from screen readers with `aria-hidden="true"`
- **Progress Indication**:
 - Use `aria-busy` and `aria-live` regions to announce progress updates
 - Implement progress bars with appropriate ARIA roles and properties
- **Content Structure**:
 - Use appropriate heading levels (h1-h6) for hierarchical content structure
 - Organize lists with semantic `ul`/`ol` elements
 - Apply proper landmark roles for major page sections
- **Testing and Validation**:
 - Conduct automated accessibility testing as part of the CI/CD pipeline
 - Perform manual testing with screen readers (NVDA, JAWS, VoiceOver)
 - Include keyboard-only testing protocols
 - Document accessibility features in user documentation

## Development Approach
- Modular implementation with focused subgraphs
- Test-driven development for core functionality
- Iterative UI development integrated with agent capabilities
- Strict adherence to the 21st.dev design system for UI components
- Continuous integration with GitHub Actions
- Regular user testing for feedback and refinement
- Accessibility audits at each development milestone

## Future Enhancements
- Template library for common proposal types
- AI-powered proposal evaluation against grant criteria
- Collaborative proposal editing
- Integration with grant databases
- Extended funder research capabilities
- Custom section addition and reordering
- Enhanced 21st.dev component customizations for specialized proposal displays
- Advanced accessibility features including personalization options