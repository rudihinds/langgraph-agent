-- RLS Policies for Supabase tables

-- Enable Row Level Security on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow users to read and update their own data
CREATE POLICY "Users can view their own data"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own data"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id);

-- Allow users to create their own user record
CREATE POLICY "Users can insert their own data"
  ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Allow users to read, update, and delete their own proposals
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own proposals"
  ON public.proposals
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own proposals"
  ON public.proposals
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own proposals"
  ON public.proposals
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own proposals"
  ON public.proposals
  FOR DELETE
  USING (auth.uid() = user_id);

-- Storage bucket policies
CREATE POLICY "Users can upload their own files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own files"
  ON storage.objects
  FOR UPDATE
  USING (auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own files"
  ON storage.objects
  FOR DELETE
  USING (auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read their own files"
  ON storage.objects
  FOR SELECT
  USING (auth.uid()::text = (storage.foldername(name))[1]);