# Date Handling and Components Cleanup

This document tracks progress on fixing date format inconsistencies and improving component standardization.

## Major Issues

- [x] **Date Format Inconsistency**:
  - [x] The backend API expects dates in "YYYY-MM-DD" format (as seen in actions.ts line 19)
  - [x] The UI now uses "DD/MM/YYYY" format (British format)
  - [x] Create date utility module to standardize conversions
- [ ] **Inconsistent Naming**:
  - [ ] FunderDetailsView uses `deadline` for the proposal due date
  - [ ] EnhancedRfpForm also uses `deadline` for the same concept
  - [ ] Standardize field naming across components for better maintainability
- [ ] **Multiple Date Picker Components**:
  - [x] Create centralized `EnhancedAppointmentPicker` component
  - [ ] Replace all instances of older components:
    - [ ] Remove `DatePicker.tsx` (original)
    - [ ] Remove `AppointmentPicker.tsx` (intermediate implementation)
    - [x] Use `EnhancedAppointmentPicker.tsx` consistently

## Minor Issues

- [x] **Date Format Conversion**:
  - [x] Create utility functions for consistent date formatting:
    - [x] `formatDateForUI(date: Date): string` - DD/MM/YYYY
    - [x] `formatDateForAPI(date: Date): string` - YYYY-MM-DD
    - [x] `parseUIDate(input: string): Date | null`
    - [x] `parseAPIDate(input: string): Date | null`
- [ ] **Field Validation**:
  - [x] Update `EnhancedAppointmentPicker` with parsing logic for DD/MM/YYYY
  - [ ] Synchronize validation in schemas with the format change
  - [ ] Add unit tests for validation
- [ ] **Error Handling**:
  - [x] Improve error handling for date parsing
  - [ ] Provide user feedback on invalid date formats
  - [ ] Use consistent error messages across components
- [x] **Visual Consistency**:
  - [x] Fix padding/styling for date picker components

## Trailing Bits to Clean Up

- [ ] **Orphaned Components**:
  - [ ] Remove old `DatePicker` component
  - [ ] Remove old `AppointmentPicker` component
  - [ ] Clean up import statements across the app
- [ ] **Documentation**:
  - [ ] Add proper JSDoc comments to `EnhancedAppointmentPicker`
  - [ ] Document date format expectations for developers
  - [ ] Update README with date handling conventions
- [x] **Duplicate Date Logic**:
  - [x] Extract common date parsing/formatting logic to utility functions
  - [x] Use utilities consistently across components

## State Management Recommendations

- [x] **Centralized Date Handling**:
  - [x] Create date utility module in `lib/utils/date-utils.ts`
  - [x] Implement utility functions for parsing and formatting
- [ ] **Form State Guidelines**:
  - [x] Store dates as Date objects in state
  - [x] Format at boundaries (UI display and API submission)
  - [ ] Use consistent prop names across components
- [ ] **API Interface Standardization**:
  - [ ] Implement consistent serialization/deserialization in API calls
  - [ ] Consider adapters or middleware for format conversions
- [ ] **Validation Enhancements**:
  - [ ] Update Zod schemas for UK date format validation
  - [ ] Add helpful error messages specific to date formatting
- [x] **Testing**:
  - [x] Convert tests to use Vitest
  - [x] Add tests for date formatting edge cases
  - [x] Test boundary conditions (null dates, invalid inputs)
