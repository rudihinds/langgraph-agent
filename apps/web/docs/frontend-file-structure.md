// this may need updating soon with a deep review of /web, but this will work for
//now for the core folders eg /app and /src

# Frontend File Structure

## Overview

This document outlines the file structure of the frontend application after comprehensive refactoring and cleanup. The project follows a feature-based architecture pattern, which organizes code by domain features rather than technical concerns. This approach improves discoverability, maintainability, and scalability of the codebase.

**Last Updated**: January 25, 2025  
**Total TypeScript Files**: 230 files  
**Status**: Post-refactoring cleanup complete

## Core Principles

1. **Feature-Based Organization**: Code is organized by business domain features rather than technical layers
2. **Encapsulation**: Features encapsulate their own components, hooks, types, and utilities
3. **Shared Code**: Common code is extracted into the `lib` directory or shared feature modules
4. **Clear Boundaries**: Features have well-defined interfaces and minimal cross-dependencies
5. **Co-location**: Related files are kept together to improve discoverability

## Root Structure

```
apps/web/
├── app/                # Next.js App Router pages and layouts
├── src/                # Source code for components and features
├── docs/               # Documentation files
├── public/             # Static assets
├── .next/              # Next.js build output
├── node_modules/       # Dependencies
├── .env.development    # Development environment variables
├── .env.example        # Example environment variables
├── next.config.mjs     # Next.js configuration
├── package.json        # Package dependencies
├── tailwind.config.js  # Tailwind CSS configuration
├── tsconfig.json       # TypeScript configuration
└── vitest.config.ts    # Vitest test configuration
```

## App Router Structure

The application uses Next.js App Router, with routes defined in the root `app/` directory:

```
app/
├── __tests__/          # Tests for root pages
├── api/                # API route handlers
│   ├── auth/           # Authentication API routes
│   │   ├── login/      # Login API
│   │   ├── sign-in/    # Sign-in API
│   │   ├── sign-out/   # Sign-out API
│   │   ├── sign-up/    # Sign-up API
│   │   ├── test-supabase/ # Supabase test API
│   │   └── verify-user/# User verification API
│   ├── diagnostics/    # Diagnostic routes
│   ├── langgraph/      # LangGraph routes
│   │   └── [...path]/  # Catch-all route
│   ├── proposals/      # Proposal API routes
│   │   └── [id]/       # Proposal by ID routes
│   │       └── upload/ # Upload endpoints
│   └── rfp/            # RFP API routes
│       ├── thread/     # Thread management
│       │   └── [threadId]/ # Specific thread routes
│       └── threads/    # Threads list endpoints
├── auth/               # Authentication pages
│   ├── callback/       # OAuth callback handling
│   └── login/          # Login page
├── auth-test/          # Authentication test page
├── dashboard/          # Dashboard pages
│   ├── chat/           # Chat interface within dashboard
│   ├── simple/         # Simple dashboard variation
│   └── test-page.tsx   # Test dashboard page
├── debug/              # Debug page
├── login/              # Login page
├── proposals/          # Proposal routes
│   ├── create/         # Redirect handler for proposal creation
│   ├── created/        # Success page after creation
│   └── new/            # Proposal creation pages
│       ├── application/ # Application proposal flow
│       └── rfp/        # RFP proposal flow
├── globals.css         # Global CSS
├── layout.tsx          # Root layout
└── page.tsx            # Home page
```

## Feature Module Structure

Each feature in the `src/features` directory has a standardized structure:

```
src/features/<feature-name>/
├── api/                # API interactions specific to this feature
├── components/         # UI components specific to this feature
├── hooks/              # React hooks specific to this feature
├── types/              # TypeScript types for this feature
├── utils/              # Utility functions for this feature
└── index.ts            # Public API of the feature
```

## Shared Libraries

The `src/lib` directory contains shared code that can be used across features:

