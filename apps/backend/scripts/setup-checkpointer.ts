/**
 * Setup script for the checkpointer
 *
 * This script checks if the required database tables exist and creates them if they don't.
 * Run with: npx tsx scripts/setup-checkpointer.ts
 */
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from both locations
// First try the root .env (more important)
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
// Then local .env as fallback (less important)
dotenv.config();

async function main() {
  // Check that we have the required environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !supabaseKey ||
    supabaseUrl === "https://your-project.supabase.co" ||
    supabaseKey === "your-service-role-key"
  ) {
    console.error("❌ Error: Missing or invalid Supabase credentials");
    console.error(
      "Please update the .env file with real values for SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
    process.exit(1);
  }

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("Checking if checkpointer tables exist...");

  // Check if the tables exist
  const { data: tablesData, error: tablesError } = await supabase
    .from("information_schema.tables")
    .select("table_name")
    .in("table_name", ["proposal_checkpoints", "proposal_sessions"]);

  if (tablesError) {
    console.error("❌ Error checking database tables:", tablesError);
    process.exit(1);
  }

  const existingTables = tablesData?.map((row) => row.table_name) || [];
  const missingTables = ["proposal_checkpoints", "proposal_sessions"].filter(
    (table) => !existingTables.includes(table)
  );

  if (missingTables.length === 0) {
    console.log("✅ All required tables exist!");
    return;
  }

  console.log(`Missing tables: ${missingTables.join(", ")}`);
  console.log("Creating missing tables...");

  // Load the migration SQL
  const migrationPath = path.resolve(
    __dirname,
    "../lib/persistence/migrations/create_persistence_tables.sql"
  );
  const migrationSql = fs.readFileSync(migrationPath, "utf8");

  // Execute the migration
  const { error: migrationError } = await supabase.rpc("exec_sql", {
    sql_string: migrationSql,
  });

  if (migrationError) {
    if (migrationError.message.includes('function "exec_sql" does not exist')) {
      console.error(
        "❌ Error: The exec_sql RPC function does not exist in your Supabase instance."
      );
      console.error("This function is required to run SQL migrations.");
      console.error(
        "Please create this function or apply the migration manually."
      );
      console.error("\nSee the migration SQL here:");
      console.error(migrationPath);
    } else {
      console.error("❌ Error applying migration:", migrationError);
    }
    process.exit(1);
  }

  console.log("✅ Successfully created all required tables!");
}

// Run the script
main().catch((error) => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});
