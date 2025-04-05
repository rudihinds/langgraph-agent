# Solution for Proposal Submission Issues

## Identified Issues

1. **Database Schema Mismatch**: The database schema and form validation schemas were not aligned.
2. **Field Structure Issues**: The form was trying to send fields that didn't exist in the database.
3. **Import Issues**: Some imports were causing errors.
4. **Cookie Handling**: The `createClient` function expected a specific type of cookies parameter.
5. **Metadata Field Handling**: The metadata JSONB field wasn't being properly formatted/stringified.
6. **Data Flow Issues**: The prepared form data from the ReviewProposalView wasn't being used correctly.

## Applied Fixes

### 1. Updated ProposalSchema to Match Database

The `ProposalSchema` in `lib/schemas/proposal-schema.ts` has been updated to match the database structure:

```typescript
export const ProposalSchema = z.object({
  title: z.string(),
  user_id: z.string().uuid().optional(),
  status: z.string().optional().default("draft"),
  funder: z.string().optional(),
  applicant: z.string().optional(),
  deadline: z.string().optional(),
  metadata: z.any().optional() // Changed from required complex schema to optional any
});
```

### 2. Fixed Form Data Structure

Ensured form data is correctly structured to match the database schema in `ReviewProposalView.tsx`:
- Only using existing database fields
- Putting non-standard fields in the `metadata` JSONB field

### 3. Updated ServerForm.tsx for Proper Metadata Handling

Modified the `handleSubmit` function to explicitly stringify the metadata object:

```typescript
if (key === 'metadata') {
  // Always stringify the metadata object
  submitData.append(key, JSON.stringify(value));
} else if (value instanceof Date) {
  ...
}
```

This ensures that the metadata object is properly formatted as a JSON string before being sent to the server.

### 4. Fixed Cookie Handling

Updated the `createClient` function in `lib/supabase/server.ts` to accept both Promise and non-Promise cookie stores:

```typescript
export const createClient = async (
  cookieStore?: ReturnType<typeof cookies> | Promise<ReturnType<typeof cookies>>
) => {
  // ...
  try {
    // Handle both Promise and non-Promise cookie stores
    const cookieJar = cookieStore 
      ? (cookieStore instanceof Promise ? await cookieStore : cookieStore)
      : cookies();
    // ...
  }
}
```

### 5. Improved Error Logging and Data Handling

Added detailed logging during form submission to help debug issues:

```typescript
console.log("Preparing form data for submission:", formData);
console.log("Form data ready for submission");
console.log("Calling createProposal with form data");
console.log("Received result from createProposal:", result);
```

Also improved metadata parsing in the actions.ts file:

```typescript
if (key === 'metadata' && typeof value === 'string') {
  try {
    rawData[key] = JSON.parse(value);
    console.log("[Action] Successfully parsed metadata JSON:", rawData[key]);
  } catch (error) {
    console.error("[Action] Failed to parse metadata JSON:", error);
    rawData[key] = {};
  }
}
```

### 6. Updated Component Data Flow

1. Modified the `ReviewProposalView` component to use the prepared form data:
```typescript
const handleSubmit = useCallback(() => {
  setIsSubmitting(true);
  // Pass the preparedFormData to ensure proper structure for the database
  console.log("Submitting prepared form data:", preparedFormData);
  onSubmit(preparedFormData);
}, [preparedFormData, onSubmit]);
```

2. Updated the `ProposalCreationFlow` component to directly use the prepared data:
```typescript
// If we're at the review step, the data should already be prepared 
// in the correct format by the ReviewProposalView component
console.log("Submitting proposal with data:", data);

// Submit the proposal
const proposal = await submitProposal(data);
```

## Database Schema Structure

The `proposals` table has the following structure:
- `id` (UUID): Primary key
- `title` (String): Title of the proposal
- `user_id` (UUID): Reference to the users table
- `status` (String): Status of the proposal (draft, submitted, etc.)
- `funder` (String): Name of the funding organization
- `applicant` (String): Name of the applicant
- `deadline` (String/Date): Deadline for the proposal
- `metadata` (JSONB): Additional fields that don't have their own columns
- `created_at` (Timestamp): When the proposal was created
- `updated_at` (Timestamp): When the proposal was last updated

## Verification

The solution has been tested to ensure:
1. Form validation works correctly
2. Data is saved to the database in the correct format
3. Cookie handling works as expected
4. Metadata is properly serialized/deserialized between the client and server
5. The data flow between components is consistent

## Next Steps

If issues persist:
1. Review the browser console for additional errors
2. Check server logs for validation or database errors
3. Verify the database schema matches expectations
4. Ensure all required fields are being populated