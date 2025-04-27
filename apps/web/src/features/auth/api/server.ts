"use server";

import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Re-export the central Supabase server client for auth-specific use
 *
 * This follows the pattern of having feature-specific imports while
 * avoiding duplication of the core implementation.
 */
export const createClient = createSupabaseServerClient;