```
src/lib/
├── api/                # API utilities and route handlers
├── errors/             # Error handling utilities
├── forms/              # Form-related utilities
│   └── schemas/        # Form validation schemas
├── logger/             # Shared logging utilities
├── schema/             # Schema definitions
├── supabase/           # Supabase client and utilities
│   ├── auth/           # Authentication utilities
│   ├── docs/           # Supabase integration documentation
│   ├── types/          # Supabase-related types
│   ├── client.ts       # Browser client initialization
│   ├── server.ts       # Server-side client utilities
│   └── middleware.ts   # Authentication middleware
└── utils/              # Shared utility functions
```

## Component Organization

- **Shared Components**: Reusable UI components that are used across multiple features live in `src/components`
- **Feature Components**: Components specific to a feature live in the feature's components directory
- **Page Components**: Components that represent entire pages live in the appropriate route directory in `app/`

## Detailed Structure Diagram

```
apps/web/
├── app/                                    # Next.js App Router
│   ├── __tests__/                          # Root tests
│   ├── api/                                # API route handlers
│   │   ├── auth/                           # Auth API routes
│   │   │   ├── __tests__/                  # Auth API tests
│   │   │   ├── login/                      # Login API
│   │   │   ├── sign-in/                    # Sign-in API
│   │   │   ├── sign-out/                   # Sign-out API
│   │   │   ├── sign-up/                    # Sign-up API
│   │   │   ├── test-supabase/              # Supabase test API
│   │   │   └── verify-user/                # User verification API
│   │   ├── diagnostics/                    # Diagnostic routes
│   │   ├── langgraph/                      # LangGraph routes
│   │   │   └── [...path]/                  # Catch-all route
│   │   ├── proposals/                      # Proposal API routes
│   │   │   ├── __tests__/                  # Proposal API tests
│   │   │   ├── [id]/                       # Proposal by ID routes
│   │   │   │   └── upload/                 # Upload endpoints
│   │   │   ├── actions[dep].ts             # Proposal actions
│   │   │   └── route.ts                    # Proposal route handler
│   │   └── rfp/                            # RFP API routes
│   │       ├── thread/                     # Thread endpoints
│   │       │   ├── [threadId]/             # Specific thread routes
│   │       │   └── route.ts                # Thread route handler
│   │       └── threads/                    # Threads list endpoints
│   ├── auth/                               # Authentication routes
│   │   ├── __tests__/                      # Auth tests
│   │   ├── callback/                       # OAuth callback handling
│   │   │   ├── __tests__/                  # Callback tests
│   │   │   └── route.ts                    # Callback route handler
│   │   └── login/                          # Login page
│   │       └── page.tsx                    # Login page component
│   ├── auth-test/                          # Auth testing page
│   │   └── page.tsx                        # Auth test page component
│   ├── dashboard/                          # Dashboard pages
│   │   ├── __tests__/                      # Dashboard tests
│   │   ├── chat/                           # Chat interface within dashboard
│   │   │   └── page.tsx                    # Chat page component
│   │   ├── simple/                         # Simple dashboard variant
│   │   │   └── page.tsx                    # Simple dashboard page
│   │   ├── layout.tsx                      # Dashboard layout
│   │   ├── metadata.ts                     # Dashboard metadata
│   │   └── page.tsx                        # Dashboard main page
│   ├── debug/                              # Debug routes
│   │   └── page.tsx                        # Debug page component
│   ├── login/                              # Login page
│   │   ├── __tests__/                      # Login tests
│   │   └── page.tsx                        # Login page component
│   ├── proposals/                          # Proposal routes
│   │   ├── __tests__/                      # Proposal page tests
│   │   ├── create/                         # Proposal creation redirect
│   │   │   └── page.tsx                    # Creation redirect page
│   │   ├── created/                        # Post-creation success page
│   │   │   └── page.tsx                    # Success page component
│   │   ├── new/                            # New proposal setup page
│   │   │   ├── __tests__/                  # New proposal tests
│   │   │   ├── application/                # Application proposal flow
│   │   │   │   └── page.tsx                # Application page component
│   │   │   ├── rfp/                        # RFP proposal flow
│   │   │   │   └── page.tsx                # RFP page component
│   │   │   └── page.tsx                    # New proposal page
│   │   └── page.tsx                        # Proposals list page
│   ├── globals.css                         # Global CSS
│   ├── layout.tsx                          # Root layout
│   └── page.tsx                            # Home page
│
├── docs/                                   # Documentation
│   ├── auth-integration.md                 # Auth integration docs
│   ├── frontend-file-structure.md          # This document
│   └── routing.md                          # Routing documentation
│
├── public/                                 # Static assets
│   └── images/                             # Image assets
│       └── empty-proposals.svg             # Empty state illustration
│
├── src/                                    # Source code
│   │   # Note: __tests__ directory removed during cleanup
│   │   # Note: components/ directory removed during cleanup (unused legacy code)
│   │
│   ├── features/                           # Feature modules
│   │   ├── auth/                           # Authentication feature
│   │   │   ├── api/                        # Auth API calls
│   │   │   │   ├── __tests__/              # Auth API tests
│   │   │   │   ├── docs/                   # Auth API docs (cleaned up)
│   │   │   │   └── examples/               # Auth examples (cleaned up)
│   │   │   ├── components/                 # Auth-specific components (LoginButton only)
│   │   │   ├── hooks/                      # Auth hooks (useAuth, etc.)
│   │   │   │   └── __tests__/              # Auth hook tests
│   │   │   └── types/                      # Auth types (consolidated)
│   │   │
│   │   ├── chat/                           # Chat feature
│   │   │   └── components/                 # Chat components
│   │   │       ├── lib/                    # Chat component utilities
│   │   │       ├── providers/              # Chat providers
│   │   │       └── thread/                 # Thread components
│   │   │           └── messages/           # Message components
│   │   │
│   │   ├── chat-ui/                        # Chat UI feature
│   │   │   ├── components/                 # Chat UI components
│   │   │   │   ├── agent-inbox/            # Agent inbox components
│   │   │   │   ├── icons/                  # Icon components
│   │   │   │   ├── messages/               # Message components
│   │   │   │   ├── thread/                 # Thread components
│   │   │   │   └── thread-history/         # Thread history components
│   │   │   ├── context/                    # Context providers
│   │   │   ├── hooks/                      # Chat-related hooks
│   │   │   ├── lib/                        # Chat-specific libraries
│   │   │   ├── providers/                  # Stream and thread providers
│   │   │   ├── types/                      # Chat type definitions
│   │   │   └── utils/                      # Utility functions
│   │   │
│   │   ├── dashboard/                      # Dashboard feature
│   │   │   └── components/                 # Dashboard components
│   │   │       └── __tests__/              # Dashboard component tests
│   │   │
│   │   ├── layout/                         # Layout feature
│   │   │   └── components/                 # Layout components
│   │   │       └── __tests__/              # Layout component tests
│   │   │
│   │   ├── proposals/                      # Proposals feature
│   │   │   ├── api/                        # Proposal API calls
│   │   │   ├── components/                 # Proposal-specific components
│   │   │   │   └── __tests__/              # Proposal component tests
│   │   │   └── utils/                      # Proposal utilities
│   │   │
│   │   ├── rfp/                            # RFP feature
│   │   │   └── hooks/                      # RFP-related hooks
│   │   │
│   │   ├── shared/                         # Shared feature components
│   │   │   ├── __tests__/                  # Shared component tests
│   │   │   └── components/                 # Shared UI components
│   │   │       ├── error/                  # Error handling components
│   │   │       └── icons/                  # Shared icons
│   │   │
│   │   ├── thread/                         # Thread feature
│   │   │   └── components/                 # Thread-related components
│   │   │       ├── agent-inbox/            # Agent inbox components
│   │   │       ├── history/                # Thread history components
│   │   │       └── messages/               # Message components
│   │   │
│   │   └── ui/                             # UI feature
│   │       └── components/                 # UI-specific components
│   │           └── __tests__/              # UI component tests
│   │
│   ├── hooks/                              # Shared hooks
│   │   └── __tests__/                      # Hook tests
│   │
│   ├── lib/                                # Shared libraries
│   │   ├── api/                            # API utilities
│   │   ├── errors/                         # Error handling
│   │   │   └── __tests__/                  # Error handling tests
│   │   ├── forms/                          # Form utilities
│   │   │   └── schemas/                    # Form validation schemas
│   │   ├── logger/                         # Logging utilities
│   │   ├── schema/                         # Schema definitions
│   │   ├── supabase/                       # Supabase integration
│   │   │   ├── __tests__/                  # Supabase tests
│   │   │   ├── auth/                       # Supabase auth utilities
│   │   │   │   └── __tests__/              # Auth utility tests
│   │   │   ├── docs/                       # Supabase documentation
│   │   │   └── types/                      # Supabase type definitions
│   │   └── utils/                          # General utilities
│   │
│   ├── providers/                          # Context providers
│   └── schemas/                            # Validation schemas
│
├── .env.development                        # Development environment variables
├── .env.example                            # Example environment variables
├── next.config.mjs                         # Next.js configuration
├── package.json                            # Package dependencies
├── tailwind.config.js                      # Tailwind CSS configuration
├── tsconfig.json                           # TypeScript configuration
└── vitest.config.ts                        # Vitest test configuration
```

