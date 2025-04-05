"use server";

import { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createClient } from "./supabase/server";

/**
 * Creates or updates a user record in the users table
 * This ensures that the users table is synchronized with the Supabase Auth users
 */
export async function syncUserToDatabase(
  supabase: SupabaseClient,
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, any> | null;
  }
) {
  if (!user || !user.id) {
    console.error(
      "[SyncUser] Cannot sync user to database: invalid user data provided",
      { userId: user?.id }
    );
    return { error: "Invalid user data" };
  }

  try {
    // Check if the user already exists in the users table
    console.log(`[SyncUser] Checking for existing user: ${user.id}`);
    const { data: existingUser, error: fetchError } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .single();

    // Log the result of the check
    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 means no rows found, which is expected for new users
      console.error(
        `[SyncUser] Error checking for existing user ${user.id}:`,
        fetchError
      );
      return { error: fetchError };
    } else if (existingUser) {
      console.log(`[SyncUser] User ${user.id} found.`);
    } else {
      console.log(`[SyncUser] User ${user.id} not found, attempting insert.`);
    }

    const now = new Date().toISOString();

    if (!existingUser) {
      // --- INSERT PATH ---
      console.log(`[SyncUser] Inserting new user record for ${user.id}`);

      // Define the user data to insert, excluding updated_at
      const userData = {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || null,
        avatar_url: user.user_metadata?.avatar_url || null,
        created_at: now, // Set creation timestamp explicitly
        last_login: now, // Set initial last login timestamp
      };

      try {
        const { error: insertError } = await supabase
          .from("users")
          .insert(userData);

        if (insertError) {
          console.error(
            `[SyncUser] Error creating user record for ${user.id}:`,
            insertError
          );
          return { error: insertError };
        }

        console.log(
          `[SyncUser] User record created successfully for ${user.id}`
        );
        return { success: true, created: true };
      } catch (err) {
        console.error(`[SyncUser] Unexpected error during insert:`, err);
        return { error: err instanceof Error ? err : new Error(String(err)) };
      }
    } else {
      // --- UPDATE PATH ---
      console.log(
        `[SyncUser] Updating last_login for existing user ${user.id}`
      );

      // Define the data to update, only including last_login
      const updateData = {
        last_login: now,
      };

      try {
        const { error: updateError } = await supabase
          .from("users")
          .update(updateData)
          .eq("id", user.id);

        if (updateError) {
          console.error(
            `[SyncUser] Error updating last_login for ${user.id}:`,
            updateError
          );
          return { error: updateError };
        }

        console.log(
          `[SyncUser] User last_login updated successfully for ${user.id}`
        );
        return { success: true, updated: true };
      } catch (err) {
        console.error(`[SyncUser] Unexpected error during update:`, err);
        return { error: err instanceof Error ? err : new Error(String(err)) };
      }
    }
  } catch (error) {
    console.error(
      `[SyncUser] Unexpected error during sync for user ${user.id}:`,
      error
    );
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }
}

// Define a success return type for ensureUserExists
type EnsureUserExistsSuccess = { success: true; user: User };
type EnsureUserExistsResult =
  | EnsureUserExistsSuccess
  | { success: false; error: any };

/**
 * Server action/function to ensure user record exists.
 * Accepts a SupabaseClient instance.
 */
export async function ensureUserExists(
  supabase: SupabaseClient
): Promise<EnsureUserExistsResult> {
  console.log("[EnsureUser] Attempting to get user session.");
  try {
    // Check if supabase or supabase.auth is undefined
    if (!supabase || !supabase.auth) {
      console.error("[EnsureUser] Invalid Supabase client or auth object");
      return {
        success: false,
        error: new Error("Authentication service unavailable"),
      };
    }

    // Use the passed Supabase client to get the user
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error("[EnsureUser] Supabase auth error:", error);
      return {
        success: false,
        error: error || new Error("Supabase authentication error"),
      };
    }
    if (!user) {
      console.warn("[EnsureUser] No authenticated user found in session.");
      return { success: false, error: new Error("User not authenticated") };
    }

    console.log(
      `[EnsureUser] User ${user.id} authenticated. Proceeding to sync.`
    );
    // Sync user to DB using the same client
    const syncResult = await syncUserToDatabase(supabase, user);

    if (!syncResult || syncResult.error) {
      console.error(
        `[EnsureUser] Failed to sync user ${user.id}:`,
        syncResult?.error ?? "Unknown sync error"
      );
      // Propagate the specific sync error
      return {
        success: false,
        error: syncResult?.error ?? new Error("User sync failed"),
      };
    }

    console.log(`[EnsureUser] User ${user.id} sync completed successfully.`);
    // On successful sync, return success and the user object
    return { success: true, user: user };
  } catch (error) {
    console.error("[EnsureUser] Unexpected error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error
          : new Error("An unexpected error occurred"),
    };
  }
}
