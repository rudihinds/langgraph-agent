import { supabase } from "./supabase.js";
import "dotenv/config";

async function createStorageBucket() {
  try {
    console.log("Creating proposal-documents storage bucket...");

    // Create the bucket
    const { data, error } = await supabase.storage.createBucket(
      "proposal-documents",
      {
        public: false,
        fileSizeLimit: 50 * 1024 * 1024, // 50MB limit
      }
    );

    if (error) {
      throw error;
    }

    console.log("✅ Storage bucket created successfully:", data);

    // Now set up the bucket policies
    console.log("\nSetting up storage bucket policies...");

    // We need to run SQL for the policies, which requires admin access
    // Let's provide the SQL to run in the dashboard
    console.log(`
Please run the following SQL in the Supabase SQL Editor to set up proper policies:

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
    `);

    return true;
  } catch (error) {
    console.error("Error creating storage bucket:", error);
    return false;
  }
}

// Run the function
createStorageBucket().then((success) => {
  if (success) {
    console.log("\nStorage bucket setup process completed.");
    console.log(
      "Verify in the Supabase dashboard and run the SQL for policies."
    );
  } else {
    console.error("\nStorage bucket setup failed.");
  }
});