## Guidelines for Adding New Code

### Adding a New Feature

1. Create a new directory under `src/features/<feature-name>`
2. Follow the standard feature structure (api, components, hooks, types, utils)
3. Export the public API through `index.ts`
4. Keep feature-specific code within the feature directory

### Adding New Components

1. **Feature-Specific Components**: Add to `src/features/<feature-name>/components/`
2. **Shared Components**: Add to `src/components/` if used across multiple features
3. **UI Components**: For shadcn/ui components, add to `src/components/ui/`

### Adding New Pages

1. Create a new directory under `app/` following the route structure
2. Create a `page.tsx` file for the route content
3. Add any required layout with a `layout.tsx` file
4. Handle errors with an `error.tsx` file if needed

### Adding API Endpoints

1. **Feature-Specific API**: Add to `src/features/<feature-name>/api/`
2. **Route Handlers**: Add to `app/api/` following the Next.js App Router conventions

## Best Practices

1. **Imports**:

   - Use relative imports within a feature
   - Use absolute imports (`@/`) for importing from other features or shared code

2. **Feature Boundaries**:

   - Minimize cross-feature dependencies
   - Use the feature's public API (exported from index.ts) when importing from another feature

3. **Component Naming**:

   - Use PascalCase for component files and directories
   - Use kebab-case for utility files and non-component directories

