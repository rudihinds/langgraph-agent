import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables from .env file in the root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Assume .env is in the root directory, two levels up from scripts/
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.SUPABASE_DB_USER}:${process.env.SUPABASE_DB_PASSWORD}@${process.env.SUPABASE_DB_HOST}:${process.env.SUPABASE_DB_PORT}/${process.env.SUPABASE_DB_NAME}`;

console.log(
  `Attempting to connect to: ${connectionString.replace(/:[^:]*@/, ":***@")}`
);

const pool = new Pool({
  connectionString: connectionString,
  // Add connection timeout to see if it matches the ETIMEDOUT behavior
  connectionTimeoutMillis: 10000, // 10 seconds, adjust as needed
  // ssl: { rejectUnauthorized: false } // Add this if Supabase requires SSL, might be needed
});

async function testConnection() {
  let client;
  try {
    console.log("Requesting client from pool...");
    client = await pool.connect();
    console.log("Successfully connected to the database!");

    // Optional: Run a simple query
    console.log("Running a simple query (SELECT NOW())...");
    const res = await client.query("SELECT NOW()");
    console.log("Query successful. Current DB time:", res.rows[0].now);
  } catch (err) {
    console.error("Connection test failed:", err);
  } finally {
    if (client) {
      console.log("Releasing client.");
      client.release(); // Release the client back to the pool
    }
    console.log("Ending pool.");
    await pool.end(); // Close the pool
  }
}

testConnection();
