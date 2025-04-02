import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// Use the service role key if available, otherwise use anon key
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

// Create a special admin client with the service role key
const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : createClient(supabaseUrl, supabaseAnonKey);

async function createStorageBucket() {
  try {
    console.log("Creating proposal-documents storage bucket...");

    if (!supabaseServiceKey) {
      console.warn(
        "⚠️ No service role key found. Using anon key which might not have permission to create buckets."
      );
      console.warn(
        "To use service role key, add SUPABASE_SERVICE_ROLE_KEY to your .env file."
      );
      console.warn(
        "You can find this key in Supabase Dashboard -> Project Settings -> API -> service_role key"
      );
    }

    // Create the bucket using the admin client
    const { data, error } = await supabaseAdmin.storage.createBucket(
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

    // We need to run SQL for the policies, which requires admin access through the dashboard
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
    console.log(
      "\nAlternative: Create the bucket manually in the Supabase dashboard:"
    );
    console.log("1. Go to Storage in the Supabase dashboard");
    console.log('2. Click "Create new bucket"');
    console.log('3. Enter "proposal-documents" as the name');
    console.log('4. Ensure "Private bucket" is selected');
    console.log('5. Click "Create bucket"');
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
