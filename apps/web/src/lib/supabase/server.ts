"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { ENV } from "@/env";

/**
 * Server-side Supabase client that handles cookies properly.
 * Can be used in Server Components, Route Handlers, and Server Actions.
 */
export const createClient = cache(
  async (
    cookieStore?:
      | ReturnType<typeof cookies>
      | Promise<ReturnType<typeof cookies>>
  ) => {
    try {
      // Check for required environment variables
      if (!ENV.NEXT_PUBLIC_SUPABASE_URL) {
        console.error(
          "[SupabaseClient] Missing NEXT_PUBLIC_SUPABASE_URL environment variable"
        );
        throw new Error("Missing Supabase URL");
      }

      if (!ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        console.error(
          "[SupabaseClient] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable"
        );
        throw new Error("Missing Supabase anonymous key");
      }

      // Use provided cookie store or get from next/headers
      let cookieJar;
      try {
        if (cookieStore instanceof Promise) {
          cookieJar = await cookieStore;
        } else if (cookieStore) {
          cookieJar = cookieStore;
        } else {
          // Always await cookies() to ensure it's properly resolved
          cookieJar = await cookies();
        }
      } catch (cookieError) {
        console.error("[SupabaseClient] Error accessing cookies:", cookieError);
        throw new Error("Cookie access error");
      }

      console.log(
        "[SupabaseClient] Creating server client with URL:",
        ENV.NEXT_PUBLIC_SUPABASE_URL
      );

      // Use the simplified pattern for creating the client
      const client = createServerClient(
        ENV.NEXT_PUBLIC_SUPABASE_URL,
        ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          cookies: {
            getAll() {
              // Now cookieJar is guaranteed to be resolved
              return cookieJar.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieJar.set(name, value, options)
                );
              } catch (error) {
                console.log(
                  "[SupabaseClient] Note: Cookie set attempted in component scope - this is expected in some contexts"
                );
              }
            },
          },
        }
      );

      // Verify the client has the auth object
      if (!client || !client.auth) {
        console.error("[SupabaseClient] Client created but auth is undefined");
        throw new Error("Supabase client auth is undefined");
      }

      return client;
    } catch (error) {
      console.error("[SupabaseClient] Failed to create client:", error);
      throw error; // Re-throw so the calling code can handle it
    }
  }
);
