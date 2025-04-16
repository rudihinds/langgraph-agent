/**
 * Environment configuration
 *
 * Centralizes access to environment variables used throughout the application.
 */
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Load environment variables from root .env and local .env if available
const rootEnvPath = path.resolve(process.cwd(), "../../../.env");
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}
dotenv.config();

/**
 * Environment configuration
 */
export const ENV = {
  // Supabase Configuration
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",

  // Checkpointer Configuration
  CHECKPOINTER_TABLE_NAME:
    process.env.CHECKPOINTER_TABLE_NAME || "proposal_checkpoints",

  // Node Environment
  NODE_ENV: process.env.NODE_ENV || "development",

  // Test Configuration
  TEST_USER_ID: process.env.TEST_USER_ID || "test-user",

  // Validation
  /**
   * Check if Supabase credentials are configured
   */
  isSupabaseConfigured(): boolean {
    return Boolean(this.SUPABASE_URL && this.SUPABASE_SERVICE_ROLE_KEY);
  },

  /**
   * Get descriptive error for missing Supabase configuration
   */
  getSupabaseConfigError(): string | null {
    if (!this.SUPABASE_URL) {
      return "Missing SUPABASE_URL environment variable";
    }
    if (!this.SUPABASE_SERVICE_ROLE_KEY) {
      return "Missing SUPABASE_SERVICE_ROLE_KEY environment variable";
    }
    return null;
  },
};
