# Form Validation System

This directory contains a modular form validation system that uses Zod schemas for validation and provides a consistent way to handle form state and errors.

## Overview

The system consists of:

1. **useZodForm Hook**: A React hook that manages form state, validation, and submission.
2. **Form Schemas**: Zod schemas that define validation rules for each form.
3. **FormField Components**: Reusable UI components for rendering form fields with validation.

## How to Use

### 1. Define a Schema

Create a schema in `schemas` directory:

```typescript
// schemas/my-form-schema.ts
import { z } from 'zod';

export const myFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  email: z.string().email({ message: 'Please enter a valid email' }),
  // Add more fields as needed
});

export type MyFormValues = z.infer<typeof myFormSchema>;
```

### 2. Use the Form Hook

In your form component:

```typescript
import { useZodForm } from '@/lib/forms/useZodForm';
import { myFormSchema } from '@/lib/forms/schemas/my-form-schema';

function MyForm() {
  const {
    values,
    errors,
    isSubmitting,
    setValue,
    handleSubmit
  } = useZodForm(myFormSchema);

  const onSubmit = handleSubmit(async (formValues) => {
    // Handle form submission
    await submitFormData(formValues);
  });

  return (
    <form onSubmit={onSubmit}>
      {/* Use FormField components */}
    </form>
  );
}
```

### 3. Use FormField Components

```tsx
<FormField
  id="name"
  type="text"
  label="Name"
  value={values.name || ''}
  onChange={(value) => setValue('name', value)}
  error={errors.name}
  required
/>

<FormField
  id="email"
  type="email"
  label="Email"
  value={values.email || ''}
  onChange={(value) => setValue('email', value)}
  error={errors.email}
  required
/>
```

## Benefits

- **Consistent Validation**: All forms use the same validation patterns
- **Type Safety**: TypeScript integration through Zod schemas
- **Reusable Components**: Field components handle display, state, and errors
- **Centralized Error Handling**: Uses our standard error format
- **Accessibility**: Built-in aria attributes and error handling
- **Progressive Enhancement**: Works with or without JavaScript

## Architecture

```
/forms
  /schemas            - Zod schemas for each form
  useZodForm.ts       - Core hook for form state management
  README.md           - Documentation
```

## Components

```
/ui
  form-field.tsx      - Generic form field component
  file-upload-field.tsx - Specialized file upload component
  form-error.tsx      - Error display components
```

## Integration with API

The system uses the existing `form-errors.ts` utilities to handle API errors and format them consistently with client-side validation errors.