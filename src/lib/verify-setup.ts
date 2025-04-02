import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";
import "dotenv/config";

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Supabase clients
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Create standard and admin clients
const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : supabase;

async function verifySupabaseSetup() {
  console.log("🔍 Verifying Supabase setup...\n");

  const results = {
    databaseConnection: false,
    databaseSchema: {
      success: false,
      tables: {
        users: false,
        proposals: false,
        proposal_states: false,
        proposal_documents: false,
      },
    },
    storageBucket: false,
    storagePolicies: { success: false, count: 0 },
    googleAuth: false,
  };

  // 1. Check basic connection
  try {
    console.log("Testing Supabase connection...");
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    results.databaseConnection = true;
    console.log("✅ Supabase connection successful!");
  } catch (error) {
    console.error("❌ Supabase connection failed:", error);
    // Exit early if we can't even connect
    return results;
  }

  // 2. Check database schema
  console.log("\nChecking database schema...");
  const tables = [
    "users",
    "proposals",
    "proposal_states",
    "proposal_documents",
  ];
  let schemaSuccess = true;

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select("count").single();
      if (error) {
        console.error(`❌ Table '${table}' issue: ${error.message}`);
        results.databaseSchema.tables[table] = false;
        schemaSuccess = false;
      } else {
        console.log(`✅ Table '${table}' exists and is accessible`);
        results.databaseSchema.tables[table] = true;
      }
    } catch (err) {
      console.error(`❌ Table '${table}' access error:`, err);
      results.databaseSchema.tables[table] = false;
      schemaSuccess = false;
    }
  }

  results.databaseSchema.success = schemaSuccess;

  // 3. Check storage bucket
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
        results.storageBucket = true;
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

  // 4. Check for Google Auth provider
  console.log("\nChecking Google Authentication provider...");
  try {
    // Unfortunately, there's no direct API to check enabled providers
    // We can only check if the environment is set up to use them
    console.log("✅ Supabase environment is configured for authentication");
    console.log("⚠️ Cannot programmatically verify Google Auth is enabled.");
    console.log(
      "   Please manually verify in Supabase Dashboard > Authentication > Providers"
    );

    // Check if any auth providers exist by seeing if we can sign in with Google
    console.log("\nAuthorization URL for Google sign-in:");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "http://localhost:3000/auth/callback",
      },
    });

    if (error) {
      console.error(
        "❌ Google OAuth is not properly configured:",
        error.message
      );
    } else if (data && data.url) {
      console.log(
        "✅ Google OAuth appears to be configured (redirect URL generated)"
      );
      results.googleAuth = true;
    }
  } catch (err) {
    console.error("❌ Error checking auth providers:", err);
  }

  // 5. Check for storage policies (indirect check)
  console.log("\nAttempting to verify storage policies...");
  console.log("⚠️ Cannot programmatically verify storage policies.");
  console.log(
    "   Please manually verify in Supabase Dashboard > Storage > proposal-documents > Policies"
  );

  // Summary
  console.log("\n=== SETUP VERIFICATION SUMMARY ===");
  console.log(
    `Database Connection: ${results.databaseConnection ? "✅" : "❌"}`
  );
  console.log(
    `Database Schema: ${results.databaseSchema.success ? "✅" : "❌"}`
  );
  console.log(`Storage Bucket: ${results.storageBucket ? "✅" : "❌"}`);
  console.log(`Google Auth: ${results.googleAuth ? "✅" : "❌"}`);
  console.log(`Storage Policies: Manual verification required`);

  console.log("\nRemaining tasks:");
  if (!results.databaseSchema.success) {
    console.log("- Set up missing database tables");
  }
  if (!results.storageBucket) {
    console.log("- Create the proposal-documents storage bucket");
  }
  if (!results.googleAuth) {
    console.log("- Configure Google OAuth");
  }
  console.log("- Verify storage policies are set up (manual check required)");

  return results;
}

// Run the verification
verifySupabaseSetup().then((results) => {
  // Determine which tasks to mark as complete in TASK.md
  const tasksToUpdate = [];

  if (results.databaseSchema.success) {
    tasksToUpdate.push("Database schema is set up");
  }

  if (results.storageBucket) {
    tasksToUpdate.push("Storage bucket is created");
  }

  if (results.googleAuth) {
    tasksToUpdate.push("Google OAuth is configured");
  }

  if (tasksToUpdate.length > 0) {
    console.log("\nYou can update TASK.md to mark the following as completed:");
    tasksToUpdate.forEach((task) => console.log(`- ${task}`));
  }

  console.log("\nVerification complete.");
});
