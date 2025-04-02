# Manual Supabase Setup Steps

The following steps need to be completed manually in the Supabase dashboard:

## 1. Create Storage Bucket (✅ COMPLETED)

Storage bucket "proposal-documents" has been successfully created.

## 2. Set Up Storage Bucket Policies

You need to run the following SQL in the Supabase SQL Editor to set up the policies:

1. Go to **SQL Editor** in the left sidebar
2. Create a new query
3. Copy and paste the following SQL:

```sql
-- Allow users to upload files (INSERT)
CREATE POLICY "Users can upload their own proposal documents"
ON storage.objects FOR INSERT
WITH CHECK (
  auth.uid() = (
    SELECT user_id FROM proposals
    WHERE id::text = (storage.foldername(name))[1]
  )
);

-- Allow users to view their own files (SELECT)
CREATE POLICY "Users can view their own proposal documents"
ON storage.objects FOR SELECT
USING (
  auth.uid() = (
    SELECT user_id FROM proposals
    WHERE id::text = (storage.foldername(name))[1]
  )
);

-- Allow users to update their own files (UPDATE)
CREATE POLICY "Users can update their own proposal documents"
ON storage.objects FOR UPDATE
USING (
  auth.uid() = (
    SELECT user_id FROM proposals
    WHERE id::text = (storage.foldername(name))[1]
  )
);

-- Allow users to delete their own files (DELETE)
CREATE POLICY "Users can delete their own proposal documents"
ON storage.objects FOR DELETE
USING (
  auth.uid() = (
    SELECT user_id FROM proposals
    WHERE id::text = (storage.foldername(name))[1]
  )
);
```

4. Click **Run** to execute the SQL

5. To verify the policies are set up:
   - Go to **Storage** in the left sidebar
   - Select the **proposal-documents** bucket
   - Click the **Policies** tab
   - Verify there are policies for INSERT, SELECT, UPDATE, and DELETE operations

## 3. Configure Google OAuth

1. In the Supabase dashboard, navigate to **Authentication** > **Providers**
2. Find Google in the list and toggle it on
3. Set up a Google OAuth application:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or use an existing one
   - Navigate to **APIs & Services** > **Credentials**
   - Click **Create Credentials** > **OAuth client ID**
   - Configure the OAuth consent screen if prompted
   - For Application type, select **Web application**
   - Add authorized redirect URIs:
     - `https://[YOUR_PROJECT_REF].supabase.co/auth/v1/callback`
     - `http://localhost:3000/auth/callback` (for local development)
   - Copy the **Client ID** and **Client Secret**
4. Back in Supabase, enter the Google Client ID and Client Secret
5. Enable Google auth by toggling it on

## 4. Verify Setup

After completing all the manual steps above, update TASK.md to mark the remaining tasks as completed.

## Programmatic Storage Bucket Creation (Alternative to Manual Creation)

By default, Supabase applies Row Level Security (RLS) to storage buckets just like database tables. This means that the anonymous key usually doesn't have permission to create storage buckets.

To programmatically create a storage bucket, you need to use the service role key:

1. Get your service role key from Supabase Dashboard:

   - Go to **Project Settings** > **API**
   - Copy the **service_role** key (secret key)
   - Add it to your .env file as `SUPABASE_SERVICE_ROLE_KEY`

2. Run the storage bucket creation script:
   ```sh
   npx tsx src/lib/create-storage-bucket.ts
   ```

**Important Security Note**: The service role key bypasses RLS and has full admin privileges. Never expose it in client-side code or commit it to your repository. It should only be used in secure server environments.
