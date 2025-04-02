# Supabase Project Setup Instructions

Follow these steps to create and configure your Supabase project for the Proposal Agent System:

## 1. Create a New Project

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Click "New Project"
3. Enter project details:
   - **Name**: proposal-agent (or your preferred name)
   - **Database Password**: Create a strong password and save it securely
   - **Region**: Choose the region closest to your users
   - **Pricing Plan**: Free tier or appropriate plan for your needs
4. Click "Create New Project" and wait for it to be created (may take a few minutes)

## 2. Configure Google OAuth

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

## 3. Set Up Database Schema

1. In the Supabase dashboard, go to **SQL Editor**
2. Create a new query
3. Copy and paste the contents of the `schema.sql` file in this directory
4. Run the query to set up your database tables and RLS policies

## 4. Update Environment Variables

1. Get your Supabase project URL and anon key:
   - Go to **Project Settings** > **API**
   - Copy the **URL** and **anon/public** key
2. Update your `.env` file with:
   ```
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   ```

## 5. Test Authentication

1. Implement the authentication flow in your app
2. Test login with Google
3. Verify that data is stored correctly with RLS policies enforced

## 6. Enable Storage

For storing proposal documents (RFPs, generated sections, etc.):

1. Go to **Storage** in the Supabase dashboard
2. Create a new bucket named `proposal-documents`
3. Set bucket privacy to **Private**
4. Create storage policies to allow authenticated users to access their own files:

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

**Note:** This setup assumes files will be stored in a directory structure where the first folder is the proposal ID. For example: `proposal-documents/[proposal_id]/file.pdf`.

## 7. Advanced Setup (as needed)

- Set up Edge Functions if needed for serverless processing
- Configure additional authentication providers
- Set up database webhooks for event-driven architecture
