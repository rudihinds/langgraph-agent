"use server";

import { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { Database } from "./schema/database";

export type SyncUserResult = {
  success: boolean;
  updated?: boolean;
  created?: boolean;
  error?: string;
};

/**
 * Sync user data to the database after authentication.
 * Creates a user record if it doesn't exist, or updates last_login if it does.
 */
export async function syncUserToDatabase(
  supabaseClient: SupabaseClient<Database>,
  user: User
): Promise<SyncUserResult> {
  if (!user || !user.id || !user.email) {
    console.error(
      "[SyncUser] Cannot sync user to database: invalid user data provided"
    );
    return { success: false, error: "Invalid user data" };
  }

  try {
    // 1. Check if user already exists in the database
    console.log(`[SyncUser] Checking for existing user: ${user.id}`);

    if (!supabaseClient) {
      return { success: false, error: "Invalid Supabase client" };
    }

    // Check if user exists
    const { data: existingUser, error: findError } = await supabaseClient
      .from("users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (findError) {
      console.error(
        `[SyncUser] Error checking for existing user ${user.id}:`,
        findError.message
      );
      return { success: false, error: findError.message };
    }

    // 2a. If user exists, update last_login
    if (existingUser) {
      console.log(`[SyncUser] User ${user.id} found in database`);
      const now = new Date().toISOString();

      console.log(
        `[SyncUser] Updating last_login for existing user ${user.id} to ${now}`
      );

      try {
        const { data: updateData, error: updateError } = await supabaseClient
          .from("users")
          .update({
            last_login: now,
            updated_at: now,
          })
          .eq("id", user.id)
          .select();

        if (updateError) {
          console.error(
            `[SyncUser] Error updating last_login for ${user.id}:`,
            updateError.message
          );
          return { success: false, error: updateError.message };
        }

        console.log(
          `[SyncUser] User last_login updated successfully for ${user.id}`
        );
        return { success: true, updated: true };
      } catch (err) {
        console.error(`[SyncUser] Unexpected error during update:`, err);
        return { success: false, error: "Unexpected error during update" };
      }
    }
    // 2b. If user doesn't exist, create a new user record
    else {
      console.log(
        `[SyncUser] User ${user.id} not found in database, will create new record`
      );

      // Create new user record
      const now = new Date().toISOString();

      try {
        console.log(
          `[SyncUser] Executing insert operation for user ${user.id}`
        );

        const { data: insertData, error: insertError } = await supabaseClient
          .from("users")
          .insert({
            id: user.id,
            email: user.email,
            last_login: now,
            created_at: now,
            updated_at: now,
            metadata: {
              source: "signup",
              auth_timestamp: now,
            },
          })
          .select();

        if (insertError) {
          console.error(
            `[SyncUser] Error creating user record for ${user.id}:`,
            insertError.message
          );
          return { success: false, error: insertError.message };
        }

        console.log(
          `[SyncUser] User record created successfully for ${user.id}`
        );
        return { success: true, created: true };
      } catch (err) {
        console.error(`[SyncUser] Unexpected error during insert:`, err);
        return {
          success: false,
          error: "Unexpected error during user creation",
        };
      }
    }
  } catch (err) {
    console.error(
      `[SyncUser] Unexpected error during sync for user ${user.id}:`,
      err
    );
    return { success: false, error: "Unexpected error during user sync" };
  }
}

// Result type for ensureUserExists
export type EnsureUserResult = {
  success: boolean;
  user?: User;
  error?: string;
};

/**
 * Ensures that a user exists and is authenticated.
 * Also syncs the user to the database.
 */
export async function ensureUserExists(
  supabaseClient: SupabaseClient<Database>
): Promise<EnsureUserResult> {
  console.log("[EnsureUser] Attempting to get user session");

  if (!supabaseClient || !supabaseClient.auth) {
    console.error("[EnsureUser] Invalid Supabase client or auth object");
    return { success: false, error: "Authentication service unavailable" };
  }

  try {
    // Get the current user and check if they're authenticated
    console.log(
      "[EnsureUser] Supabase client and auth object available, calling getUser()"
    );

    const {
      data: { user },
      error,
    } = await supabaseClient.auth.getUser();

    if (error) {
      console.error("[EnsureUser] Supabase auth error:", error.message);
      return { success: false, error: error.message };
    }

    console.log("[EnsureUser] getUser() completed", { hasUser: !!user });

    if (!user) {
      console.error("[EnsureUser] No authenticated user found in session");
      return { success: false, error: "Not authenticated" };
    }

    // User is authenticated, log their details
    console.log(`[EnsureUser] User ${user.id} authenticated.`);

    // Sync user to database
    console.log("[EnsureUser] Proceeding to sync user to database");
    const syncResult = await syncUserToDatabase(supabaseClient, user);
    console.log("[EnsureUser] Sync user result:", syncResult);

    if (!syncResult.success) {
      console.error(
        `[EnsureUser] Failed to sync user ${user.id}:`,
        syncResult.error
      );
      return {
        success: false,
        user,
        error: `User authenticated but sync failed: ${syncResult.error}`,
      };
    }

    console.log(`[EnsureUser] User ${user.id} sync completed successfully`);
    return { success: true, user };
  } catch (error) {
    console.error("[EnsureUser] Unexpected error:", error);
    return { success: false, error: "Unexpected authentication error" };
  }
}
