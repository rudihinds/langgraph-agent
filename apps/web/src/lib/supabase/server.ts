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
      if (!ENV.NEXT_PUBLIC_SUPABASE_URL) {
        console.error(
          "[SupabaseClient] Missing NEXT_PUBLIC_SUPABASE_URL environment variable"
        );
        return null;
      }

      if (!ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        console.error(
          "[SupabaseClient] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable"
        );
        return null;
      }

      // Use provided cookie store or get from next/headers
      let cookieJar;
      try {
        cookieJar = cookieStore
          ? cookieStore instanceof Promise
            ? await cookieStore
            : cookieStore
          : await cookies();
      } catch (cookieError) {
        console.error("[SupabaseClient] Error accessing cookies:", cookieError);
        return null;
      }

      const client = createServerClient(
        ENV.NEXT_PUBLIC_SUPABASE_URL,
        ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          cookies: {
            async getAll() {
              try {
                const allCookies = await cookieJar.getAll();
                return allCookies;
              } catch (error) {
                console.error("[SupabaseClient] Error getting cookies:", error);
                return [];
              }
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieJar.set(name, value, options)
                );
              } catch (error) {
                console.error("[SupabaseClient] Error setting cookies:", error);
                // This can be ignored if you have middleware refreshing user sessions
              }
            },
          },
        }
      );

      return client;
    } catch (error) {
      console.error("[SupabaseClient] Failed to create client:", error);
      return null;
    }
  }
);
