# Proposal App Routing Structure

## Overview

This document outlines the routing structure of the proposal application, following Next.js best practices.

## Current Route Structure

- `/dashboard` - Main dashboard for listing proposals
- `/proposals/new` - Initial proposal creation page (deprecated, retained for backward compatibility) 
- `/proposals/new/rfp` - RFP proposal creation flow
- `/proposals/new/application` - Application proposal creation flow
- `/proposals/create` - Redirect-only route that forwards to the appropriate route based on the type parameter
- `/proposals/created` - Success page shown after proposal creation

## Routing Flow

1. User starts on the dashboard (`/dashboard`)
2. User clicks "New Proposal" button, opening the ProposalTypeModal
3. User selects a proposal type (RFP or Application)
4. User is redirected directly to either:
   - `/proposals/new/rfp` for RFP proposals
   - `/proposals/new/application` for Application proposals
5. After successful creation, user is redirected to `/proposals/created`

## Redirect Handling

- `/proposals/create` includes a redirect handler to ensure backward compatibility with any existing links
- The redirect uses `router.replace()` to clean up the navigation history

## Best Practices Applied

1. **Descriptive Routes**: Routes clearly indicate their purpose (`new/rfp` vs `new/application`)
2. **Simplified Navigation**: Direct routing to specific pages rather than parameter-based routing
3. **Client-Side Routing**: Using Next.js's `useRouter` hook for client-side navigation
4. **Backwards Compatibility**: Maintaining redirects for previously used routes

## Component Structure

- `ProposalTypeModal.tsx` - Modal for selecting proposal type
- `ProposalCreationFlow.tsx` - Main component for managing the proposal creation process
- `ApplicationQuestionsView.tsx` - View for application questions
- `RFPResponseView.tsx` - View for RFP document upload
- `FunderDetailsView.tsx` - View for funder information
- `ReviewProposalView.tsx` - Final review page before submission

Each proposal type (RFP and Application) has its own page that instantiates the ProposalCreationFlow component with the appropriate type.