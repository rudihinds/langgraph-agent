# Proposal Agent System: Technical Stack

## Architecture Overview
- **Monorepo Structure**: `apps/backend`, `apps/web`, `packages/shared`
- **Application Type**: Full-stack web application
- **State Management**: Persistent state storage in PostgreSQL
- **Authentication**: Supabase Auth with Google OAuth

## Frontend Technologies
- **Framework**: Next.js 14 (App Router)
- **UI Library**: React 18
- **Component System**: 21st.dev Message Component Protocol
- **Styling**: Tailwind CSS
- **Forms**: React Hook Form with Zod schema validation
- **File Upload**: Custom implementation with Supabase Storage
- **State Management**: React Context API

## Backend Technologies
- **Runtime**: Node.js
- **Language**: TypeScript 5
- **API Framework**: Next.js API Routes + Server Actions
- **File Processing**: Custom parsers for RFP documents
- **Date Handling**: Custom utilities for consistent formatting

## Database & Storage
- **Database**: Supabase PostgreSQL
- **Storage**: Supabase Storage for document files
- **Schema**: 
  - Users table
  - Proposals table
  - Proposal states table
  - Proposal documents table
  - Proposal checkpoints table
- **Vector Database**: Pinecone for semantic search and embedding storage

## Authentication & Security
- **Authentication Provider**: Supabase Auth with Google OAuth
- **Session Management**: Server-side session handling
- **Authorization**: Row Level Security policies in PostgreSQL
- **Data Protection**: User-specific access controls for proposals
- **Storage Security**: Authenticated storage access with bucket policies

## Testing & Quality Assurance
- **Test Framework**: Vitest (NOT Jest)
- **Component Testing**: React Testing Library
- **E2E Testing**: Playwright
- **Mocking**: MSW (Mock Service Worker) for API mocks
- **Type Safety**: TypeScript with strict mode
- **Form Validation**: Zod schemas

## DevOps & Deployment
- **Package Management**: npm (NOT yarn)
- **Dependency Management**: Workspace configuration in root package.json
- **Environment Variables**: .env files with type-safe schema validation
- **Version Control**: Git with GitHub

## Project Structure
- **Apps**:
  - `apps/web`: Next.js frontend application
  - `apps/backend`: Backend infrastructure
- **Packages**:
  - `packages/shared`: Shared types, utilities, and components
- **Major Directories**:
  - `/api`: API routes and handlers
  - `/lib`: Shared utilities
  - `/ui`: UI components and pages
  - `/components`: React components