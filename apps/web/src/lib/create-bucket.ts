import { createClient } from "@supabase/supabase-js";
import { ENV } from "@/env";

/**
 * Script to create the proposal-documents storage bucket
 * Run using: npm exec ts-node -- src/lib/create-bucket.ts
 */
async function createStorageBucket() {
  try {
    console.log("Starting proposal-documents bucket creation...");

    if (!ENV.NEXT_PUBLIC_SUPABASE_URL || !ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error("Missing required environment variables:");
      if (!ENV.NEXT_PUBLIC_SUPABASE_URL)
        console.error("- NEXT_PUBLIC_SUPABASE_URL");
      if (!ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY)
        console.error("- NEXT_PUBLIC_SUPABASE_ANON_KEY");
      return false;
    }

    console.log(`Using Supabase URL: ${ENV.NEXT_PUBLIC_SUPABASE_URL}`);

    // Create a client with the anon key
    // Note: This may not have permission to create buckets without a service role key
    const supabase = createClient(
      ENV.NEXT_PUBLIC_SUPABASE_URL,
      ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // First check if the bucket already exists
    const { data: buckets, error: bucketsError } =
      await supabase.storage.listBuckets();

    if (bucketsError) {
      console.error("Error listing buckets:", bucketsError.message);
      return false;
    }

    const bucketExists = buckets?.some((b) => b.name === "proposal-documents");

    if (bucketExists) {
      console.log("✅ Bucket 'proposal-documents' already exists");
      return true;
    }

    // Create the bucket
    console.log("Creating 'proposal-documents' bucket...");
    const { data, error } = await supabase.storage.createBucket(
      "proposal-documents",
      {
        public: false,
        fileSizeLimit: 50 * 1024 * 1024, // 50MB limit
      }
    );

    if (error) {
      if (error.message.includes("Permission denied") || error.status === 400) {
        console.error(
          "❌ Permission denied. You need a service role key to create buckets."
        );
        console.log(
          "\nPlease create the bucket manually in the Supabase dashboard:"
        );
        console.log("1. Go to Storage in the Supabase dashboard");
        console.log('2. Click "Create new bucket"');
        console.log('3. Enter "proposal-documents" as the name');
        console.log('4. Ensure "Private bucket" is selected');
        console.log('5. Click "Create bucket"');
        return false;
      }
      console.error("Error creating bucket:", error);
      return false;
    }

    console.log("✅ Storage bucket created successfully:", data);
    return true;
  } catch (error) {
    console.error("Unexpected error creating storage bucket:", error);
    return false;
  }
}

// Run the function
createStorageBucket().then((success) => {
  if (success) {
    console.log("\n✅ Storage bucket setup completed successfully.");
  } else {
    console.error("\n❌ Storage bucket setup failed.");
    console.log("\nNext steps:");
    console.log("1. Check your Supabase project settings.");
    console.log("2. Ensure you have the correct environment variables.");
    console.log(
      "3. Try creating the bucket manually in the Supabase dashboard."
    );
  }
});
