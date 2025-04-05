# Accessibility Issues Report and Fixes

## Overview

I've identified accessibility issues in the dialog components of your application. According to the console errors, there are missing `DialogTitle` and `DialogDescription` components or incorrect usage of these components, which makes the dialogs inaccessible for screen reader users.

## Issues Identified

1. **Missing DialogTitle**: Some `DialogContent` components do not have a `DialogTitle` as a direct child, which is required for screen reader accessibility.

2. **Missing Description**: Some `DialogContent` components are missing either a `DialogDescription` component or an `aria-describedby` attribute.

## Affected Components

The issues appear in the following components:

1. Dialog in `dialog.tsx:66` that's showing the accessibility warnings.
2. Potentially other dialogs across the application.

## Current Implementation

Your `dialog.tsx` component already has good accessibility-focused code:

1. It checks for the presence of `DialogTitle` as a direct child.
2. If missing, it adds a visually hidden title.
3. Components like `RFPResponseView.tsx` and `ApplicationQuestionsView.tsx` correctly include both `DialogTitle` and `DialogDescription` with proper `id` attributes.
4. These components also correctly set `aria-labelledby` and `aria-describedby` attributes.

## Recommended Fixes

### 1. Find and Fix Missing Dialog Titles

First, identify the dialog that's missing a title by using React DevTools to inspect the component that's logging the error. Once identified:

```jsx
// Before - missing DialogTitle
<DialogContent>
  <SomeContent />
</DialogContent>

// After - with DialogTitle
<DialogContent>
  <DialogTitle>Appropriate Title Here</DialogTitle>
  <SomeContent />
</DialogContent>
```

### 2. Add Descriptions to Dialogs

For dialogs missing descriptions:

```jsx
// Before - missing description
<DialogContent>
  <DialogTitle>Title</DialogTitle>
  <SomeContent />
</DialogContent>

// After - with description
<DialogContent>
  <DialogTitle>Title</DialogTitle>
  <DialogDescription>Brief description of the dialog's purpose</DialogDescription>
  <SomeContent />
</DialogContent>
```

### 3. Use Proper ARIA Attributes

Ensure all DialogContent components have proper ARIA attributes:

```jsx
<DialogContent
  aria-labelledby="unique-title-id"
  aria-describedby="unique-description-id"
>
  <DialogTitle id="unique-title-id">Title</DialogTitle>
  <DialogDescription id="unique-description-id">Description</DialogDescription>
  <SomeContent />
</DialogContent>
```

### 4. Create a Custom Dialog Component

To prevent future accessibility issues, consider creating a custom dialog component that enforces the presence of both title and description:

```jsx
export function AccessibleDialog({
  title,
  description,
  children,
  ...props
}) {
  const titleId = useId();
  const descriptionId = useId();
  
  return (
    <Dialog {...props}>
      <DialogContent 
        aria-labelledby={titleId} 
        aria-describedby={descriptionId}
      >
        <DialogTitle id={titleId}>{title}</DialogTitle>
        <DialogDescription id={descriptionId}>{description}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}
```

## Implementation Steps

1. **Locate the problematic dialog**: Use React DevTools during development to identify which dialog is causing the errors.

2. **Add the missing components**: Follow the patterns used in `RFPResponseView.tsx` and `ApplicationQuestionsView.tsx`.

3. **Create a testing utility**: Add an automated check to verify that all dialogs have appropriate accessibility attributes.

4. **Review all dialogs**: Conduct a comprehensive review of all dialogs in the application to ensure they meet accessibility requirements.

## Accessibility Best Practices (From PLANNING.md)

Your PLANNING.md file already outlines excellent accessibility guidelines:

- **WCAG Conformance**: Adhere to WCAG 2.1 Level AA standards
- **Semantic HTML**: Use proper elements for their intended purpose
- **Keyboard Navigation**: Ensure all components are keyboard accessible
- **ARIA Attributes**: Implement appropriate ARIA attributes
- **Focus Management**: Maintain visible focus indicators

The fixes outlined above will help bring your dialog components in line with these stated accessibility goals.

## Long-term Improvements

1. **Accessibility Audits**: Implement regular accessibility audits as part of the development workflow.

2. **Component Library Documentation**: Update your UI component documentation to clearly specify accessibility requirements.

3. **Automated Testing**: Implement automated testing for accessibility issues using tools like jest-axe.

4. **Focus Management**: Enhance focus management for modals to ensure focus is properly trapped within the dialog.

5. **Keyboard Shortcuts**: Add and document keyboard shortcuts for common dialog actions.

By addressing these issues, you'll ensure that your application meets the accessibility requirements outlined in your planning document and provides a better experience for all users, including those who rely on assistive technologies.