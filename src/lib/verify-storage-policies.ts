import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";
import "dotenv/config";

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use the service role key for admin operations
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseServiceKey) {
  console.error(
    "❌ Error: SUPABASE_SERVICE_ROLE_KEY is required to run this script"
  );
  process.exit(1);
}

// Create admin client with service role key
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function verifyStoragePolicies() {
  try {
    console.log("Verifying storage bucket policies...");

    // Get policies on storage.objects
    const { data, error } = await supabaseAdmin.rpc("get_policies_for_table", {
      table_name: "objects",
      schema_name: "storage",
    });

    if (error) {
      // If the RPC function doesn't exist, we'll need to use a different approach
      if (error.code === "PGRST202") {
        console.log("RPC function not found, trying direct SQL query...");

        const { data: sqlData, error: sqlError } = await supabaseAdmin
          .from("_test_custom_sql")
          .select("*")
          .eq(
            "query",
            "SELECT * FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'"
          )
          .maybeSingle();

        if (sqlError) {
          throw new Error(
            "Cannot verify policies programmatically: " + sqlError.message
          );
        }

        if (sqlData && sqlData.results && sqlData.results.length > 0) {
          return analyzeResults(sqlData.results);
        } else {
          throw new Error("No policies found for storage.objects");
        }
      } else {
        throw error;
      }
    }

    return analyzeResults(data);
  } catch (error) {
    console.error("❌ Error verifying storage policies:", error);
    console.log(
      "\nUnable to verify policies programmatically. Please check manually in the Supabase dashboard:"
    );
    console.log("1. Go to Storage in the Supabase dashboard");
    console.log("2. Select the proposal-documents bucket");
    console.log('3. Click "Policies" tab');
    console.log(
      "4. Verify that there are policies for INSERT, SELECT, UPDATE, and DELETE operations"
    );

    console.log("\nThe SQL needed to set up the policies is:");
    try {
      const sqlPath = join(__dirname, "storage-policies.sql");
      const sqlContent = readFileSync(sqlPath, "utf-8");
      console.log(sqlContent);
    } catch (e) {
      console.error("Could not read SQL file", e);
    }

    return {
      success: false,
      policiesFound: 0,
      expectedPolicies: 4,
    };
  }
}

function analyzeResults(policies) {
  const expectedPolicyCount = 4; // INSERT, SELECT, UPDATE, DELETE
  const foundPolicies = policies.length;

  console.log(`Found ${foundPolicies} policies for storage.objects table`);

  if (foundPolicies === 0) {
    console.log(
      "❌ No policies found for storage.objects. Policies need to be created."
    );
    return {
      success: false,
      policiesFound: 0,
      expectedPolicies: expectedPolicyCount,
    };
  }

  // Look for policies matching our expected ones
  const operations = ["INSERT", "SELECT", "UPDATE", "DELETE"];
  const foundOperations = policies
    .map((p) => p.cmd)
    .filter((cmd) => operations.includes(cmd));

  console.log(
    "Found policies for operations:",
    foundOperations.join(", ") || "None"
  );
  console.log(
    "Missing policies for operations:",
    operations.filter((op) => !foundOperations.includes(op)).join(", ") ||
      "None"
  );

  const allFound = foundOperations.length === operations.length;

  if (allFound) {
    console.log("✅ All required storage policies are set up!");
  } else {
    console.log(
      "❌ Some storage policies are missing. Please run the full SQL in the Supabase SQL Editor."
    );
  }

  return {
    success: allFound,
    policiesFound: foundOperations.length,
    expectedPolicies: operations.length,
    foundOperations,
    missingOperations: operations.filter((op) => !foundOperations.includes(op)),
  };
}

// Run the verification
verifyStoragePolicies().then((result) => {
  console.log("\nVerification complete.");

  if (result.success) {
    console.log("✅ Storage bucket policies are configured correctly!");

    // Update TASK.md
    console.log(
      '\nYou can now update TASK.md to mark "Configure Storage bucket permissions" as completed.'
    );
  } else {
    console.log(
      "❌ Storage bucket policies need to be set up. Please run the SQL manually in the Supabase SQL Editor."
    );
  }
});
