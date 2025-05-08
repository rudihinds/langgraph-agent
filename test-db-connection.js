import dotenv from "dotenv";
import pg from "pg";

// Initialize environment variables
dotenv.config();
const { Pool } = pg;

// Original connection string
const originalConnString = process.env.SUPABASE_DB_URL || "";
console.log("Testing connection string variations...");

// Log the original connection string (redacted password for security)
const dbUrlParts = originalConnString.split("@");
if (dbUrlParts.length > 1) {
  const redactedDbUrl =
    dbUrlParts[0].replace(/:[^:]*@/, ":****@") + "@" + dbUrlParts[1];
  console.log(`Original (redacted): ${redactedDbUrl}`);
} else {
  console.log(`Connection string not properly formatted or missing`);
}

// Try different hostname variations
async function testConnectionWithVariations() {
  // Extract parts from the original connection string if possible
  let prefix = "";
  let credentials = "";
  let hostname = "";
  let port = "";
  let database = "";

  try {
    // Parse connection string
    if (originalConnString.startsWith("postgresql://")) {
      // Format: postgresql://user:pass@hostname:port/dbname
      const parts = originalConnString.replace("postgresql://", "").split("@");
      if (parts.length === 2) {
        credentials = parts[0];
        const hostParts = parts[1].split("/");
        if (hostParts.length >= 2) {
          const hostPortParts = hostParts[0].split(":");
          hostname = hostPortParts[0];
          port = hostPortParts.length > 1 ? hostPortParts[1] : "5432";
          database = hostParts[1] || "postgres";
        }
      }
    }

    // If parsing failed, just try the original string
    if (!hostname) {
      console.log("Unable to parse connection string, testing original only");
      return await testConnection(originalConnString);
    }

    // Now try different variations
    const variations = [
      {
        name: "Original",
        connStr: originalConnString,
      },
      {
        name: "Without db. prefix",
        connStr: `postgresql://${credentials}@${hostname.replace("db.", "")}:${port}/${database}`,
      },
      {
        name: "With direct IP (api endpoint)",
        connStr: `postgresql://${credentials}@${process.env.SUPABASE_URL?.match(/\/\/([^:]+)/)?.[1] || hostname}:${port}/${database}`,
      },
      {
        name: "With port 6543",
        connStr: `postgresql://${credentials}@${hostname}:6543/${database}`,
      },
    ];

    console.log(
      `Generated ${variations.length} connection string variations to test`
    );

    // Try each variation
    for (const variation of variations) {
      console.log(`\n----- Testing: ${variation.name} -----`);
      const redactedConnStr = variation.connStr.replace(/:[^:]*@/, ":****@");
      console.log(`Connection string (redacted): ${redactedConnStr}`);
      const success = await testConnection(variation.connStr);
      if (success) {
        console.log(
          `✅ CONNECTION SUCCESSFUL with variation: ${variation.name}`
        );
        console.log(`Recommended connection string: ${redactedConnStr}`);
        return true;
      }
    }

    console.error("❌ All connection variations failed");
    return false;
  } catch (error) {
    console.error("Error in connection testing:", error);
    return false;
  }
}

// Test a specific connection string
async function testConnection(connectionString) {
  try {
    const pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
    });

    console.log("Attempting to connect...");

    const client = await pool.connect();
    console.log("Connection successful!");

    const result = await client.query("SELECT NOW()");
    console.log("Query result:", result.rows[0]);

    client.release();
    await pool.end();

    return true;
  } catch (error) {
    console.error("Connection error:", error.message);
    return false;
  }
}

testConnectionWithVariations().then((success) => {
  if (success) {
    console.log("\nAt least one connection test completed successfully");
  } else {
    console.error("\nAll database connection tests failed");
  }
  process.exit(success ? 0 : 1);
});
