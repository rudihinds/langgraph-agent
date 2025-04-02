-- Storage Bucket Policies for proposal-documents bucket

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