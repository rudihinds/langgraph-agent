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
