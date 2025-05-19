/**
 * Test script for the checkpointer
 *
 * This script tests the checkpointer service to ensure it's working properly.
 * Run with: npx tsx scripts/test-checkpointer.ts
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  createCheckpointer,
  generateThreadId,
} from "../services/[dep]checkpointer.service.js";

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from both locations
// First try the root .env (more important)
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
// Then local .env as fallback (less important)
dotenv.config();

// Check for Supabase configuration
const hasSupabaseConfig =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!hasSupabaseConfig) {
  console.warn(
    "⚠️ Warning: Supabase configuration not found. Using in-memory checkpointer for testing."
  );
  console.warn(
    "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env for persistent storage testing."
  );
  console.warn("");
}

async function runTest() {
  console.log("🔍 Testing checkpointer service...");

  try {
    // Generate a test thread ID
    const proposalId = "test-proposal-" + Date.now();
    const threadId = generateThreadId(proposalId);
    console.log(`Generated test thread ID: ${threadId}`);

    // Create a checkpointer instance
    const checkpointer = await createCheckpointer(
      "test",
      undefined,
      proposalId
    );
    console.log(
      `Created checkpointer instance (${hasSupabaseConfig ? "Supabase" : "in-memory"})`
    );

    // Test data
    const testConfig = { configurable: { thread_id: threadId } };
    const testCheckpoint = {
      v: 1,
      id: threadId,
      channel_values: {
        messages: [],
        status: "queued",
        errors: [],
      },
      versions_seen: {},
      pending_sends: [],
    };
    const testMetadata = {
      parents: {},
      source: "input",
      step: 1,
      writes: {},
    };

    // Test put operation
    console.log("Testing put operation...");
    const updatedConfig = await checkpointer.put(
      testConfig,
      testCheckpoint,
      testMetadata,
      {}
    );
    console.log("✅ Put operation successful");

    // Test get operation
    console.log("Testing get operation...");
    const retrievedCheckpoint = await checkpointer.get(testConfig);
    if (retrievedCheckpoint) {
      console.log("✅ Get operation successful - checkpoint retrieved");
    } else {
      console.error("❌ Get operation failed - checkpoint not retrieved");
    }

    // Test list operation
    console.log("Testing list operation...");
    const namespaces = await checkpointer.list();
    console.log(
      `✅ List operation successful - found ${namespaces.length} namespaces`
    );

    // Test delete operation
    console.log("Testing delete operation...");
    await checkpointer.delete(testConfig);
    console.log("✅ Delete operation successful");

    // Verify deletion
    const afterDeleteCheckpoint = await checkpointer.get(testConfig);
    if (!afterDeleteCheckpoint) {
      console.log("✅ Checkpoint properly deleted and not found");
    } else {
      console.warn("⚠️ Checkpoint still found after deletion");
    }

    console.log("\n🎉 All checkpointer operations completed successfully!");
    return { success: true };
  } catch (error) {
    console.error("\n❌ Checkpointer test failed:", error);
    return {
      success: false,
      error,
    };
  }
}

// Run the test and exit with appropriate code
runTest()
  .then((result) => {
    if (result.success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error("Unhandled error:", err);
    process.exit(1);
  });
