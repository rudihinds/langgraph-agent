import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// These will be set after Supabase project creation
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "";

// Initialize the Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);

// Check if Supabase credentials are properly configured
if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables."
  );
}

/**
 * Supabase module exports
 */

// Server-side Supabase client
export { serverSupabase } from "./client.js";

// Supabase storage provider for LangGraph checkpoints
export { SupabaseStorage, type StorageItem } from "./storage.js";

// Supabase storage operations with retry
export {
  listFilesWithRetry,
  downloadFileWithRetry,
  uploadFileWithRetry,
} from "./storage.js";