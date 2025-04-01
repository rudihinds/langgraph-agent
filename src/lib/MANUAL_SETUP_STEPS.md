# Manual Supabase Setup Steps

The following steps need to be completed manually in the Supabase dashboard:

## 1. Create Storage Bucket

1. Go to the Supabase dashboard and select your project
2. Navigate to **Storage** in the left sidebar
3. Click **Create new bucket**
4. Enter the name: `proposal-documents`
5. Make sure **Private bucket** is selected
6. Click **Create bucket**

## 2. Set Up Storage Bucket Policies

1. Go to **SQL Editor** in the left sidebar
2. Create a new query
3. Paste the following SQL and run it:

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

After completing all the manual steps above, you can verify that everything is set up correctly by running the test script:

```sh
npx tsx src/lib/test-supabase.ts
```

You should see successful checks for both the database tables and the storage bucket.
