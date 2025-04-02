import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use the service role key which has permission to run SQL
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

async function setupStoragePolicies() {
  try {
    console.log("Setting up storage bucket policies...");

    // Read the SQL file
    const sqlPath = join(__dirname, "storage-policies.sql");
    const sqlContent = readFileSync(sqlPath, "utf-8");

    console.log("Loaded SQL file:", sqlPath);

    // Run the SQL
    console.log("Executing SQL policies...");
    const { error } = await supabaseAdmin.rpc("pgadmin_exec_sql", {
      sql: sqlContent,
    });

    if (error) {
      throw error;
    }

    console.log("✅ Storage bucket policies applied successfully");
    return true;
  } catch (error) {
    console.error("❌ Error setting up storage policies:", error);
    console.log(
      "\nYou need to run the SQL manually in the Supabase SQL Editor:"
    );
    console.log("1. Go to Supabase dashboard -> SQL Editor");
    console.log("2. Create a new query");
    console.log("3. Copy and paste the following SQL:");
    console.log("\n---SQL START---");
    try {
      const sqlPath = join(__dirname, "storage-policies.sql");
      const sqlContent = readFileSync(sqlPath, "utf-8");
      console.log(sqlContent);
    } catch (e) {
      console.error("Could not read SQL file", e);
    }
    console.log("---SQL END---");

    return false;
  }
}

// Run the function
setupStoragePolicies().then((success) => {
  if (success) {
    console.log("\nStorage policy setup completed.");
  } else {
    console.error(
      "\nStorage policy setup failed via script. Please apply manually using the SQL above."
    );
  }
});
