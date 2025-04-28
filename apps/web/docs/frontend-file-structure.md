// this may need updating soon with a deep review of /web, but this will work for
//now for the core folders eg /app and /src

# Frontend File Structure

## Overview

This document outlines the file structure of the frontend application after the refactoring. The project follows a feature-based architecture pattern, which organizes code by domain features rather than technical concerns. This approach improves discoverability, maintainability, and scalability of the codebase.

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
├── .env.example        # Example environment variables
├── next.config.mjs     # Next.js configuration
├── package.json        # Package dependencies
├── tailwind.config.js  # Tailwind CSS configuration
└── tsconfig.json       # TypeScript configuration
```

## App Router Structure

The application uses Next.js App Router, with routes defined in the root `app/` directory:

```
app/
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
│   └── proposals/      # Proposal API routes
│       └── [id]/       # Proposal by ID routes
├── auth/               # Authentication pages
│   ├── callback/       # OAuth callback handling
│   └── login/          # Login page
├── auth-test/          # Authentication test page
├── dashboard/          # Dashboard pages
│   ├── simple/         # Simple dashboard variation
│   └── test-page.tsx   # Test dashboard page
├── debug/              # Debug page
├── login/              # Login page
├── proposals/          # Proposal routes
│   ├── [id]/           # Specific proposal page
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
├── supabase/           # Supabase client and utilities
│   ├── auth/           # Authentication utilities
│   ├── types/          # Supabase-related types
│   ├── docs/           # Supabase integration documentation
│   ├── __tests__/      # Supabase tests
│   ├── client.ts       # Browser client initialization
│   ├── server.ts       # Server-side client utilities
│   ├── middleware.ts   # Authentication middleware
│   ├── errors.ts       # Error handling utilities
│   ├── compatibility.ts # Compatibility layer
│   ├── index.ts        # Main exports
│   └── README.md       # Documentation
├── utils/              # Shared utility functions
└── validators/         # Shared validation schemas
```

## Component Organization

- **Shared Components**: Reusable UI components that are used across multiple features live in `src/components`
- **Feature Components**: Components specific to a feature live in the feature's components directory
- **Page Components**: Components that represent entire pages live in the appropriate route directory in `app/`

## Detailed Structure Diagram

```
apps/web/
├── app/                                    # Next.js App Router
│   ├── api/                                # API route handlers
│   │   ├── auth/                           # Auth API routes
│   │   │   ├── login/                      # Login API
│   │   │   ├── sign-in/                    # Sign-in API
│   │   │   ├── sign-out/                   # Sign-out API
│   │   │   ├── sign-up/                    # Sign-up API
│   │   │   ├── test-supabase/              # Supabase test API
│   │   │   └── verify-user/                # User verification API
│   │   ├── diagnostics/                    # Diagnostic routes
│   │   ├── langgraph/                      # LangGraph routes
│   │   │   └── [...path]/                  # Catch-all route
│   │   └── proposals/                      # Proposal API routes
│   │       ├── [id]/                       # Proposal by ID routes
│   │       │   └── upload/                 # Upload to proposal route
│   │       └── actions[dep].ts             # Server actions (deprecated)
│   ├── auth/                               # Authentication routes
│   │   ├── callback/                       # OAuth callback handling
│   │   └── login/                          # Login page
│   ├── auth-test/                          # Auth testing page
│   ├── dashboard/                          # Dashboard pages
│   │   ├── simple/                         # Simple dashboard variant
│   │   ├── __tests__/                      # Dashboard tests
│   │   ├── layout.tsx                      # Dashboard layout
│   │   ├── metadata.ts                     # Dashboard metadata
│   │   ├── page.tsx                        # Dashboard main page
│   │   └── test-page.tsx                   # Test dashboard page
│   ├── debug/                              # Debug routes
│   ├── login/                              # Login page
│   ├── proposals/                          # Proposal routes
│   │   ├── __tests__/                      # Proposal tests
│   │   ├── create/                         # Proposal creation redirect
│   │   ├── created/                        # Post-creation success page
│   │   ├── new/                            # New proposal setup page
│   │   │   ├── __tests__/                  # New proposal tests
│   │   │   ├── application/                # Application proposal flow
│   │   │   ├── rfp/                        # RFP proposal flow
│   │   │   └── page.tsx                    # New proposal landing page
│   │   └── page.tsx                        # Proposals list page
│   ├── favicon.ico                         # Site favicon
│   ├── globals.css                         # Global CSS
│   ├── layout.tsx                          # Root layout
│   └── page.tsx                            # Home page
│
├── docs/                                   # Documentation
│   ├── frontend-file-structure.md          # This document
│   └── routing.md                          # Routing documentation
│
├── public/                                 # Static assets
│   ├── favicon.ico                         # Favicon
│   └── images/                             # Image assets
│
├── src/                                    # Source code
│   ├── components/                         # Shared UI components
│   │   ├── common/                         # Basic UI elements
│   │   ├── layouts/                        # Layout components
│   │   └── ui/                             # shadcn/ui components
│   │
│   ├── features/                           # Feature modules
│   │   ├── auth/                           # Authentication feature
│   │   │   ├── api/                        # Auth API calls
│   │   │   ├── components/                 # Auth-specific components
│   │   │   ├── hooks/                      # Auth hooks (useAuth, etc.)
│   │   │   ├── types/                      # Auth types
│   │   │   ├── utils/                      # Auth utilities
│   │   │   ├── hoc/                        # Higher-order components
│   │   │   ├── errors.ts                   # Auth error handling
│   │   │   ├── middleware.ts               # Auth middleware
│   │   │   └── FILE_ANALYSIS.md            # Feature documentation
│   │   │
│   │   ├── proposals/                      # Proposals feature
│   │   │   ├── api/                        # Proposal API calls
│   │   │   ├── components/                 # Proposal-specific components
│   │   │   │   ├── creation/               # Creation flow components
│   │   │   │   ├── display/                # Display components
│   │   │   │   └── editing/                # Editing components
│   │   │   ├── hooks/                      # Proposal hooks
│   │   │   ├── types/                      # Proposal types
│   │   │   └── utils/                      # Proposal utilities
│   │   │
│   │   └── users/                          # User management feature
│   │       ├── api/                        # User API calls
│   │       ├── components/                 # User-specific components
│   │       ├── hooks/                      # User hooks
│   │       ├── types/                      # User types
│   │       └── utils/                      # User utilities
│   │
│   ├── hooks/                              # Shared hooks
│   │
│   ├── lib/                                # Shared libraries
│   │   ├── supabase/                       # Supabase integration
│   │   │   ├── auth/                       # Supabase auth utilities
│   │   │   ├── types/                      # Supabase types
│   │   │   ├── docs/                       # Supabase documentation
│   │   │   ├── __tests__/                  # Supabase tests
│   │   │   ├── client.ts                   # Browser client
│   │   │   ├── server.ts                   # Server client
│   │   │   ├── middleware.ts               # Auth middleware
│   │   │   ├── errors.ts                   # Error handling
│   │   │   ├── compatibility.ts            # Compatibility layer
│   │   │   ├── index.ts                    # Main exports
│   │   │   └── README.md                   # Documentation
│   │   │
│   │   ├── api/                            # API utilities
│   │   ├── proposal-actions/               # Proposal action helpers
│   │   ├── user-management/                # User management helpers
│   │   ├── diagnostic-tools/               # Diagnostic utilities
│   │   └── utils/                          # General utilities
│   │
│   ├── providers/                          # Context providers
│   ├── schemas/                            # Validation schemas
│   ├── __tests__/                          # Source code tests
│   ├── middleware.ts                       # Next.js middleware
│   └── env.ts                              # Environment variables
│
├── .env.example                            # Example environment variables
├── next.config.mjs                         # Next.js configuration
├── package.json                            # Package dependencies
├── postcss.config.js                       # PostCSS configuration
├── tailwind.config.js                      # Tailwind CSS configuration
└── tsconfig.json                           # TypeScript configuration
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

## Migration Notes

When working with existing code:

1. Gradually migrate legacy code to follow this structure
2. Prioritize feature-based organization for new code
3. Update imports when moving files to maintain compatibility
4. Test thoroughly after structural changes

## References

- [Next.js Documentation](https://nextjs.org/docs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Feature-Sliced Design](https://feature-sliced.design/)
- [Supabase Documentation](https://supabase.io/docs)
