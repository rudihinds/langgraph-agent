import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// Use regular anon key for basic tests
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Create standard client with anon key
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Create admin client with service role key if available
const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : supabase;

// Function to test Supabase connection
async function testSupabaseConnection() {
  try {
    // Test general connection with a simple health check
    console.log("Testing Supabase connection...");

    // This is a safer way to test connection - just checking if we can access the service
    const { error } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    console.log("✅ Supabase connection successful!");

    // Check if tables exist
    console.log("\nChecking database schema...");
    const tables = [
      "users",
      "proposals",
      "proposal_states",
      "proposal_documents",
    ];

    for (const table of tables) {
      try {
        const { error } = await supabase.from(table).select("count").single();
        if (error) {
          console.error(`❌ Table '${table}' issue: ${error.message}`);
        } else {
          console.log(`✅ Table '${table}' exists and is accessible`);
        }
      } catch (err) {
        console.error(`❌ Table '${table}' access error:`, err);
      }
    }

    // Check if storage bucket exists - using admin client for storage operations
    console.log("\nChecking storage bucket...");
    try {
      console.log(
        supabaseServiceKey
          ? "(Using service role key for storage checks)"
          : "(Using anon key for storage checks)"
      );
      const { data: buckets, error: bucketsError } =
        await supabaseAdmin.storage.listBuckets();

      if (bucketsError) {
        console.error(
          `❌ Error checking storage buckets: ${bucketsError.message}`
        );
      } else {
        const proposalDocumentsBucket = buckets.find(
          (bucket: any) => bucket.name === "proposal-documents"
        );

        if (proposalDocumentsBucket) {
          console.log('✅ Storage bucket "proposal-documents" exists');
        } else {
          console.log('❌ Storage bucket "proposal-documents" not found');
          console.log(
            "Available buckets:",
            buckets.map((b: any) => b.name).join(", ") || "None"
          );
        }
      }
    } catch (err) {
      console.error("❌ Error accessing storage:", err);
    }

    console.log("\nSuggested next steps:");
    if (supabaseServiceKey) {
      console.log("1. Run the bucket policies SQL in the Supabase dashboard");
      console.log("2. Configure Google OAuth for authentication");
    } else {
      console.log(
        "1. If any tables are missing, run the SQL script in schema.sql"
      );
      console.log(
        "2. If storage bucket is missing, create it in the Supabase dashboard or using the service role key"
      );
      console.log("3. Test authentication flow with Google OAuth");
    }

    return true;
  } catch (error) {
    console.error("Error testing Supabase connection:", error);
    return false;
  }
}

// Run the test
testSupabaseConnection().then((success) => {
  if (success) {
    console.log("\nOverall: Supabase connection test completed.");
  } else {
    console.error("\nOverall: Supabase connection test failed.");
    console.log(
      "Please check your SUPABASE_URL and SUPABASE_ANON_KEY in .env file."
    );
  }
});