4. **Code Organization**:

   - Keep related code together
   - Extract common code to shared locations
   - Prefer small, focused files over large ones

5. **Documentation**:
   - Document complex components with comments
   - Update this file when making significant structural changes

## Recent Changes (January 2025)

### Cleanup Summary

- **Removed unused test files**: Deleted broken test files (Stream.test.tsx, Thread.test.tsx) and placeholder tests (auth.test.ts, setup.js)
- **Removed unused auth components**: Cleaned up LoginForm, UserProfile, StandardLoginForm, and auth HOCs
- **Removed unused directories**: Eliminated empty **tests** and components directories
- **Consolidated auth types**: Merged duplicate type definitions into single source
- **Fixed import paths**: Updated all imports to use new consolidated structure
- **Authentication migration**: Moved from custom auth client to direct Supabase auth integration

### Files Removed (Total: 22)

- 4 broken/placeholder test files
- 7 unused auth components and utilities
- 3 deprecated auth documentation files
- 8 duplicate/deprecated files from previous refactoring phases

### Current State

- ✅ All TypeScript compilation errors resolved
- ✅ All import paths updated and working
- ✅ Authentication system fully functional with Supabase
- ✅ Build process working correctly
- ✅ Dev server running successfully on port 3000

## Migration Notes

When working with existing code:

1. Follow the established feature-based organization
2. Use consolidated auth patterns (Supabase direct integration)
3. Place new components in appropriate feature directories
4. Test thoroughly after any structural changes
5. Refer to this document for current structure before adding new files

## References

- [Next.js Documentation](https://nextjs.org/docs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Feature-Sliced Design](https://feature-sliced.design/)
- [Supabase Documentation](https://supabase.io/docs)
